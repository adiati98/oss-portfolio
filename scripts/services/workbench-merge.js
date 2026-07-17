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
 * Precedence: bot → approved (ready/action) → stalled → turn-based.
 */
function deriveLane(record, me) {
  const { relationship, approval, idleDays, linkedCodePr, upstream } = record;

  if (record.isBot) {
    return { lane: 'bot', ball: 'Bot', nextStep: null };
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

  if (relationship === 'assigned issue') {
    return { lane: 'action', ball: 'To Write', nextStep: 'Assigned to you — start the work' };
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

  // Repos the tracker knows about — local rows in these repos EXPECT a match.
  const trackedRepos = new Set(Object.keys(tracker).map((k) => k.split('#')[0]));

  const locals = [
    ...prs.map((r) => ({ ...r, relationship: 'authored' })),
    ...coauthored.map((r) => ({ ...r, relationship: 'co-authoring' })),
    ...tasks.map((r) => ({ ...r, relationship: 'reviewing' })),
    ...issues.map((r) => ({ ...r, relationship: 'assigned issue' })),
  ];

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
      desync: Boolean(!upstream && local.repo && trackedRepos.has(local.repo)),
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
      desync: false,
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

/**
 * Plain-language numbers for the impact header, computed from data the
 * pipeline already has. `contributions` is all-contributions.json.
 */
function computeImpact(records, contributions = {}, now = new Date()) {
  const qStart = quarterStart(now);
  const inQuarter = (item) => item.date && new Date(item.date) >= qStart;

  const shippedThisQuarter =
    (contributions.pullRequests || []).filter(inQuarter).length +
    (contributions.coAuthoredPrs || []).filter(inQuarter).length;

  // Unique authors whose work I reviewed/co-authored — when the records carry
  // identity. Historical records don't (title/url/repo/dates only), so
  // `helpedShipCount` is the honest fallback: the NUMBER of other people's
  // PRs brought to merge. Renderers show "N contributors" when
  // contributorsHelped > 0, else "N contributions you helped ship".
  const helped = new Set();
  let helpedShipCount = 0;
  for (const list of [contributions.reviewedPrs, contributions.coAuthoredPrs]) {
    for (const item of list || []) {
      helpedShipCount++;
      const author =
        item.author || (typeof item.user === 'object' ? item.user?.login : item.user) || null;
      if (author && !isBotLogin(author)) helped.add(String(author).toLowerCase());
    }
  }

  const activeRepos = new Set(records.filter((r) => !r.isBot).map((r) => r.repo).filter(Boolean));
  const activeOrgs = new Set([...activeRepos].map((r) => r.split('/')[0]));

  return {
    shippedThisQuarter,
    approvedLanding: records.filter((r) => r.lane === 'ready').length,
    needAction: records.filter((r) => r.lane === 'action').length,
    contributorsHelped: helped.size,
    helpedShipCount,
    projects: activeRepos.size,
    organizations: activeOrgs.size,
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
  deriveApproval,
  deriveLane,
  mergeWorkbench,
  computeImpact,
  loadMergedWorkbench,
};
