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
 *   - waitingReasons
 *                 plain-language strings — why this row is NOT in the action
 *                 lane when something definitive is holding it there (today:
 *                 a blocked merge state). Empty on action rows. The wording
 *                 comes from config, never a renderer.
 *   - linkedCodePr / upstream signals from the tracker cache
 *   - idleDays    how long a row has sat untouched; shown on the pill and
 *                 drives the 30d stalled fold. "Escalate" is reserved for the
 *                 upstream tracker's own timeline (code PR merged, author
 *                 reminded, still silent 14d) — this repo doesn't track who
 *                 reminded whom yet, so that word never appears here.
 *
 * Every rule here is repo-agnostic. The tracker feed only ever covered the
 * Mautic docs repos, so reading its `raw*` arrays directly used to be what
 * decided whether a row got a specific next step at all — every other repo fell
 * through to `nextStep: null`. The signals are now read from a NORMALIZED
 * activity view (see normalizeActivity) that the local fetch layer and the
 * tracker both feed, so an untracked repo derives the same steps from its own
 * cached reviews/comments/review requests. Upstream stays the preferred source
 * wherever both sides carry the same array.
 *
 * Resilience contract: the tracker feed can be down, rate-limited, or
 * schema-drifted — the merge NEVER fails the build. Failures degrade to the
 * last cached copy (data/tracker-cache.json) and finally to local-only
 * records, with `feed.degraded` explaining what happened. Signal derivation is
 * likewise fail-soft: a malformed record yields no signals, never a throw.
 */
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { GITHUB_USERNAME } = require('../config/config');
const { isAllowedBotLogin, isBotLogin } = require('../utils/bot-helpers');
const { extractLinkedCodePr } = require('../utils/github-helpers');
const { fetchTrackerTitleInfo } = require('../api/fetch-tracker-titles');

const TRACKER_RAW_URL =
  'https://raw.githubusercontent.com/adiati98/mautic-docs-prs-tracker/main/data/pr-cache.json';
const TRACKER_CACHE_FILE = path.join('data', 'tracker-cache.json');

/**
 * The docs team roster, in the same public repo the tracker feed comes from.
 * `educationTeam` is an array of GitHub logins. The roster belongs to that
 * team and changes without reference to this tool, so it is fetched every
 * build rather than copied into this codebase.
 */
const ROSTER_RAW_URL =
  'https://raw.githubusercontent.com/adiati98/mautic-docs-prs-tracker/main/maintainers.json';
const ROSTER_CACHE_FILE = path.join('data', 'tracker-roster-cache.json');

const STALLED_AFTER_DAYS = 30;
const REMIND_AFTER_DAYS = 7;

/**
 * Per-project docs housekeeping — see contents/docs-workflow-repos.js. Loaded
 * the same fail-soft way as the bot allowlist: a missing or broken file
 * switches these rules off rather than failing the build.
 */
function loadDocsWorkflow() {
  try {
    const config = require('../../contents/docs-workflow-repos');
    const list = (key) => (config[key] || []).map((r) => String(r).toLowerCase()).filter(Boolean);
    return {
      milestoneRepos: list('milestoneRepos'),
      mergeBlockedReason: String(config.mergeBlockedReason || '').trim(),
    };
  } catch (e) {
    return { milestoneRepos: [], mergeBlockedReason: '' };
  }
}

const DOCS_WORKFLOW = loadDocsWorkflow();

function matchesRepoList(repo, list) {
  const lower = String(repo || '').toLowerCase();
  if (!lower || !list.length) return false;
  return list.some((entry) => lower.includes(entry));
}

/**
 * Whether `repo` is one of the projects that tracks milestones. The repo list
 * is the ONLY thing that scopes the "Add milestone" chip — deliberately never
 * inferred from whether a record happens to carry a milestone field, since a
 * PR without one looks identical in a project that wants milestones and a
 * project that has never used them.
 */
function tracksMilestones(repo) {
  return matchesRepoList(repo, DOCS_WORKFLOW.milestoneRepos);
}

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
// Docs team roster: fetch → validate → cache → degrade
// ---------------------------------------------------------------------------

/** A valid roster is an object carrying an `educationTeam` array. */
function isValidRosterShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return Array.isArray(data.educationTeam);
}

