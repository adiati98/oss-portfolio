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

function isBotRecord(record) {
  const username = typeof record.user === 'object' ? record.user?.login : record.user;
  if (isAllowedBotLogin(username)) return false;
  const userStr = String(username || '').toLowerCase();
  const titleStr = String(record.title || '').toLowerCase();
  return (
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

  if (local && (local.reviewState === 'APPROVED' || local.status === 'APPROVED')) {
    state = 'APPROVED';
    by = local.approvedBy ? String(local.approvedBy).trim() : null;
  }

  if (upstream && Array.isArray(upstream.rawDocsReviews)) {
    const approvals = upstream.rawDocsReviews.filter((r) => r && r.state === 'APPROVED');
    if (approvals.length > 0) {
      const latest = approvals.reduce((a, b) =>
        new Date(a.submitted_at || 0) >= new Date(b.submitted_at || 0) ? a : b
      );
      state = 'APPROVED';
      by = by || latest.user?.login || null;
      approvedAt = latest.submitted_at || null;
    }
  }

  if (!state) return null;

  let noteSince = false;
  if (approvedAt && upstream && Array.isArray(upstream.rawDocsComments)) {
    noteSince = upstream.rawDocsComments.some(
      (c) =>
        c &&
        new Date(c.created_at || 0) > new Date(approvedAt) &&
        !isBotLogin(c.user?.login)
    );
  }

  return { state, by, approvedAt, noteSince };
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
function deriveLane(record, me) {
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

  if (relationship === 'reviewing') {
    if (isMe) return { lane: 'waiting', ball: 'Waiting', nextStep: null };
    if (isAuthor) {
      return {
        lane: 'action',
        ball: 'Take Action',
        nextStep: reminder || 'Author replied — review the latest changes',
      };
    }
    if (record.status === 'Request review') {
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

    Object.assign(record, deriveLane(record, me));
    return record;
  });

  // Tracker-only rows: the tracker watches them but they aren't in the local
  // workbench (e.g. someone else's docs PR you triage as maintainer). The
  // cache carries activity, not titles — renderers show repo#number.
  for (const [key, upstream] of Object.entries(tracker)) {
    if (matchedKeys.has(key)) continue;
    const [repo, number] = key.split('#');
    const approval = deriveApproval(null, upstream);
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
      isDraft: false,
      isBot: false,
      lastActor: null,
      isLastActorBot: false,
      hasFormalReview: (upstream.rawDocsReviews || []).length > 0,
      author: null,
      status: null,
      approval,
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

/** Counts merged reviewed/co-authored PRs on or after `since`, plus the
 * unique non-bot authors among them. Shared by the lifetime and
 * this-month "helped ship" figures below — only the cutoff differs. */
function tallyHelpedShip(contributions, since) {
  const authors = new Set();
  let count = 0;
  for (const list of [contributions.reviewedPrs, contributions.coAuthoredPrs]) {
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
  const inQuarter = (item) => item.date && new Date(item.date) >= qStart;
  const inMonth = (item) => item.date && new Date(item.date) >= mStart;

  const shippedThisQuarter =
    (contributions.pullRequests || []).filter(inQuarter).length +
    (contributions.coAuthoredPrs || []).filter(inQuarter).length;

  // Both phrasings ("N contributors' work you're helping ship" / "N
  // contributions you helped ship") claim the work actually shipped, so only
  // merged items count — a reviewed/co-authored PR still open or closed
  // without merging wasn't "helped ship" yet. See tallyHelpedShip above.
  const lifetime = tallyHelpedShip(contributions, null);
  const thisMonth = tallyHelpedShip(contributions, mStart);

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
  deriveLane,
  mergeWorkbench,
  computeImpact,
  loadMergedWorkbench,
};
