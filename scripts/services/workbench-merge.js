/**
 * WORKBENCH MERGE ENGINE
 *
 * Joins the local Active Workbench records (data/ongoing-*.json) with the
 * upstream docs-PR tracker feed (adiati98/mautic-docs-prs-tracker) into ONE
 * list of merged records, each carrying:
 *
 *   - lane        action | ready | waiting | stalled | bot
 *                 (the tracker's "whose turn is it?" model, generalized)
 *   - ball        the existing Take Action / Watching / Waiting / Approved /
 *                 Stale pill label (kept as the row-level status)
 *   - approval    { state, by, noteSince } — "approved" starts a checklist,
 *                 it does not end one
 *   - nextStep    plain-language remaining action (required for action/ready)
 *   - linkedCodePr / upstream signals from the tracker cache
 *   - idleDays    drives remind (7d) → follow up (10d) → escalate (14d)
 *
 * Resilience contract: the tracker feed can be down, rate-limited, or
 * schema-drifted — the merge NEVER fails the build. Failures degrade to the
 * last cached copy (data/tracker-cache.json) and finally to local-only
 * records, with `feed.degraded` explaining what happened.
 */
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { GITHUB_USERNAME } = require('../config/config');
const { isAllowedBotLogin, isBotLogin } = require('../utils/bot-helpers');

const TRACKER_RAW_URL =
  'https://raw.githubusercontent.com/adiati98/mautic-docs-prs-tracker/main/data/pr-cache.json';
const TRACKER_CACHE_FILE = path.join('data', 'tracker-cache.json');

const STALLED_AFTER_DAYS = 30;
const REMIND_AFTER_DAYS = 7;
const FOLLOW_UP_AFTER_DAYS = 10;
const ESCALATE_AFTER_DAYS = 14;

// ---------------------------------------------------------------------------
// Upstream feed: fetch → validate → cache → degrade
// ---------------------------------------------------------------------------

/**
 * A valid tracker cache is an object keyed by "owner/repo#number" whose
 * values carry the raw activity arrays. Anything else counts as schema
 * drift and downgrades the feed rather than crashing the merge.
 */
function isValidTrackerShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const entries = Object.entries(data);
  if (entries.length === 0) return true; // empty tracker is valid
  return entries.slice(0, 5).every(
    ([key, value]) =>
      /^[^/]+\/[^#]+#\d+$/.test(key) &&
      value &&
      typeof value === 'object' &&
      ('docsUpdatedAt' in value || Array.isArray(value.rawDocsReviews))
  );
}

async function readTrackerCacheFile() {
  try {
    const raw = await fs.readFile(TRACKER_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && isValidTrackerShape(parsed.data)) return parsed;
  } catch (e) {
    /* no usable cache */
  }
  return null;
}

/**
 * Fetches the tracker feed with full degradation:
 *   live fetch OK  → { data, fetchedAt, degraded: false }
 *   fetch fails    → last cached copy, degraded: true, reason
 *   no cache       → empty feed, degraded: true, reason
 */
async function fetchTrackerFeed({ url = TRACKER_RAW_URL, timeoutMs = 10000 } = {}) {
  try {
    const res = await axios.get(url, { timeout: timeoutMs, responseType: 'json' });
    if (!isValidTrackerShape(res.data)) {
      throw new Error('tracker feed shape changed (schema drift)');
    }
    const feed = { data: res.data, fetchedAt: new Date().toISOString(), degraded: false, reason: null };
    try {
      await fs.mkdir(path.dirname(TRACKER_CACHE_FILE), { recursive: true });
      await fs.writeFile(
        TRACKER_CACHE_FILE,
        JSON.stringify({ fetchedAt: feed.fetchedAt, data: res.data }),
        'utf8'
      );
    } catch (e) {
      /* cache write is best-effort */
    }
    return feed;
  } catch (err) {
    const cached = await readTrackerCacheFile();
    if (cached) {
      return {
        data: cached.data,
        fetchedAt: cached.fetchedAt || null,
        degraded: true,
        reason: `live fetch failed (${err.message}); using cached feed`,
      };
    }
    return {
      data: {},
      fetchedAt: null,
      degraded: true,
      reason: `live fetch failed (${err.message}); no cached feed available`,
    };
  }
}

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

function taskKey(record) {
  if (!record.repo || record.number == null) return null;
  return `${record.repo}#${record.number}`;
}