function normalizeRoster(data) {
  return data.educationTeam.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

async function readRosterCacheFile() {
  try {
    const raw = await fs.readFile(ROSTER_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && isValidRosterShape(parsed.data)) return parsed;
  } catch (e) {
    /* no usable cache */
  }
  return null;
}

/**
 * Fetches the docs team roster with the same degradation discipline as the
 * tracker feed:
 *   live fetch OK  → { educationTeam, fetchedAt, degraded: false }
 *   fetch fails    → last cached copy, degraded: true, reason
 *   no cache       → EMPTY roster, degraded: true, reason
 *
 * The last line is the critical one. An empty roster switches the
 * outside-approval rule off entirely (see approvalIsDecisive), so a file that
 * failed to download behaves exactly like the code did before this rule
 * existed: every approval counts. A fetch failure must never read as a
 * judgement about anyone's content.
 */
async function fetchTeamRoster({ url = ROSTER_RAW_URL, timeoutMs = 10000 } = {}) {
  try {
    const res = await axios.get(url, { timeout: timeoutMs, responseType: 'json' });
    if (!isValidRosterShape(res.data)) {
      throw new Error('roster shape changed (schema drift)');
    }
    const fetchedAt = new Date().toISOString();
    try {
      await fs.mkdir(path.dirname(ROSTER_CACHE_FILE), { recursive: true });
      await fs.writeFile(ROSTER_CACHE_FILE, JSON.stringify({ fetchedAt, data: res.data }), 'utf8');
    } catch (e) {
      /* cache write is best-effort */
    }
    return {
      educationTeam: normalizeRoster(res.data),
      fetchedAt,
      degraded: false,
      reason: null,
    };
  } catch (err) {
    const cached = await readRosterCacheFile();
    if (cached) {
      return {
        educationTeam: normalizeRoster(cached.data),
        fetchedAt: cached.fetchedAt || null,
        degraded: true,
        reason: `live fetch failed (${err.message}); using cached roster`,
      };
    }
    return {
      educationTeam: [],
      fetchedAt: null,
      degraded: true,
      reason: `live fetch failed (${err.message}); no cached roster — every approval counts`,
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

function sameLogin(a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  return Boolean(x) && x === y;
}

/** Newest entry of a list by its `at` timestamp, or null for an empty list. */
function newestBy(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.reduce((a, b) => (new Date(a.at || 0) >= new Date(b.at || 0) ? a : b));
}

// ---------------------------------------------------------------------------
// Normalized activity — one shape, two sources
// ---------------------------------------------------------------------------

/**
 * Flattens the two feeds' activity into one shape every rule below reads:
 *
 *   reviews         [{ login, state, at }]
 *   comments        [{ login, at, mentions: [login] }]
 *   reviewRequests  [{ of, by, at }]
 *
 * The tracker's `raw*` arrays and the local fetch layer's cached
 * `reviews`/`comments`/`reviewRequests` carry the same facts under different
 * field names — normalizing them is what lets an untracked repo derive the same
 * next steps as a tracker-covered one. Upstream wins per-array when it actually
 * has entries: the tracker sees a repo's full history, while the local cache is
 * capped and can miss older activity. An EMPTY upstream array is not a source
 * of truth, so it falls through to the local array rather than blanking it.
 *
 * Comment bodies exist only upstream; the local cache stores the extracted
 * mention logins instead and discards the body, so mentions are read from
 * whichever side supplied the comment.
 */
function normalizeActivity(local, upstream) {
  const prefer = (up, loc) => (Array.isArray(up) && up.length ? up : Array.isArray(loc) ? loc : []);

  const rawReviews = prefer(upstream?.rawDocsReviews, local?.reviews);
  const reviews = rawReviews.filter(Boolean).map((r) => ({
    login: r.user?.login || r.login || null,
    state: r.state || null,
    at: r.submitted_at || r.submittedAt || null,
  }));

  const rawComments = prefer(upstream?.rawDocsComments, local?.comments);
  const comments = rawComments.filter(Boolean).map((c) => ({
    login: c.user?.login || c.login || null,
    at: c.created_at || c.createdAt || null,
    mentions: Array.isArray(c.mentions) ? c.mentions : extractMentions(c.body),
  }));

  const rawRequests = prefer(upstream?.rawReviewRequests, local?.reviewRequests);
  const reviewRequests = rawRequests.filter(Boolean).map((r) => ({
    of: r.requested_reviewer?.login || r.requestedReviewer || null,
    by: r.actor?.login || r.actor || null,
    at: r.created_at || r.createdAt || null,
  }));

  return { reviews, comments, reviewRequests };
}

function emptySignals() {
  return {
    activity: { reviews: [], comments: [], reviewRequests: [] },
    myLastReplyDays: null,
    mention: null,
    changesRequested: null,
    othersChangesRequested: null,
    pendingReview: null,
    waitingOn: null,
    noReviewerAssigned: false,
    conflict: null,
    milestoneMissing: false,
    mergeBlocked: false,
  };
}

/**
 * Everything the next-step rules need, derived once per record from the
 * normalized activity plus the PR-detail fields the local fetch layer caches
 * (requestedReviewers, mergeableState, baseRef, milestone).
 *
 *   myLastReplyDays     days since YOUR newest review or comment
 *   mention             newest @-mention of you nobody has heard back on
 *   changesRequested    newest CHANGES_REQUESTED you haven't answered
 *   pendingReview       an outstanding review request aimed at someone else
 *   waitingOn           who the ball actually sits with
 *   noReviewerAssigned  ready, non-draft, nobody asked to look
 *   conflict            ONLY when the merge state is definitively dirty
 *   milestoneMissing    milestone-tracking repo, no milestone set
 *   mergeBlocked        ONLY when the merge state is definitively blocked
 *
 * Wrapped so a drifted or malformed record produces no signals instead of a
 * throw — the merge must never fail the build.
 */
function deriveSignals(local, upstream, me, now) {
  try {
    return buildSignals(local, upstream, me, now || new Date());
  } catch (e) {
    return emptySignals();
  }
}

function buildSignals(local, upstream, me, now) {
  const activity = normalizeActivity(local, upstream);
  const signals = { ...emptySignals(), activity };
  const daysSince = (at) => (at ? Math.max(0, Math.floor(daysBetween(at, now))) : null);
  const everything = [...activity.reviews, ...activity.comments];

  // Your own newest word on the thread. Anything older than this you have, by
  // definition, already replied to.
  const mineAt = everything
    .filter((x) => sameLogin(x.login, me) && x.at)
    .map((x) => new Date(x.at).getTime())
    .filter((t) => !Number.isNaN(t));
  const myLatest = mineAt.length ? Math.max(...mineAt) : null;
  const answeredByMe = (at) => Boolean(myLatest && at && myLatest > new Date(at).getTime());
  signals.myLastReplyDays = myLatest ? daysSince(new Date(myLatest).toISOString()) : null;

  // A DIRECT @-mention of you, still unanswered. Genuine bots are skipped —
  // a CI bot naming you in a log line isn't a person waiting on a reply —
  // but ALLOW-LISTED bots (Promptless) are kept: their pings are real work.
  const mentionsOfMe = activity.comments.filter(
    (c) =>
      c.login &&
      !sameLogin(c.login, me) &&
      !isBotLogin(c.login) &&
      c.mentions.some((m) => sameLogin(m, me))
  );
  const latestMention = newestBy(mentionsOfMe);
  if (latestMention && !answeredByMe(latestMention.at)) {
    signals.mention = { by: latestMention.login, days: daysSince(latestMention.at) };
  }

  // Changes requested and not yet answered. Someone else's change request only
  // — your own is the "you reviewed, author hasn't replied" case instead.
  const latestChanges = newestBy(
    activity.reviews.filter(
      (r) => r.state === 'CHANGES_REQUESTED' && r.login && !sameLogin(r.login, me)
    )
  );
  if (latestChanges && !answeredByMe(latestChanges.at)) {
    signals.changesRequested = { by: latestChanges.login, days: daysSince(latestChanges.at) };
  }

  // Who else is on the hook for a review. `requestedReviewers` is GitHub's LIVE
  // pending list (it empties the moment someone reviews), so it's the stronger
  // signal; the request events supply the date it was asked. A request whose
  // reviewer has since spoken is fulfilled and drops out.
  const pendingLogins = (
    Array.isArray(local?.requestedReviewers) ? local.requestedReviewers : []
  ).filter((l) => l && !sameLogin(l, me));
  const spokeAfter = (login, at) =>
    everything.some(
      (x) => sameLogin(x.login, login) && x.at && at && new Date(x.at) > new Date(at)
    );
  const openRequests = activity.reviewRequests.filter(
    (r) => r.of && !sameLogin(r.of, me) && !spokeAfter(r.of, r.at)
  );
  const stillPending = openRequests.filter((r) => pendingLogins.some((l) => sameLogin(l, r.of)));
  const chosen = newestBy(stillPending.length ? stillPending : openRequests);

  // A newer informal ping — an @-mention asking a specific person to weigh
  // in, still unanswered by them — can supersede a stale formal review
  // request nobody ever withdrew. Without this, a months-old "Request
  // review" click that the reviewer never fulfilled permanently outranks
  // someone being asked again and again through plain comments instead,
  // even once the real ask has clearly moved on to a different person.
  const openPings = activity.comments
    .filter((c) => c.login && !isBotLogin(c.login))
    .flatMap((c) =>
      c.mentions
        .filter((m) => m && !sameLogin(m, me) && !sameLogin(m, c.login))
        .map((m) => ({ of: m, at: c.at }))
    )
    .filter((p) => !spokeAfter(p.of, p.at));
  const latestPing = newestBy(openPings);

  const timedAsk = newestBy([chosen, latestPing].filter(Boolean));
  if (timedAsk) {
    signals.pendingReview = { of: timedAsk.of, days: daysSince(timedAsk.at) };
  } else if (pendingLogins.length) {
    // Named on the live list but no request event survived the cache cap —
    // we can still say WHO, just not when. The date clause gets dropped.
    signals.pendingReview = { of: pendingLogins[0], days: null };
  }

  // Failing a pending reviewer, the ball sits with whoever last reviewed.
  const latestOtherReviewer = newestBy(
    activity.reviews.filter((r) => r.login && !sameLogin(r.login, me) && !isBotActor(r.login))
  );
  signals.waitingOn = signals.pendingReview?.of || latestOtherReviewer?.login || null;

  // A fellow reviewer already asked for changes and the PR's OWN AUTHOR
  // hasn't addressed it — distinct from `changesRequested` above, which
  // tracks whether YOU (as the PR's author) have replied. This is for PRs
  // you're only reviewing: your own still-pending review request isn't the
  // real blocker while someone else's change request sits unanswered by the
  // author, so it shouldn't read as urgently as a first, untouched request.
  const latestChangesForAuthor = newestBy(
    activity.reviews.filter(
      (r) =>
        r.state === 'CHANGES_REQUESTED' &&
        r.login &&
        !sameLogin(r.login, me) &&
        !sameLogin(r.login, local?.author)
    )
  );
  if (latestChangesForAuthor && !spokeAfter(local?.author, latestChangesForAuthor.at)) {
    signals.othersChangesRequested = {
      by: latestChangesForAuthor.login,
      days: daysSince(latestChangesForAuthor.at),
    };
  }

  // The PR-detail fields ride along with the widened activity cache, so their
  // presence marks a record we can reason about. Without them, "nobody is
  // assigned" and "no milestone" are unknowns, not facts — stay quiet.
  const hasPrDetail =
    Boolean(local) &&
    (local.mergeableState !== undefined ||
      local.requestedReviewers !== undefined ||
      local.milestone !== undefined);

  signals.noReviewerAssigned =
    hasPrDetail &&
    local.isDraft !== true &&
    pendingLogins.length === 0 &&
    activity.reviews.length === 0 &&
    local.hasFormalReview !== true;

  // Only DEFINITIVE merge states count. GitHub reports `unknown` (and this
  // field reports null) while it is still computing mergeability, so a value
  // that isn't one of the two read here stays silent rather than being guessed
  // at — and there is nothing to retry, the next build reads a fresh value
  // anyway. That deliberate rule is unchanged; `blocked` joins `dirty` because
  // GitHub states it just as definitively, not because we infer it.
  //
  //   dirty    the branch conflicts with its base — the AUTHOR must rebase
  //   blocked  branch protection isn't satisfied (required reviews missing,
  //            required checks failing or still running) — nobody can merge
  //            this yet, so it is not a job waiting on anyone here
  const mergeState = String(local?.mergeableState || '').toLowerCase();
  if (mergeState === 'dirty') {
    signals.conflict = { base: local.baseRef || null };
  }
  // Gated on the reason being configured: the rule may only move a row when it
  // can also print WHY on that row. Blank the reason in config and the rule is
  // off, rather than silently relocating rows with nothing to show for it.
  signals.mergeBlocked = Boolean(DOCS_WORKFLOW.mergeBlockedReason) && mergeState === 'blocked';

  signals.milestoneMissing = hasPrDetail && tracksMilestones(local?.repo) && !local.milestone;

  return signals;
}

/**
 * Everyone who APPROVED this row, from either side of the join. Dismissed
 * reviews are deliberately excluded: a dismissed approval is not a standing
 * verdict on the content, so it must not be counted as one either way.
 */
function collectApprovers(local, activity) {
  const logins = [];
  if (local && (local.reviewState === 'APPROVED' || local.status === 'APPROVED') && local.approvedBy) {
    logins.push(String(local.approvedBy).trim());
  }
  for (const r of activity && Array.isArray(activity.reviews) ? activity.reviews : []) {
    if (r.state === 'APPROVED' && r.login) logins.push(r.login);
  }
  return logins.filter(Boolean);
}

/**
 * Whether an approval on this row means the CONTENT has been checked.
 *
 * An operator approving a docs PR from inside the education team vouches for
 * wording and style — not for whether the content is accurate. Only an
 * approval from OUTSIDE that team (the code PR's author, or another outside
 * reviewer) means the work has genuinely been verified. Routing an in-team
 * approval into the "approved, heading to merge" lane overstates the claim,
 * and that lane is published, so the overstatement is public.
 *
 * FOUR ways this returns true — i.e. behaves exactly as the code did before
 * the rule existed. Each one is deliberate:
 *
 *   - the repo is outside the tracker's scope. An education-team approval
 *     means nothing in an unrelated org, and applying the rule everywhere
 *     would quietly demote approvals from projects it was never about.
 *   - the roster is empty. That is what a failed fetch with no cached copy
 *     looks like (see fetchTeamRoster), and a download failure must never be
 *     dressed up as a judgement about someone's content.
 *   - nobody identifiable approved — e.g. only a DISMISSED review survives,
 *     which names an approver but carries no standing approval. Unknown is
 *     not the same as in-team, so the row keeps the lane it has today.
 *   - at least one approver is from outside the team. One outside check is
 *     enough; the content has been looked at by someone who can vouch for it.
 */
function approvalIsDecisive(approvers, { educationTeam = [], inTrackerScope = false } = {}) {
  if (!inTrackerScope) return true;
  if (!educationTeam.length) return true;
  if (!approvers.length) return true;
  return approvers.some((login) => !educationTeam.some((member) => sameLogin(member, login)));
}

/**
 * Latest approval visible from either side of the join, plus whether any
 * substantive (non-bot) comment landed AFTER that approval — the "note since
 * approval — take a look" signal.
 *
 * `context` carries the docs-team roster and whether this row's repo is one
 * the tracker covers; together they decide `verified` — see approvalIsDecisive.
 * Omit it and every approval is treated as decisive, which is what an absent
 * or unfetchable roster must look like.
 */
function deriveApproval(local, activity, context = {}) {
  let state = null;
  let by = null;
  let approvedAt = null;
  let dismissed = false;
  let dismissedAt = null;

  if (local && (local.reviewState === 'APPROVED' || local.status === 'APPROVED')) {
    state = 'APPROVED';
    by = local.approvedBy ? String(local.approvedBy).trim() : null;
  }

  // Read the latest APPROVED/DISMISSED review from the normalized activity. A
  // dismissed approval no longer shows as APPROVED in GitHub's reviews list —
  // it flips to DISMISSED while still carrying the original approver's login —
  // so filtering to APPROVED alone silently drops it. We keep it and mark it
  // `dismissed` so the lane can route it to "re-request" instead.
  const reviews = activity && Array.isArray(activity.reviews) ? activity.reviews : [];
  const decisive = reviews.filter((r) => r.state === 'APPROVED' || r.state === 'DISMISSED');
  if (decisive.length > 0) {
    const latest = newestBy(decisive);
    // A change request landing AFTER the last approval/dismissal supersedes
    // it — the PR is no longer approved (the reviewed-again case, e.g. an
    // approval dismissed on push and then changes requested). Drop the
    // approval and let the turn-based logic take over.
    const supersededByChanges = reviews.some(
      (r) => r.state === 'CHANGES_REQUESTED' && new Date(r.at || 0) > new Date(latest.at || 0)
    );
    if (supersededByChanges) {
      state = null;
      by = null;
      approvedAt = null;
    } else {
      state = 'APPROVED';
      approvedAt = latest.at || null;
      dismissed = latest.state === 'DISMISSED';
      dismissedAt = dismissed ? latest.at || null : null;
      // A dismissed review names the approver whose approval was dropped;
      // prefer it so "re-request from <login>" points at the right person.
      by = dismissed ? latest.login || by : by || latest.login || null;
    }
  }

  if (!state) return null;

  // "Note since approval" only applies to a live approval — a dismissed one
  // already routes to "re-request", which supersedes any later note.
  let noteSince = false;
  if (!dismissed && approvedAt) {
    const comments = activity && Array.isArray(activity.comments) ? activity.comments : [];
    noteSince = comments.some(
      (c) => new Date(c.at || 0) > new Date(approvedAt) && !isBotLogin(c.login)
    );
  }

  // Who approved is recorded either way — the row still shows "approved by X"
  // as context. `verified` only decides whether that approval is allowed to
  // route the row into the "approved, heading to merge" lane.
  const verified = approvalIsDecisive(collectApprovers(local, activity), context);

  return { state, by, approvedAt, noteSince, dismissed, dismissedAt, verified };
}

/**
 * A LIVE formal review request aimed at YOU (the workbench owner) — the
 * normalized review requests, filtered to `of === me`. Team requests and
 * requests aimed at other reviewers are ignored: this is the "you've been
 * pinged to review" signal, the review-side equivalent of an @-mention.
 * Returns the most recent such LIVE request, or null.
 *
 * Liveness is the crux. Review requests are historical GitHub timeline events
 * that PERSIST after the request is fulfilled: GitHub clears the live
 * `requested_reviewers` the instant you review, but both the tracker cache and
 * the local activity cache keep the `review_requested` event for good — which
 * is exactly why we can see it at all. So a request counts as live ONLY when
 * you have not already answered it: no review or comment of yours is dated
 * after the request was made. A later comment by someone ELSE does not revive a
 * request you already handled — only your own activity fulfills it.
 */
function deriveReviewRequest(activity, me) {
  if (!activity || !Array.isArray(activity.reviewRequests)) return null;
  const mine = activity.reviewRequests.filter((r) => sameLogin(r.of, me));
  if (mine.length === 0) return null;
  const latest = newestBy(mine);

  // Fulfilled? A review or comment of MINE dated after the request was made.
  const requestedAt = new Date(latest.at || 0);
  const answeredByMe = [...activity.reviews, ...activity.comments].some(
    (x) => sameLogin(x.login, me) && new Date(x.at || 0) > requestedAt
  );
  if (answeredByMe) return null;

  return { of: latest.of || null, by: latest.by || null, at: latest.at || null };
}

/**
 * Muted "someone reviewed this" context: when a human other than you left a
 * review (a comment or a change request) but there's no approval to show,
 * name the latest such reviewer. Purely informational — it NEVER changes the
 * lane. Suppressed when an approval (live or dismissed) is already surfaced,
 * and it skips your own reviews and bot reviews (incl. allow-listed bots).
 */
function deriveReviewedNote(activity, approval, me) {
  if (approval) return null;
  if (!activity || !Array.isArray(activity.reviews)) return null;
  const reviews = activity.reviews.filter((r) => {
    if (!r.login || sameLogin(r.login, me) || isBotActor(r.login)) return false;
    return r.state === 'COMMENTED' || r.state === 'CHANGES_REQUESTED';
  });
  if (reviews.length === 0) return null;
  const latest = newestBy(reviews);
  return latest.login ? { by: latest.login } : null;
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
function deriveBotPing(activity, local, me) {
  const author = String(local?.author || '').toLowerCase();
  const lastActor = String(
    local?.lastActor ||
      (typeof local?.user === 'object' ? local?.user?.login : local?.user) ||
      ''
  ).toLowerCase();
  if (!author || !isAllowedBotLogin(author) || lastActor !== author) return null;

  // The bot's most recent comment — where a "Thanks @you…" ping lives.
  const comments = Array.isArray(activity?.comments) ? activity.comments : [];
  const latestComment = newestBy(comments.filter((c) => sameLogin(c.login, author)));
  const mentions = latestComment ? latestComment.mentions : [];
  const mentionsMe = mentions.some((m) => sameLogin(m, me));

  // Who else did it ping? Prefer an @-mention of another human in the latest
  // comment; fall back to a review request aimed at someone other than you.
  let of = mentions.find((m) => !sameLogin(m, me) && !sameLogin(m, author)) || null;
  if (!of) {
    const requests = Array.isArray(activity?.reviewRequests) ? activity.reviewRequests : [];
    const others = requests.filter((r) => r.of && !sameLogin(r.of, me));
    const latestReq = newestBy(others);
    if (latestReq) of = latestReq.of || null;
  }

  return { mentionsMe, of };
}

// ---------------------------------------------------------------------------
// Lane + next-step derivation (the tracker's model, generalized)
// ---------------------------------------------------------------------------

/**
 * The "nobody can move this yet" holds on a row, as plain-language strings.
 *
 * The wording comes from config (contents/docs-workflow-repos.js), never from
 * a renderer: it is a judgement about what a GitHub state means to a reader,
 * and both generators have to say the same thing.
 */
function holdsFor(signals) {
  const holds = [];
  if (signals.mergeBlocked) {
    holds.push(DOCS_WORKFLOW.mergeBlockedReason);
  }
  return holds;
}

/**
 * Whether something on this row names the OWNER specifically, rather than the
 * board inferring "your turn" from whoever moved last. A hold never overrides
 * one of these — being asked by name survives the PR being unmergeable:
 *
 *   - an @-mention of you nobody has heard back on, including one from an
 *     allow-listed bot
 *   - a review request aimed at you. This one matters most: `blocked` very
 *     often means the missing requirement is an approving review, and if you
 *     are the requested reviewer then YOU are the block. Demoting that would
 *     hide exactly the work this board exists to surface.
 *   - changes requested on a PR of yours and still unanswered — a blocked
 *     merge state is the CONSEQUENCE of that, not a separate excuse
 *   - the linked code PR having merged or closed, which is decisive
 *   - a note left after approval, and missing housekeeping (a milestone is
 *     owed whatever the merge is waiting on)
 *   - assigned issues, which have no merge state and no PR to park
 */
function hasNamedAsk(record, signals, botPingSignal) {
  if (record.relationship === 'assigned issue') return true;
  if (signals.mention) return true;
  if (botPingSignal && botPingSignal.mentionsMe) return true;
  if (record.reviewRequest || record.status === 'Request review') return true;
  if (
    (record.relationship === 'authored' || record.relationship === 'co-authoring') &&
    signals.changesRequested
  ) {
    return true;
  }
  if (record.linkedCodePrState === 'merged' || record.linkedCodePrState === 'closed') return true;
  if (record.approval && record.approval.noteSince) return true;
  if (signals.milestoneMissing) return true;
  return false;
}

/**
 * Where a held row lands: the WAITING lane, and nowhere else.
 *
 * "Needs your action" asserts a job is owed to the owner, and while GitHub
 * reports the merge blocked that assertion is false — the row is parked on
 * required reviews or required checks, neither of which the owner can clear by
 * working on this row. Waiting on others already reads *your part is done —
 * awaiting review, or blocked on a linked code PR*, which is these rows
 * exactly.
 *
 * Three deliberate limits:
 *
 *   - It only ever moves rows OUT of the action lane. Nothing is promoted, and
 *     ready / waiting / stalled / bot rows keep the lane they have today. Where
 *     a signal doesn't clearly say otherwise, the row stays where it was.
 *   - It never fires against a named ask (see hasNamedAsk).
 *   - A demoted row stops at waiting and is NOT folded on to stalled, however
 *     old it is. The stalled fold is collapsed by default and reads *decide:
 *     nudge or close*; a row we just established is held on something outside
 *     the owner's control must not be hidden behind that. Rows that were
 *     already stalled stay stalled — they simply gain the reason chip.
 *
 * The instruction the row used to carry is dropped rather than reworded: it
 * asserted an action that isn't owed. The hold's own reason chip replaces it,
 * so the row still says why it is sitting there.
 */
function applyHold(placed, record, signals, botPingSignal) {
  if (placed.lane !== 'action') return placed;
  if (hasNamedAsk(record, signals, botPingSignal)) return placed;
  return { ...placed, lane: 'waiting', ball: 'Watching', nextStep: null };
}

/**
 * Assigns lane, ball label, and nextStep for one merged record.
 *
 * Precedence, first match wins:
 *   1 bot lane          2 assigned issue        3 approval states
 *   3a linked code PR   4 direct ping at me      5 changes requested
 *   6 conflicts         7 turn-based fallback    8 stalled fold
 *   9 definitive holds
 *
 * 1–3, 3a, and 8 live in laneFor; 4–7 live in deriveTurn. Rule 3a only fires
 * for a merged or closed-unmerged linked code PR — an open or unknown (null)
 * state falls straight through to the turn-based reading unchanged. Rules 4–6
 * only ever choose the WORDING — the lane and ball a row lands in are decided
 * by the turn logic and by the staleness fold exactly as before.
 *
 * Rule 9 runs after all of that, and only ever SUBTRACTS: a row the ladder put
 * in the action lane is moved to waiting when something definitive says no
 * action is owed yet (see applyHold). It cannot promote, and it cannot fire
 * against a signal that named the owner.
 *
 * The missing-milestone reminder is deliberately NOT in that ladder: it appends
 * (see withMilestone), so it can never win a place in the order and can never
 * be crowded out of one either.
 *
 * Staleness runs LAST among 1–8, and only over rows the turn logic left with
 * someone else. Age is not evidence that a row is dead — it's evidence of how
 * overdue it is — so it can never override whose turn it is. Ordering it before
 * the turn logic is what used to bury live work in a folded lane reading "nudge
 * or close": a review whose author replied 40 days ago, a review request aimed
 * at you 45 days ago, and your own PR carrying month-old maintainer feedback
 * all read as "stale" when every one of them was waiting on YOU. Assigned
 * issues were carved out of that rule first (an issue you haven't started has
 * nobody touching it, so it always ages past the threshold); this generalizes
 * the carve-out to every path where the ball is yours. Age still shows: the row
 * carries idleDays (rendered on the pill), and the action lane sorts
 * oldest-first.
 */
function deriveLane(record, me, botPingSignal = null, signals = emptySignals()) {
  const placed = laneFor(record, me, botPingSignal, signals);
  // The bot lane is folded away precisely so it carries no instructions — and,
  // by the same token, no explanations either.
  const quiet = placed.lane === 'bot';
  const holds = quiet ? [] : holdsFor(signals);
  const result = holds.length ? applyHold(placed, record, signals, botPingSignal) : placed;

  // Surfaced as its own field, never spliced into nextStep, so renderers can
  // draw it as a separate chip — the way the upstream docs-PR tracker renders
  // "Add milestone" as a chip alongside (and ahead of) the review chip rather
  // than folding it into one sentence.
  return {
    ...result,
    milestoneMissing: signals.milestoneMissing && !quiet,
    // Shown wherever the hold is actually holding the row — which is every
    // lane except action. Lane placement alone doesn't say WHY a row moved,
    // and a board published so its conclusions can be checked has to show its
    // reasoning. Suppressed on action rows on purpose: there a named ask won,
    // so the hold's reason would sit next to, and contradict, the instruction
    // printed beside it.
    waitingReasons: result.lane === 'action' ? [] : holds,
  };
}

function laneFor(record, me, botPingSignal, signals) {
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
    // An approval from inside the education team vouches for wording and
    // style, not for whether the content is right — so it cannot carry the row
    // into the "approved, heading to merge" lane on its own. That lane is one
    // of only two published on the live site, so the overstatement is public.
    //
    // Placed AFTER the two branches above on purpose. A dismissed approval is
    // not counted for verification at all (see collectApprovers), and a note
    // left after the approval is a real ask the owner owes whoever wrote it —
    // neither may be swallowed by this. The approver is still named on the row.
    if (approval.verified === false) {
      return {
        lane: 'waiting',
        ball: 'Waiting',
        nextStep: 'Approved by the education team — waiting on an outside review',
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

  // Rule 3a — the linked code PR's fate is decisive: merged means the docs are
  // now actionable, closed-unmerged means this docs PR has nothing left to
  // track. An 'open' or unknown (null) state carries no verdict, so it falls
  // straight through to the turn-based reading below, unchanged.
  if (record.linkedCodePrState === 'merged') {
    return { lane: 'action', ball: 'Take Action', nextStep: 'Code PR merged — review the docs now' };
  }
  if (record.linkedCodePrState === 'closed') {
    return {
      lane: 'action',
      ball: 'Take Action',
      nextStep: 'Code PR closed unmerged — close this docs PR',
    };
  }

  // Whose turn is it? Resolved BEFORE staleness (see the note above), so a row
  // where the ball is yours keeps its action lane no matter how old it is.
  const turn = deriveTurn(record, me, botPingSignal, signals);
  if (turn.lane === 'action') return turn;

  // Waiting on someone else, and untouched for a month — fold it away. The
  // contextual signals the turn logic derived have to survive the demotion:
  // botPing is the only one deriveLane owns (approval and reviewedNote already
  // live on the record), and without it a stalled row loses its explanation of
  // who it's actually waiting on.
  if (idleDays >= STALLED_AFTER_DAYS) {
    return {
      lane: 'stalled',
      ball: 'Stale',
      nextStep: `Idle ${Math.floor(idleDays)}d — decide: nudge or close`,
      ...(turn.botPing ? { botPing: turn.botPing } : {}),
    };
  }

  return turn;
}

/**
 * Rule 4 — a DIRECT ping at you, which outranks every turn-based reading of the
 * row. An @-mention nobody has heard back on is the sharpest signal the board
 * has, and a formal review request aimed at you is its review-side twin.
 * Returns null when nothing is pointed at you.
 *
 * The review-request half stays scoped to rows you're reviewing: "review it"
 * is only an instruction when reviewing is the job. The mention half applies
 * everywhere — being named is being asked, whoever's PR it is.
 */
function directPingStep(record, signals) {
  if (signals.mention && signals.mention.by) {
    const { by, days } = signals.mention;
    return days == null
      ? `${by} mentioned you — reply`
      : `${by} mentioned you ${days}d ago — reply`;
  }
  if (
    record.relationship === 'reviewing' &&
    (record.status === 'Request review' || Boolean(record.reviewRequest))
  ) {
    // Someone else already asked for changes and the author hasn't moved —
    // your pending request isn't what's actually blocking this. Stays an
    // instruction (never silently demoted to Watching — some projects
    // genuinely want every requested reviewer's independent pass regardless
    // of what others already said), but describes the real state instead of
    // issuing a flat "review it" that may not be true yet.
    if (signals.othersChangesRequested) {
      const { by, days } = signals.othersChangesRequested;
      return `${by} requested changes ${days}d ago — not yet addressed`;
    }
    return 'Review requested — review it';
  }
  return null;
}

/**
 * Rule 5 — changes requested and still unanswered. Scoped to work you're on the
 * hook for: on a PR you're merely reviewing, someone else's change request is
 * the AUTHOR's to address, and telling you to "address the feedback" would hand
 * you a job that isn't yours. Your own change request on a row you review is
 * covered by the "you reviewed, author hasn't replied" step instead.
 */
function changesRequestedStep(record, signals) {
  if (record.relationship !== 'authored' && record.relationship !== 'co-authoring') return null;
  const cr = signals.changesRequested;
  if (!cr || !cr.by) return null;
  return `Changes requested by ${cr.by} — address the feedback`;
}

/**
 * Rule 6 — a definitively conflicted branch. Same scoping as rule 5: rebasing
 * is the author's move, not the reviewer's. The base branch name is a clause
 * that gets dropped rather than printed empty when the fetch couldn't read it.
 */
function conflictStep(record, signals) {
  if (record.relationship !== 'authored' && record.relationship !== 'co-authoring') return null;
  if (!signals.conflict) return null;
  return signals.conflict.base
    ? `Conflicts with ${signals.conflict.base} — rebase needed`
    : 'Conflicts — rebase needed';
}

/**
 * The turn-based half of deriveLane: given a row that isn't a bot, an assigned
 * issue, or approved, decides whether the ball is YOURS (action) or someone
 * else's (waiting), and what the remaining step is. Split out so deriveLane can
 * run it ahead of the staleness rule — see the precedence note there.
 *
 * Lane and ball come from the turn reading alone. The wording is then chosen by
 * precedence — direct ping (4), changes requested (5), conflicts (6), the
 * turn's own step (7), and finally milestone housekeeping — so a sharper reason
 * can replace a vaguer one WITHOUT ever moving a row between lanes.
 */
function deriveTurn(record, me, botPingSignal = null, signals = emptySignals()) {
  return promoteForHousekeeping(turnFor(record, me, botPingSignal, signals), signals);
}

/**
 * Missing housekeeping — a milestone — is YOUR move, so the row cannot sit in
 * a lane that means the opposite. "Waiting
 * on others" reads *your part is done — awaiting review*, and "Stalled" reads
 * *needs a decision: nudge or close*; both are false while something is still
 * owed, and Stalled additionally folds the row shut so the chip goes unread.
 *
 * Promoting here rather than in deriveLane is what makes the staleness fold
 * skip these rows for free: that fold only ever runs over rows the turn logic
 * left with someone ELSE, so a row promoted to action keeps its lane however
 * old it is — the same "turn beats age" rule assigned issues and review pings
 * already rely on.
 *
 * The approved lane is deliberately untouched: it already reads *bring it
 * home — still needs a final review or a maintainer nudge before it ships*, so
 * one more thing to do before shipping is exactly what that lane is for, and
 * the Approved pill carries information Take Action would throw away.
 *
 * Drafts are NOT exempt. The upstream docs-PR tracker triages them the other
 * way round — its `needs-label-and-milestone` category fires precisely ON
 * drafts, and carries "act" severity rather than "triage" — because a draft is
 * exactly when the milestone is cheapest to set, before anyone is waiting on
 * the merge.
 */
function promoteForHousekeeping(turn, signals) {
  if (!signals.milestoneMissing) return turn;
  if (turn.lane !== 'waiting') return turn;
  return { ...turn, lane: 'action', ball: 'Take Action' };
}

function turnFor(record, me, botPingSignal, signals) {
  // An allow-listed bot (Promptless) authored this AND pushed last — its
  // "reply" is automated, so route by who it pinged instead of the human
  // "author replied" step (which we must never emit for a bot). A ping aimed
  // ONLY at someone else is their turn (waiting), recorded as botPing so the
  // board can show "Promptless pinged <who>" — and nothing below applies,
  // because none of it is addressed to you.
  if (botPingSignal) {
    const pingsOnlyOthers =
      !botPingSignal.mentionsMe && !Boolean(record.reviewRequest) && Boolean(botPingSignal.of);
    if (pingsOnlyOthers) {
      return {
        lane: 'waiting',
        ball: 'Watching',
        nextStep: null,
        botPing: { by: record.author, of: botPingSignal.of },
      };
    }
    // Pinged AT you: your turn. The wording comes from the ping itself — who
    // named you and when, or the review it asked you for — never from the
    // human "author replied" step, which would credit a push to a person.
    return { lane: 'action', ball: 'Take Action', nextStep: directPingStep(record, signals) };
  }

  const turn = turnReading(record, me, signals);

  const nextStep =
    directPingStep(record, signals) ??
    changesRequestedStep(record, signals) ??
    conflictStep(record, signals) ??
    turn.nextStep;

  return { ...turn, nextStep: nextStep ?? null };
}

/** Rule 7 — whose turn is it, and what does that alone imply? */
function turnReading(record, me, signals) {
  const { relationship, linkedCodePr } = record;
  const lastActor = String(record.lastActor || '').toLowerCase();
  const prAuthor = String(record.author || '').toLowerCase();
  const isMe = lastActor === me;
  const isAuthor = lastActor && lastActor === prAuthor;
  const actorIsBot = !isAllowedBotLogin(lastActor) && (record.isLastActorBot || isBotLogin(lastActor));
  // How long since you last spoke. The activity trail is the precise answer;
  // row age is the fallback when no cached activity carries your name.
  const sinceMyReply = signals.myLastReplyDays ?? Math.floor(record.idleDays);

  if (relationship === 'reviewing') {
    // You reviewed and nobody came back. Still someone else's move, but the
    // row can now say WHY it's sitting there instead of showing a bare pill.
    if (isMe) {
      return {
        lane: 'waiting',
        ball: 'Waiting',
        nextStep: `You reviewed ${sinceMyReply}d ago — author hasn't replied`,
      };
    }
    if (isAuthor) {
      return {
        lane: 'action',
        ball: 'Take Action',
        nextStep: 'Author replied — review the latest changes',
      };
    }
    // A formal review request aimed at you is a "your turn" ping — treat it
    // like an @-mention. It lands in the action lane; the pill already carries
    // how long it's been idle. This generalizes the local `status === 'Request
    // review'` flag to the cached review-request events, so any repo's rows
    // get the same signal, not just tracker-covered ones.
    if (record.status === 'Request review' || Boolean(record.reviewRequest)) {
      return {
        lane: 'action',
        ball: 'Take Action',
        nextStep: 'Review requested — review it',
      };
    }
    // A third party moved last: the outstanding review belongs to someone
    // else. Name them and say how long they've had it — or stay silent, since
    // "waiting on nobody in particular" is what the pill already says.
    return { lane: 'waiting', ball: 'Watching', nextStep: waitingOnReviewStep(signals) };
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
    // Your ball has been passed on. If it was never passed to anyone — ready,
    // non-draft, nobody asked to look — that IS the remaining step; otherwise
    // name who you're waiting on, dropping the clause when nobody resolves.
    if (signals.noReviewerAssigned) {
      return {
        lane: 'waiting',
        ball: 'Waiting',
        nextStep: 'No reviewer assigned — request one',
      };
    }
    return {
      lane: 'waiting',
      ball: 'Waiting',
      nextStep: signals.waitingOn
        ? `You replied ${sinceMyReply}d ago — waiting on ${signals.waitingOn}`
        : `You replied ${sinceMyReply}d ago`,
    };
  }
  if (actorIsBot) {
    // An automated push on your own PR. Nothing to reply to, but the diff
    // moved under you, so the honest step is to look at it again.
    return {
      lane: 'waiting',
      ball: 'Watching',
      nextStep: record.lastActor
        ? `${record.lastActor} pushed ${Math.floor(record.idleDays)}d ago — re-check the changes`
        : null,
    };
  }
  return {
    lane: 'action',
    ball: 'Take Action',
    nextStep: record.hasFormalReview
      ? 'Address the review feedback'
      : 'Reply to the discussion, then request review',
  };
}

/** "Waiting on <login> to review — requested Nd ago", clauses dropped when a
 * login or a date can't be resolved. No login means no step: an unattributed
 * "waiting on someone" says nothing the Watching pill hasn't already said. */
function waitingOnReviewStep(signals) {
  const pending = signals.pendingReview;
  if (!pending || !pending.of) return null;
  return pending.days == null
    ? `Waiting on ${pending.of} to review`
    : `Waiting on ${pending.of} to review — requested ${pending.days}d ago`;
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
 * @param {object} [input.titles]  tracker-only enrichment, keyed by
 *                                 "owner/repo#number" → { title, linkedCodePr }
 *                                 (see fetchTrackerTitleInfo). Never required —
 *                                 an absent key just keeps today's null-title
 *                                 fallback.
 * @param {object} [input.roster]  { educationTeam: [login] } from
 *                                 fetchTeamRoster. Never required — an absent
 *                                 or empty roster treats every approval as
 *                                 decisive, exactly as before the rule existed.
 * @returns {{ records: Array, feed: object }}
 */
function mergeWorkbench({
  tasks = [],
  issues = [],
  prs = [],
  coauthored = [],
  feed,
  username,
  now,
  titles = {},
  roster = {},
}) {
  const me = String(username || GITHUB_USERNAME || '').toLowerCase();
  const nowDate = now || new Date();
  const tracker = (feed && feed.data) || {};

  const educationTeam = (Array.isArray(roster.educationTeam) ? roster.educationTeam : [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);

  // Which repos the tracker actually covers, read off the feed's own keys
  // rather than listed here. That keeps the outside-approval rule scoped to
  // the projects it is about without this repo holding a second copy of the
  // tracker's repo list — and when the feed degrades to empty, the scope is
  // empty too, so every approval counts exactly as it does today.
  const trackerRepos = new Set(
    Object.keys(tracker)
      .map((key) => key.split('#')[0].toLowerCase())
      .filter(Boolean)
  );
  const approvalContext = (repo) => ({
    educationTeam,
    inTrackerScope: trackerRepos.has(String(repo || '').toLowerCase()),
  });

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
    const signals = deriveSignals(local, upstream, me, nowDate);
    const approval = deriveApproval(local, signals.activity, approvalContext(local.repo));
    const reviewRequest = deriveReviewRequest(signals.activity, me);
    const reviewedNote = deriveReviewedNote(signals.activity, approval, me);
    const botPingSignal = deriveBotPing(signals.activity, local, me);

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
      // Set by deriveLane. Always present so renderers can rely on them.
      milestoneMissing: false,
      waitingReasons: [],
      linkedCodePr: linkedCodePr
        ? { ref: linkedCodePr, hasActivity: Boolean(upstream && upstream.codeUpdatedAt) }
        : null,
      linkedCodePrState: local.linkedCodePrState ?? null,
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

    Object.assign(record, deriveLane(record, me, botPingSignal, signals));
    return record;
  });

  // Tracker-only rows: the tracker watches them but they aren't in the local
  // workbench (e.g. someone else's docs PR you triage as maintainer). The
  // cache itself carries activity, not titles — `titles` is a separate,
  // optional enrichment (fetchTrackerTitleInfo/loadMergedWorkbench) that
  // looks the PR up directly; without it, renderers fall back to repo#number.
  for (const [key, upstream] of Object.entries(tracker)) {
    if (matchedKeys.has(key)) continue;
    const [repo, number] = key.split('#');
    const titleInfo = titles[key] || null;
    const signals = deriveSignals(null, upstream, me, nowDate);
    // A tracker-only row is in the tracker's scope by definition.
    const approval = deriveApproval(null, signals.activity, approvalContext(repo));
    const reviewRequest = deriveReviewRequest(signals.activity, me);
    const reviewedNote = deriveReviewedNote(signals.activity, approval, me);
    const effectiveDate = upstream.docsUpdatedAt || null;
    const idleDays = effectiveDate ? Math.max(0, daysBetween(effectiveDate, nowDate)) : 0;

    const record = {
      key,
      source: 'tracker',
      title: titleInfo?.title || null,
      url: `https://github.com/${repo}/pull/${number}`,
      repo,
      relationship: 'reviewing',
      labels: [],
      // The tracker cache stores activity arrays, not PR state, so draft
      // state comes from the same title-enrichment fetch as `title` above.
      isDraft: titleInfo?.isDraft === true,
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
      milestoneMissing: false,
      waitingReasons: [],
      linkedCodePr: titleInfo?.linkedCodePr
        ? { ref: titleInfo.linkedCodePr, hasActivity: Boolean(upstream.codeUpdatedAt) }
        : upstream.codeUpdatedAt
          ? { ref: null, hasActivity: true }
          : null,
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

    Object.assign(record, deriveLane(record, me, null, signals));
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

/**
 * Period boundaries are computed in UTC, not runner-local time. The same build
 * runs on CI (UTC) and on a laptop (CEST, UTC+2), and a local-midnight boundary
 * makes those two disagree about which period an item belongs to for the first
 * hours of every month and quarter: a PR merged at 2026-07-01T00:30Z is "this
 * month" on CI and "last month" locally, so the published numbers change
 * depending on where the build ran. The stored timestamps are UTC ISO strings,
 * so comparing them against UTC boundaries is the consistent reading.
 */
function quarterStart(date) {
  const q = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), q, 1));
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Counts merged items across `lists` on or after `since`. Only counts items
 * that actually merged — "shipped"/"helped ship" both claim the work landed, so
 * a still-open or closed-without-merging item doesn't qualify yet. */
function tallyMerged(lists, since) {
  let count = 0;
  for (const list of lists) {
    for (const item of list || []) {
      if (!item.mergedAt || (since && new Date(item.mergedAt) < since)) continue;
      count++;
    }
  }
  return count;
}

/**
 * Plain-language numbers for the impact header, computed from data the
 * pipeline already has. `contributions` is all-contributions.json.
 *
 * Two time scopes ship side by side: the LIFETIME figure (`helpedShipCount`)
 * is what the Home page shows — the whole career footprint. THIS-MONTH figures
 * (the `*ThisMonth` fields) are what the Workbench shows — resets on the 1st,
 * because the Workbench's job is "what's happening right now," not a running
 * lifetime total. Reusing the same numbers on both pages under the same label
 * was the original bug this split fixes: 52 projects (lifetime) and 9 projects
 * (whatever the board happened to have open) looked like the same metric
 * measured twice.
 *
 * There is deliberately no "contributors helped" figure. It was counted from
 * `item.author` / `item.user` on historical records, and no historical record
 * carries either field — all-contributions.json stores title/url/repo/date/
 * mergedAt and nothing about who wrote the thing — so the stat and its
 * this-month twin were structurally pinned at 0 and every renderer fell through
 * to its zero-fallback. Reviving it means teaching the fetch layer to record
 * PR authors first; until then a count of contributions is the honest number.
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
  );

  // "N contributions you helped ship" claims the work actually shipped, so
  // only merged items count — a reviewed/co-authored PR still open or closed
  // without merging wasn't "helped ship" yet. Deliberately excludes your own
  // solo pullRequests — this tile is about work you helped OTHERS ship.
  const helpedShipCount = tallyMerged([contributions.reviewedPrs, contributions.coAuthoredPrs], null);
  const helpedShipThisMonth = tallyMerged(
    [contributions.reviewedPrs, contributions.coAuthoredPrs],
    mStart
  );

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
    helpedShipCount,
    helpedShipThisMonth,
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
async function loadMergedWorkbench({ dataDir = 'data', fetchOptions, rosterOptions } = {}) {
  const [tasks, issues, prs, coauthored, contributions] = await Promise.all([
    readJsonOr([], path.join(dataDir, 'ongoing-tasks.json')),
    readJsonOr([], path.join(dataDir, 'ongoing-issues.json')),
    readJsonOr([], path.join(dataDir, 'ongoing-prs.json')),
    readJsonOr([], path.join(dataDir, 'ongoing-coauthored-prs.json')),
    readJsonOr({}, path.join(dataDir, 'all-contributions.json')),
  ]);
  const [feed, roster] = await Promise.all([
    fetchTrackerFeed(fetchOptions),
    fetchTeamRoster(rosterOptions),
  ]);

  // Only tracker-only rows need the title enrichment fetch — a row already
  // covered by a local record carries its own title, so re-fetching it would
  // just burn an API call for something we already have.
  const localKeys = new Set(
    [...tasks, ...issues, ...prs, ...coauthored].map(taskKey).filter(Boolean)
  );
  const trackerOnlyKeys = Object.keys(feed.data || {}).filter((key) => !localKeys.has(key));
  const titles = await fetchTrackerTitleInfo(trackerOnlyKeys);

  const { records, feed: feedMeta } = mergeWorkbench({
    tasks,
    issues,
    prs,
    coauthored,
    feed,
    titles,
    roster,
  });
  const impact = computeImpact(records, contributions);
  return { records, impact, feed: feedMeta };
}

module.exports = {
  TRACKER_RAW_URL,
  ROSTER_RAW_URL,
  fetchTrackerFeed,
  fetchTeamRoster,
  isValidTrackerShape,
  isValidRosterShape,
  taskKey,
  extractLinkedCodePr,
  extractIssueRefs,
  buildIssuePrLinks,
  normalizeActivity,
  deriveSignals,
  tracksMilestones,
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