/** Extracts a linked code-PR reference from a docs PR body, if present. */
function extractLinkedCodePr(body, ownRepo) {
  if (!body) return null;
  const urlMatch = body.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
  if (urlMatch && urlMatch[1] !== ownRepo) return `${urlMatch[1]}#${urlMatch[2]}`;
  const shortMatch = body.match(/([\w.-]+\/[\w.-]+)#(\d+)/);
  if (shortMatch && shortMatch[1] !== ownRepo) return `${shortMatch[1]}#${shortMatch[2]}`;
  return null;
}

/**
 * Every issue a PR body points at, as `owner/repo#number` keys. Catches
 * issue URLs, cross-repo `owner/repo#n`, and bare `#n` (resolved against the
 * PR's own repo). Deliberately looser than a closing-keyword match: "linked
 * on the PR" is the signal we want, and templates vary too much per project
 * to rely on `Closes:` being present.
 */
function extractIssueRefs(body, ownRepo) {
  const keys = new Set();
  const add = (repo, num) => {
    if (repo && num) keys.add(`${repo}#${num}`);
  };
  if (!body) return keys;
  for (const m of body.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)/gi)) add(m[1], m[2]);
  for (const m of body.matchAll(/([\w.-]+\/[\w.-]+)#(\d+)/g)) add(m[1], m[2]);
  // Bare `#n`, but not the tail of `owner/repo#n` already handled above.
  for (const m of body.matchAll(/(?:^|[^\w/#])#(\d+)/g)) add(ownRepo, m[1]);
  return keys;
}

/**
 * Maps each ASSIGNED issue to the PR of yours that addresses it.
 *
 * Only issues in `assignedKeys` can be matched, and that constraint is the
 * guard against PR-template boilerplate: unedited templates ship placeholder
 * refs (`Closes: #123`) that several unrelated PRs "close" at once. Those
 * resolve to keys nobody is assigned, so they're dropped instead of
 * silencing a real issue. When two PRs point at the same issue, the most
 * recently updated one wins — splitting one issue across PRs is normal.
 */
function buildIssuePrLinks(prs, assignedKeys) {
  const links = new Map();
  if (assignedKeys.size === 0) return links;
  for (const pr of prs) {
    if (!pr || !pr.repo || pr.number == null) continue;
    for (const key of extractIssueRefs(pr.body, pr.repo)) {
      if (!assignedKeys.has(key)) continue;
      const current = links.get(key);
      if (!current || new Date(pr.updatedAt || 0) > new Date(current.updatedAt || 0)) {
        links.set(key, {
          ref: `${pr.repo}#${pr.number}`,
          url: pr.url || null,
          updatedAt: pr.updatedAt || null,
          isDraft: pr.isDraft === true,
        });
      }
    }
  }
  return links;
}

/**
 * True when `login` names a bot account — INCLUDING allow-listed bots like
 * Promptless. Used only where an automated review must be discounted (e.g. a
 * Promptless COMMENTED review is not "a human reviewed this"). This is NOT the
 * bot-lane test: the allowlist keeps Promptless out of the bot lane — see
 * isBotRecord.
 */
function isBotActor(login) {
  const lower = String(login || '').toLowerCase();
  if (!lower) return false;
  return isAllowedBotLogin(lower) || isBotLogin(lower);
}

function isBotRecord(record) {
  const username = typeof record.user === 'object' ? record.user?.login : record.user;
  const author = record.author;
  // Allow-listed bots (Promptless) are treated as human actors — their PRs are
  // active review work, NEVER bot-lane clutter. Honor the allowlist for the
  // author and the recorded user alike before any bot test runs.
  if (isAllowedBotLogin(author) || isAllowedBotLogin(username)) return false;
  const userStr = String(username || '').toLowerCase();
  const titleStr = String(record.title || '').toLowerCase();
  // Route to the bot lane by AUTHOR, not only by last actor: a row a
  // (non-allow-listed) bot authored is automated work no matter who touched it
  // last — so a genuine bot's PR still folds away even when a human replied.
  return (
    isBotLogin(author) ||
    isBotLogin(userStr) ||
    titleStr.startsWith('[snyk]') ||
    (titleStr.startsWith('bump') && userStr.includes('dependabot'))
  );
}

function daysBetween(from, to) {
  return (to - new Date(from)) / (1000 * 60 * 60 * 24);
}

/**
 * Latest approval visible from either side of the join, plus whether any
 * substantive (non-bot) docs comment landed AFTER that approval — the
 * tracker's "note since approval — take a look" signal.
 */
function deriveApproval(local, upstream) {
  let state = null;
  let by = null;
  let approvedAt = null;
  let dismissed = false;
  let dismissedAt = null;

  if (local && (local.reviewState === 'APPROVED' || local.status === 'APPROVED')) {
    state = 'APPROVED';
    by = local.approvedBy ? String(local.approvedBy).trim() : null;
  }

  // Read the latest APPROVED/DISMISSED review from the tracker. A dismissed
  // approval no longer shows as APPROVED in GitHub's reviews list — it flips
  // to DISMISSED while still carrying the original approver's login — so
  // filtering to APPROVED alone silently drops it. We keep it and mark it
  // `dismissed` so the lane can route it to "re-request" instead.
  if (upstream && Array.isArray(upstream.rawDocsReviews)) {
    const reviews = upstream.rawDocsReviews;
    const decisive = reviews.filter((r) => r && (r.state === 'APPROVED' || r.state === 'DISMISSED'));
    if (decisive.length > 0) {
      const latest = decisive.reduce((a, b) =>
        new Date(a.submitted_at || 0) >= new Date(b.submitted_at || 0) ? a : b
      );
      // A change request landing AFTER the last approval/dismissal supersedes
      // it — the PR is no longer approved (the reviewed-again case, e.g. an
      // approval dismissed on push and then changes requested). Drop the
      // approval and let the turn-based logic take over.
      const supersededByChanges = reviews.some(
        (r) =>
          r &&
          r.state === 'CHANGES_REQUESTED' &&
          new Date(r.submitted_at || 0) > new Date(latest.submitted_at || 0)
      );
      if (supersededByChanges) {
        state = null;
        by = null;
        approvedAt = null;
      } else {
        state = 'APPROVED';
        approvedAt = latest.submitted_at || null;
        dismissed = latest.state === 'DISMISSED';
        dismissedAt = dismissed ? latest.submitted_at || null : null;
        // A dismissed review names the approver whose approval was dropped;
        // prefer it so "re-request from <login>" points at the right person.
        by = dismissed ? latest.user?.login || by : by || latest.user?.login || null;
      }
    }
  }

  if (!state) return null;

  // "Note since approval" only applies to a live approval — a dismissed one
  // already routes to "re-request", which supersedes any later note.
  let noteSince = false;
  if (!dismissed && approvedAt && upstream && Array.isArray(upstream.rawDocsComments)) {
    noteSince = upstream.rawDocsComments.some(
      (c) =>
        c &&
        new Date(c.created_at || 0) > new Date(approvedAt) &&
        !isBotLogin(c.user?.login)
    );
  }

  return { state, by, approvedAt, noteSince, dismissed, dismissedAt };
}

/**
 * A LIVE formal review request aimed at YOU (the workbench owner) — the
 * tracker's rawReviewRequests, filtered to `requested_reviewer === me`. Team
 * requests and requests aimed at other reviewers are ignored: this is the
 * "you've been pinged to review" signal, the review-side equivalent of an
 * @-mention. Returns the most recent such LIVE request, or null.
 *
 * Liveness is the crux. rawReviewRequests are historical GitHub timeline events
 * that PERSIST after the request is fulfilled: GitHub clears the live
 * `requested_reviewers` the instant you review, but the upstream tracker caches
 * the `review_requested` issue event for good — which is exactly why we can see
 * it at all. So a request counts as live ONLY when you have not already answered
 * it: no review (rawDocsReviews) or comment (rawDocsComments) of yours is dated
 * after the request was made. A later comment by someone ELSE does not revive a
 * request you already handled — only your own activity fulfills it.
 */
function deriveReviewRequest(upstream, me) {
  if (!upstream || !Array.isArray(upstream.rawReviewRequests)) return null;
  const mine = upstream.rawReviewRequests.filter(
    (r) =>
      r && r.requested_reviewer && String(r.requested_reviewer.login || '').toLowerCase() === me
  );
  if (mine.length === 0) return null;
  const latest = mine.reduce((a, b) =>
    new Date(a.created_at || 0) >= new Date(b.created_at || 0) ? a : b
  );

  // Fulfilled? A review or comment of MINE dated after the request was made.
  const requestedAt = new Date(latest.created_at || 0);
  const answeredByMe = (arr, dateField) =>
    (Array.isArray(arr) ? arr : []).some(
      (x) =>
        x &&
        String(x.user?.login || '').toLowerCase() === me &&
        new Date(x[dateField] || 0) > requestedAt
    );
  if (
    answeredByMe(upstream.rawDocsReviews, 'submitted_at') ||
    answeredByMe(upstream.rawDocsComments, 'created_at')
  ) {
    return null;
  }

  return {
    of: latest.requested_reviewer.login || null,
    by: latest.actor?.login || null,
    at: latest.created_at || null,
  };
}

/**
 * Muted "someone reviewed this" context: when a human other than you left a
 * review (a comment or a change request) but there's no approval to show,
 * name the latest such reviewer. Purely informational — it NEVER changes the
 * lane. Suppressed when an approval (live or dismissed) is already surfaced,
 * and it skips your own reviews and bot reviews (incl. allow-listed bots).
 */
function deriveReviewedNote(upstream, approval, me) {
  if (approval) return null;
  if (!upstream || !Array.isArray(upstream.rawDocsReviews)) return null;
  const reviews = upstream.rawDocsReviews.filter((r) => {
    if (!r) return false;
    const login = String(r.user?.login || '').toLowerCase();
    if (!login || login === me || isBotActor(login)) return false;
    return r.state === 'COMMENTED' || r.state === 'CHANGES_REQUESTED';
  });
  if (reviews.length === 0) return null;
  const latest = reviews.reduce((a, b) =>
    new Date(a.submitted_at || 0) >= new Date(b.submitted_at || 0) ? a : b
  );
  return latest.user?.login ? { by: latest.user.login } : null;
}

/** Logins @-mentioned in a comment body, in their original case. Loose match
 * on GitHub's handle charset — enough to tell "pinged me" from "pinged someone
 * else". */
function extractMentions(body) {
  if (!body || typeof body !== 'string') return [];
  return [...body.matchAll(/@([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)/gi)].map((m) => m[1]);
}

/**
 * Ping routing for a record an allow-listed bot (Promptless) authored AND is
 * the last actor on. Its "reply" is an automated push, so the board must route
 * by WHO the bot pinged — never the generic human "author replied — review the
 * latest changes" step. Returns null when this isn't a bot-last-actor case;
 * otherwise `{ mentionsMe, of }`:
 *
 *   - mentionsMe  the bot's most recent docs comment @-mentions you (a
 *                 "Thanks @you, addressed…" reply). The caller ALSO treats a
 *                 live review request aimed at you (deriveReviewRequest) as a
 *                 ping to you.
 *   - of          the other login the bot pinged (original case), or null —
 *                 an @-mention of someone else in its latest comment, else a
 *                 review request aimed at someone other than you.
 *
 * A ping to you is your turn (the caller routes it to the action lane); a ping
 * aimed only at others is their turn, surfaced to the renderer as botPing.
 */
function deriveBotPing(upstream, local, me) {
  const author = String(local?.author || '').toLowerCase();
  const lastActor = String(
    local?.lastActor ||
      (typeof local?.user === 'object' ? local?.user?.login : local?.user) ||
      ''
  ).toLowerCase();
  if (!author || !isAllowedBotLogin(author) || lastActor !== author) return null;

  // The bot's most recent docs comment — where a "Thanks @you…" ping lives.
  const botComments = (Array.isArray(upstream?.rawDocsComments) ? upstream.rawDocsComments : []).filter(
    (c) => c && String(c.user?.login || '').toLowerCase() === author
  );
  const latestComment = botComments.length
    ? botComments.reduce((a, b) =>
        new Date(a.created_at || 0) >= new Date(b.created_at || 0) ? a : b
      )
    : null;
  const mentions = latestComment ? extractMentions(latestComment.body) : [];
  const mentionsMe = mentions.some((m) => m.toLowerCase() === me);

  // Who else did it ping? Prefer an @-mention of another human in the latest
  // comment; fall back to a review request aimed at someone other than you.
  let of = mentions.find((m) => m.toLowerCase() !== me && m.toLowerCase() !== author) || null;
  if (!of && Array.isArray(upstream?.rawReviewRequests)) {
    const others = upstream.rawReviewRequests.filter(
      (r) =>
        r &&
        r.requested_reviewer &&
        String(r.requested_reviewer.login || '').toLowerCase() !== me
    );
    if (others.length) {
      const latestReq = others.reduce((a, b) =>
        new Date(a.created_at || 0) >= new Date(b.created_at || 0) ? a : b
      );
      of = latestReq.requested_reviewer.login || null;
    }
  }

  return { mentionsMe, of };
}

// ---------------------------------------------------------------------------
// Lane + next-step derivation (the tracker's model, generalized)
// ---------------------------------------------------------------------------

function idleHint(idleDays) {
  if (idleDays >= ESCALATE_AFTER_DAYS) return `idle ${Math.floor(idleDays)}d — escalate`;
  if (idleDays >= FOLLOW_UP_AFTER_DAYS) return `idle ${Math.floor(idleDays)}d — follow up`;
  if (idleDays >= REMIND_AFTER_DAYS) return `idle ${Math.floor(idleDays)}d — send a reminder`;
  return null;
}

/**
 * Assigns lane, ball label, and nextStep for one merged record.
 * Precedence: bot → assigned issue → approved (ready/action) → stalled →
 * turn-based.
 *
 * Assigned issues are resolved BEFORE the staleness rule on purpose. An
 * issue you haven't started has nobody touching it, so it always ages past
 * the stalled threshold — which used to drop it into a folded lane reading
 * "nudge or close", the exact opposite of "write this". Age is not evidence
 * of staleness here; it's evidence of backlog, so it's carried as urgency
 * inside the row instead.
 */
function deriveLane(record, me, botPingSignal = null) {
  const { relationship, approval, idleDays, linkedCodePr, upstream } = record;

  if (record.isBot) {
    return { lane: 'bot', ball: 'Bot', nextStep: null };
  }

  if (relationship === 'assigned issue') {
    if (record.linkedPr) {
      const draft = record.linkedPr.isDraft ? ' (draft)' : '';
      return {
        lane: 'waiting',
        ball: 'Watching',
        nextStep: `Covered by ${record.linkedPr.ref}${draft} — finish it there`,
      };
    }
    const age = Math.floor(idleDays);
    return {
      lane: 'action',
      ball: 'To Write',
      nextStep:
        age >= REMIND_AFTER_DAYS
          ? `Assigned ${age}d ago, no PR yet — start the work`
          : 'Assigned to you, no PR yet — start the work',
    };
  }

  if (approval) {
    if (approval.dismissed) {
      // The approval was dismissed after an update — the work is essentially
      // done, it just needs the approver to look again. Keep it in the ready
      // lane (not action) and point at re-requesting the review.
      return {
        lane: 'ready',
        ball: 'Approved',
        nextStep: approval.by
          ? `Re-request review from ${approval.by}`
          : 'Re-request a review — the approval was dismissed',
      };
    }
    if (approval.noteSince) {
      return {
        lane: 'action',
        ball: 'Approved',
        nextStep: 'Note since approval — take a look, then merge',
      };
    }
    const codeStillOpen = Boolean(linkedCodePr) || Boolean(upstream && upstream.codeUpdatedAt);
    let nextStep = 'Final review, then merge';
    if (codeStillOpen) nextStep = 'Final review — confirm the linked code PR landed, then merge';
    if (idleDays >= REMIND_AFTER_DAYS) {
      nextStep = `Approved ${Math.floor(idleDays)}d ago — nudge a maintainer to merge`;
    }
    return { lane: 'ready', ball: 'Approved', nextStep };
  }

  if (idleDays >= STALLED_AFTER_DAYS) {
    return {
      lane: 'stalled',
      ball: 'Stale',
      nextStep: `Idle ${Math.floor(idleDays)}d — decide: nudge or close`,
    };
  }

  const lastActor = String(record.lastActor || '').toLowerCase();
  const prAuthor = String(record.author || '').toLowerCase();
  const isMe = lastActor === me;
  const isAuthor = lastActor && lastActor === prAuthor;
  const actorIsBot = !isAllowedBotLogin(lastActor) && (record.isLastActorBot || isBotLogin(lastActor));
  const reminder = idleHint(record.idleDays);
  const reviewRequestedOfMe = Boolean(record.reviewRequest);

  // An allow-listed bot (Promptless) authored this AND pushed last — its
  // "reply" is automated, so route by who it pinged instead of the human
  // "author replied" step (which we must never emit for a bot). A ping aimed
  // ONLY at someone else is their turn (waiting), recorded as botPing so the
  // board can show "Promptless pinged <who>". Otherwise it's my turn — it
  // @-mentioned me, or requested my review, or there's simply no ping pointing
  // elsewhere and the review is still mine to do — routed to the action lane
  // with no next-step chip, since the lane already says it's my move.
  if (botPingSignal) {
    const pingsOnlyOthers =
      !botPingSignal.mentionsMe && !reviewRequestedOfMe && Boolean(botPingSignal.of);
    if (pingsOnlyOthers) {
      return {
        lane: 'waiting',
        ball: 'Watching',
        nextStep: null,
        botPing: { by: record.author, of: botPingSignal.of },
      };
    }
    return { lane: 'action', ball: 'Take Action', nextStep: null };
  }

  if (relationship === 'reviewing') {
    if (isMe) return { lane: 'waiting', ball: 'Waiting', nextStep: null };
    if (isAuthor) {
      return {
        lane: 'action',
        ball: 'Take Action',
        nextStep: reminder || 'Author replied — review the latest changes',
      };
    }
    // A formal review request aimed at you is a "your turn" ping — treat it
    // like an @-mention. It lands in the action lane and escalates with age
    // (remind → follow up → escalate) through `reminder`. This generalizes the
    // local `status === 'Request review'` flag to the tracker's
    // rawReviewRequests so tracker-augmented rows get the same signal.
    if (record.status === 'Request review' || reviewRequestedOfMe) {
      return { lane: 'action', ball: 'Take Action', nextStep: reminder || 'Review requested — review it' };
    }
    return { lane: 'waiting', ball: 'Watching', nextStep: null };
  }

  // authored / co-authoring
  if (record.isDraft) {
    return { lane: 'waiting', ball: 'Waiting', nextStep: 'Draft — finish and mark ready' };
  }
  const blocked = (record.labels || []).some((l) => {
    const s = String(l).toLowerCase();
    return s.includes('blocked') || s.includes('stalled') || s.includes('wait');
  });
  if (blocked) {
    return {
      lane: 'waiting',
      ball: 'Waiting',
      nextStep: linkedCodePr ? `Blocked on ${linkedCodePr}` : 'Blocked — check the blocker',
    };
  }
  if (!lastActor || isMe) {
    return { lane: 'waiting', ball: 'Waiting', nextStep: null };
  }
  if (actorIsBot) {
    return { lane: 'waiting', ball: 'Watching', nextStep: null };
  }
  return {
    lane: 'action',
    ball: 'Take Action',
    nextStep: record.hasFormalReview
      ? 'Address the review feedback'
      : 'Reply to the discussion, then request review',
  };
}

// ---------------------------------------------------------------------------
// The merge
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {Array} input.tasks       ongoing-tasks.json  (reviews)
 * @param {Array} input.issues      ongoing-issues.json
 * @param {Array} input.prs        ongoing-prs.json    (authored)
 * @param {Array} input.coauthored ongoing-coauthored-prs.json
 * @param {object} input.feed      { data, fetchedAt, degraded, reason }
 * @param {string} [input.username]
 * @param {Date}   [input.now]
 * @returns {{ records: Array, feed: object }}
 */
function mergeWorkbench({ tasks = [], issues = [], prs = [], coauthored = [], feed, username, now }) {
  const me = String(username || GITHUB_USERNAME || '').toLowerCase();
  const nowDate = now || new Date();
  const tracker = (feed && feed.data) || {};

  const locals = [
    ...prs.map((r) => ({ ...r, relationship: 'authored' })),
    ...coauthored.map((r) => ({ ...r, relationship: 'co-authoring' })),
    ...tasks.map((r) => ({ ...r, relationship: 'reviewing' })),
    ...issues.map((r) => ({ ...r, relationship: 'assigned issue' })),
  ];

  // Which assigned issues already have a PR of yours addressing them. Issues
  // carry no body, so the link can only be read from the PR side.
  const assignedIssueKeys = new Set(issues.map((i) => taskKey(i)).filter(Boolean));
  const issuePrLinks = buildIssuePrLinks([...prs, ...coauthored], assignedIssueKeys);

  const matchedKeys = new Set();
  const records = locals.map((local) => {
    const key = taskKey(local);
    const upstream = key && tracker[key] ? tracker[key] : null;
    if (upstream) matchedKeys.add(key);

    const effectiveDate = local.lastSubstantiveDate || local.updatedAt || local.createdAt;
    const idleDays = effectiveDate ? Math.max(0, daysBetween(effectiveDate, nowDate)) : 0;
    const linkedCodePr = extractLinkedCodePr(local.body, local.repo);
    const approval = deriveApproval(local, upstream);
    const reviewRequest = deriveReviewRequest(upstream, me);
    const reviewedNote = deriveReviewedNote(upstream, approval, me);
    const botPingSignal = deriveBotPing(upstream, local, me);

    const record = {
      key,
      source: upstream ? 'local+tracker' : 'local',
      title: local.title || null,
      url: local.url || null,
      repo: local.repo || null,
      relationship: local.relationship,
      labels: local.labels || [],
      isDraft: local.isDraft === true,
      isBot: isBotRecord(local),
      lastActor: local.lastActor || (typeof local.user === 'object' ? local.user?.login : local.user) || null,
      isLastActorBot: local.isLastActorBot === true,
      hasFormalReview: local.hasFormalReview === true,
      author: local.author || null,
      status: local.status || null,
      approval,
      reviewRequest,
      reviewedNote,
      // Set by deriveLane only when an allow-listed bot pinged someone other
      // than you; null otherwise. Always present so renderers can rely on it.
      botPing: null,
      linkedCodePr: linkedCodePr
        ? { ref: linkedCodePr, hasActivity: Boolean(upstream && upstream.codeUpdatedAt) }
        : null,
      upstream: upstream
        ? {
            docsUpdatedAt: upstream.docsUpdatedAt || null,
            codeUpdatedAt: upstream.codeUpdatedAt || null,
            docsReviewCount: (upstream.rawDocsReviews || []).length,
            docsCommentCount: (upstream.rawDocsComments || []).length,
          }
        : null,
      idleDays,
      updatedAt: local.updatedAt || null,
      linkedPr:
        local.relationship === 'assigned issue' && key ? issuePrLinks.get(key) || null : null,
    };

    Object.assign(record, deriveLane(record, me, botPingSignal));
    return record;
  });

  // Tracker-only rows: the tracker watches them but they aren't in the local
  // workbench (e.g. someone else's docs PR you triage as maintainer). The
  // cache carries activity, not titles — renderers show repo#number.
  for (const [key, upstream] of Object.entries(tracker)) {
    if (matchedKeys.has(key)) continue;
    const [repo, number] = key.split('#');
    const approval = deriveApproval(null, upstream);
    const reviewRequest = deriveReviewRequest(upstream, me);
    const reviewedNote = deriveReviewedNote(upstream, approval, me);
    const effectiveDate = upstream.docsUpdatedAt || null;
    const idleDays = effectiveDate ? Math.max(0, daysBetween(effectiveDate, nowDate)) : 0;

    const record = {
      key,
      source: 'tracker',
      title: null,
      url: `https://github.com/${repo}/pull/${number}`,
      repo,
      relationship: 'reviewing',
      labels: [],
      // Draft state lives in the local fetch layer (a PR's `draft` flag), which
      // tracker-only rows never pass through — the tracker cache stores activity
      // arrays, not PR state. A docs PR you merely triage as maintainer also
      // isn't a draft of yours, so false is the correct, safe default here.
      isDraft: false,
      isBot: false,
      lastActor: null,
      isLastActorBot: false,
      hasFormalReview: (upstream.rawDocsReviews || []).length > 0,
      author: null,
      status: null,
      approval,
      reviewRequest,
      reviewedNote,
      // Tracker-only rows have no local author/last-actor, so no bot-ping can be
      // derived — kept present and null for a uniform record contract.
      botPing: null,
      linkedCodePr: upstream.codeUpdatedAt ? { ref: null, hasActivity: true } : null,
      upstream: {
        docsUpdatedAt: upstream.docsUpdatedAt || null,
        codeUpdatedAt: upstream.codeUpdatedAt || null,
        docsReviewCount: (upstream.rawDocsReviews || []).length,
        docsCommentCount: (upstream.rawDocsComments || []).length,
      },
      idleDays,
      updatedAt: upstream.docsUpdatedAt || null,
      linkedPr: null,
    };

    Object.assign(record, deriveLane(record, me));
    records.push(record);
  }

  // Lane order, then most-urgent (idle desc within action, recency elsewhere)
  const laneOrder = { action: 0, ready: 1, waiting: 2, stalled: 3, bot: 4 };
  records.sort((a, b) => {
    const lane = (laneOrder[a.lane] ?? 9) - (laneOrder[b.lane] ?? 9);
    if (lane !== 0) return lane;
    if (a.lane === 'action' || a.lane === 'stalled') return b.idleDays - a.idleDays;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });

  return { records, feed: { fetchedAt: feed?.fetchedAt || null, degraded: Boolean(feed?.degraded), reason: feed?.reason || null } };
}

// ---------------------------------------------------------------------------
// Impact header numbers
// ---------------------------------------------------------------------------

function quarterStart(date) {
  const q = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), q, 1);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Counts merged items across `lists` on or after `since`, plus the unique
 * non-bot authors among them. Only counts items that actually merged —
 * "shipped"/"helped ship" both claim the work landed, so a still-open or
 * closed-without-merging item doesn't qualify yet. */
function tallyMerged(lists, since) {
  const authors = new Set();
  let count = 0;
  for (const list of lists) {
    for (const item of list || []) {
      if (!item.mergedAt || (since && new Date(item.mergedAt) < since)) continue;
      count++;
      const author =
        item.author || (typeof item.user === 'object' ? item.user?.login : item.user) || null;
      if (author && !isBotLogin(author)) authors.add(String(author).toLowerCase());
    }
  }
  return { count, authors };
}

/**
 * Plain-language numbers for the impact header, computed from data the
 * pipeline already has. `contributions` is all-contributions.json.
 *
 * Two time scopes ship side by side: LIFETIME figures (`helpedShipCount`,
 * `contributorsHelped`) are what the Home page shows — the whole career
 * footprint. THIS-MONTH figures (the `*ThisMonth` fields) are what the
 * Workbench shows — resets on the 1st, because the Workbench's job is
 * "what's happening right now," not a running lifetime total. Reusing the
 * same numbers on both pages under the same label was the original bug this
 * split fixes: 52 projects (lifetime) and 9 projects (whatever the board
 * happened to have open) looked like the same metric measured twice.
 */
function computeImpact(records, contributions = {}, now = new Date()) {
  const qStart = quarterStart(now);
  const mStart = monthStart(now);
  const inMonth = (item) => item.date && new Date(item.date) >= mStart;

  // The hero number: everything that actually merged this quarter, across
  // every way you ship something — your own PRs, PRs you reviewed, PRs you
  // co-authored. It used to only count pullRequests + coAuthoredPrs (by
  // `.date`, not `mergedAt`, so an unmerged item could still count) and
  // left reviewedPrs out entirely. For a reviewer-heavy contributor that
  // made the quarterly hero number smaller than the "helped ship this
  // month" tile below it — a month inside the quarter outscoring the
  // quarter itself, purely because they measured different activity, not
  // different time windows.
  const shippedThisQuarter = tallyMerged(
    [contributions.pullRequests, contributions.reviewedPrs, contributions.coAuthoredPrs],
    qStart
  ).count;

  // Both phrasings ("N contributors' work you're helping ship" / "N
  // contributions you helped ship") claim the work actually shipped, so only
  // merged items count — a reviewed/co-authored PR still open or closed
  // without merging wasn't "helped ship" yet. Deliberately excludes your own
  // solo pullRequests — this tile is about work you helped OTHERS ship.
  const lifetime = tallyMerged([contributions.reviewedPrs, contributions.coAuthoredPrs], null);
  const thisMonth = tallyMerged([contributions.reviewedPrs, contributions.coAuthoredPrs], mStart);

  // Projects/orgs touched THIS MONTH, across every contribution type — the
  // Workbench's answer to "how spread am I right now." Uses each record's
  // own `.date` (the project-wide "when this happened" field — see
  // shippedThisQuarter above and Home's yearsActive), the same convention
  // Home uses for its lifetime figure, just windowed to the current month.
  const allThisMonth = [
    ...(contributions.pullRequests || []),
    ...(contributions.issues || []),
    ...(contributions.reviewedPrs || []),
    ...(Array.isArray(contributions.coAuthoredPrs) ? contributions.coAuthoredPrs : []),
    ...(contributions.collaborations || []),
  ].filter(inMonth);
  const reposThisMonth = new Set(allThisMonth.map((i) => i.repo).filter(Boolean));
  const orgsThisMonth = new Set([...reposThisMonth].map((r) => r.split('/')[0]));

  return {
    shippedThisQuarter,
    approvedLanding: records.filter((r) => r.lane === 'ready').length,
    needAction: records.filter((r) => r.lane === 'action').length,
    contributorsHelped: lifetime.authors.size,
    helpedShipCount: lifetime.count,
    contributorsHelpedThisMonth: thisMonth.authors.size,
    helpedShipThisMonth: thisMonth.count,
    projectsThisMonth: reposThisMonth.size,
    organizationsThisMonth: orgsThisMonth.size,
  };
}

// ---------------------------------------------------------------------------
// Convenience loader for the generator pipeline
// ---------------------------------------------------------------------------

async function readJsonOr(fallback, file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

/** Loads local records + tracker feed and returns the full merged model. */
async function loadMergedWorkbench({ dataDir = 'data', fetchOptions } = {}) {
  const [tasks, issues, prs, coauthored, contributions] = await Promise.all([
    readJsonOr([], path.join(dataDir, 'ongoing-tasks.json')),
    readJsonOr([], path.join(dataDir, 'ongoing-issues.json')),
    readJsonOr([], path.join(dataDir, 'ongoing-prs.json')),
    readJsonOr([], path.join(dataDir, 'ongoing-coauthored-prs.json')),
    readJsonOr({}, path.join(dataDir, 'all-contributions.json')),
  ]);
  const feed = await fetchTrackerFeed(fetchOptions);
  const { records, feed: feedMeta } = mergeWorkbench({ tasks, issues, prs, coauthored, feed });
  const impact = computeImpact(records, contributions);
  return { records, impact, feed: feedMeta };
}

module.exports = {
  TRACKER_RAW_URL,
  fetchTrackerFeed,
  isValidTrackerShape,
  extractLinkedCodePr,
  extractIssueRefs,
  buildIssuePrLinks,
  deriveApproval,
  deriveReviewRequest,
  deriveReviewedNote,
  deriveBotPing,
  extractMentions,
  deriveLane,
  mergeWorkbench,
  computeImpact,
  loadMergedWorkbench,
};
