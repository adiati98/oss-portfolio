/**
 * BACKPORT DETECTION
 *
 * Finds which PRs are backports (copies of an earlier PR onto another branch)
 * and which PR each one was copied from. The rules themselves are the Mautic
 * docs PR tracker's, copied in utils/backport-rules.js; this file only feeds
 * them data and remembers the answers.
 *
 * WHERE THE DATA COMES FROM
 * -------------------------
 * The rules need a PR's title and body. The fetchers already receive both in
 * their Search/Issues/PR results, so they hand each PR to rememberPrText()
 * while they run. Bodies are kept in memory for this run only — never written
 * to disk. A PR whose text was not seen this run (an old entry outside the
 * daily fetch window) keeps its cached verdict; it gets a fresh check on the
 * next full sync, which fetches every year again.
 *
 * API CALLS
 * ---------
 * Only one kind: GET /repos/:owner/:repo/pulls/:number, and only when a PR
 * actually looks like a backport — to learn its own branch and to confirm the
 * parent (a real PR, on a different branch). Up to 3 run at the same time,
 * like the other fetchers. data/backport-cache.json keeps two kinds of data:
 *
 *   - verdicts: our rules' conclusion per PR ("#1000 is a backport of #973",
 *     or "not a backport"). Reused until the PR's updated_at changes.
 *   - PR facts: what GitHub said about a PR (branch, author, open/closed,
 *     merged). A merged PR's facts can never change, so they are reused
 *     forever. A closed or "not a PR" answer is reused until the next full
 *     sync. An OPEN PR's facts are never reused from an earlier run — they are
 *     fetched fresh once per run, since an open PR can merge, close or move to
 *     another branch.
 *
 * The monthly full sync (FULL_RESYNC) throws away every verdict and every fact
 * except those about merged PRs — see pruneForFullSync. So every PR is judged
 * again with the current rules once a month, and everything that CAN change
 * is fetched again, without repeating hundreds of calls whose answer is fixed.
 *
 * OUTPUT
 * ------
 * `backports`: a Map of PR URL → { backportOf, parentNumber, branch,
 * parentMerged }, only for PRs that ARE backports. `notBackports`: the URLs
 * confirmed NOT to be. applyBackportFields() writes `backportOf` and `branch`
 * onto contribution entries; the workbench reads the Map directly.
 */
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { BASE_URL } = require('../config/config');
const {
  attachRateLimitLogger,
  withRateLimitRetry,
  mapWithConcurrency,
  keepAliveAgent,
} = require('../utils/http-helpers');
const {
  TRACKER_RULES_COMMIT,
  findBackportParent,
  isTitleMatchAllowed,
  backportTitleSuffixBranch,
} = require('../utils/backport-rules');
const {
  ADDITIONS_VERSION,
  findFirstReferenceParent,
  findAdditionalParent,
} = require('../utils/backport-additions');

// Stored with every verdict. A change to either the copied tracker rules or
// oss-portfolio's own additions makes the next run judge every PR again.
const RULES_VERSION = `${TRACKER_RULES_COMMIT}+${ADDITIONS_VERSION}`;

const CACHE_FILE = path.join('data', 'backport-cache.json');

// Same bound as the other fetchers, to stay under GitHub's secondary rate limit.
const CONCURRENCY = 3;

const PR_URL_PATTERN = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/i;

function parsePrUrl(url) {
  const m = String(url || '').match(PR_URL_PATTERN);
  return m ? { repo: m[1], number: Number(m[2]) } : null;
}

function prUrl(repo, number) {
  return `https://github.com/${repo}/pull/${number}`;
}

// ---------------------------------------------------------------------------
// In-memory text, filled by the fetchers during the run
// ---------------------------------------------------------------------------

const prTexts = new Map();

/**
 * Remembers a PR's title and body for this run. Accepts a Search/Issues item
 * or a PR detail object; anything that is not a PR is ignored. `extra` can add
 * what the caller already knows, e.g. { baseBranch } from a PR detail call.
 */
function rememberPrText(item, extra = {}) {
  if (!item) return;
  const url = item.html_url || item.url;
  const parsed = parsePrUrl(url);
  if (!parsed) return;
  const previous = prTexts.get(url) || {};
  prTexts.set(url, {
    ...previous,
    ...parsed,
    url,
    title: item.title ?? previous.title ?? '',
    body: item.body ?? previous.body ?? '',
    createdAt: item.created_at ?? previous.createdAt ?? null,
    updatedAt: item.updated_at ?? previous.updatedAt ?? null,
    author: item.user?.login ?? previous.author ?? null,
    baseBranch: extra.baseBranch ?? item.base?.ref ?? previous.baseBranch ?? null,
  });
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

async function readCache(cacheFile) {
  try {
    const data = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    const sameRules = data.rulesCommit === RULES_VERSION;
    return {
      rulesCommit: RULES_VERSION,
      // New rules mean every verdict has to be worked out again. The PR facts
      // (branch, author, merged) don't depend on the rules, so they are kept.
      verdicts: sameRules && data.verdicts ? data.verdicts : {},
      pulls: data.pulls || {},
    };
  } catch (e) {
    return { rulesCommit: RULES_VERSION, verdicts: {}, pulls: {} };
  }
}

async function writeCache(cacheFile, cache) {
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * For the monthly full sync: drops every verdict, and every PR fact except a
 * merged PR's (which GitHub would answer the same way again). Called once,
 * before this run's detection.
 */
async function pruneForFullSync(cacheFile = CACHE_FILE) {
  const cache = await readCache(cacheFile);
  const pulls = {};
  for (const [key, fact] of Object.entries(cache.pulls)) {
    if (fact && fact.exists && fact.merged) pulls[key] = fact;
  }
  await writeCache(cacheFile, { rulesCommit: RULES_VERSION, verdicts: {}, pulls });
  console.log(
    `Backport cache reset for full sync: kept ${Object.keys(pulls).length} merged-PR facts, ` +
      `dropped ${Object.keys(cache.verdicts).length} verdicts and ` +
      `${Object.keys(cache.pulls).length - Object.keys(pulls).length} other facts.`
  );
}

// ---------------------------------------------------------------------------
// GitHub lookups
// ---------------------------------------------------------------------------

function buildAxiosInstance() {
  const token = process.env.GITHUB_TOKEN;
  return attachRateLimitLogger(
    axios.create({
      baseURL: BASE_URL,
      httpsAgent: keepAliveAgent,
      timeout: 30000,
      headers: {
        ...(token ? { Authorization: `token ${token}` } : {}),
        Accept: 'application/vnd.github.v3+json',
      },
    })
  );
}

// Facts fetched during THIS run, shared by both detection passes of a build
// (main.js, then the workbench loader), so an open PR is fetched at most once.
const fetchedThisRun = new Map();

/** A fact that cannot change before the next full sync, so no need to ask again. */
function isSettled(fact) {
  return (
    Boolean(fact) && (fact.exists === false || fact.merged === true || fact.state === 'closed')
  );
}

/**
 * Returns a getPull(repo, number) function backed by the cache. Resolves to
 * null when the number is not a PR (404 — e.g. an issue number), and throws
 * when the lookup failed for any other reason, so a failure is never mistaken
 * for "not a PR" — and nothing is cached for it, so the next run tries again.
 */
function makePullLookup(cache, stats, http = buildAxiosInstance()) {
  return async function getPull(repo, number) {
    const key = `${repo}#${number}`;
    if (fetchedThisRun.has(key)) return fetchedThisRun.get(key);
    const cached = cache.pulls[key];
    if (isSettled(cached)) return cached.exists ? cached : null;

    const lookup = (async () => {
      try {
        stats.apiCalls++;
        const res = await withRateLimitRetry(() => http.get(`/repos/${repo}/pulls/${number}`), {
          label: `backport-check ${key}`,
        });
        const d = res.data;
        const entry = {
          exists: true,
          baseBranch: d.base?.ref || null,
          author: d.user?.login || null,
          state: d.state || null,
          merged: d.merged === true,
          mergedAt: d.merged_at || null,
        };
        cache.pulls[key] = entry;
        return entry;
      } catch (err) {
        if (err.response?.status === 404) {
          cache.pulls[key] = { exists: false };
          return null;
        }
        throw err;
      }
    })();
    fetchedThisRun.set(key, lookup);
    try {
      return await lookup;
    } catch (err) {
      fetchedThisRun.delete(key);
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * One PR's verdict: { backportOf, parentNumber, branch, rule } or
 * { backportOf: null } when it is not a backport. Throws when a lookup failed.
 *
 * Order: oss-portfolio's "first #N" fix, then the tracker's copied rules, then
 * oss-portfolio's other additions (see utils/backport-additions.js). `rule`
 * records which one found the parent, so a wrong link can be traced.
 */
async function checkOne(text, pool, getPull) {
  const { repo, number } = text;
  let base;
  const baseBranch = async () => {
    if (base !== undefined) return base;
    if (text.baseBranch) return (base = text.baseBranch);
    const self = await getPull(repo, number);
    return (base = self ? self.baseBranch : null);
  };
  const common = { repo, number, title: text.title, body: text.body, getBase: baseBranch, getPull };

  const first = await findFirstReferenceParent(common);
  if (first) return verdictFor(first, 'first-ref', baseBranch, text.title);

  const parent = await findBackportParent({
    repo,
    number,
    title: text.title,
    body: text.body,
    baseBranch,
    createdAt: text.createdAt,
    allowTitleMatch: () =>
      isTitleMatchAllowed({
        repo,
        number,
        title: text.title,
        body: text.body,
        author: text.author,
        baseBranch,
        getPull,
      }),
    pool,
    getPull,
  });
  if (parent) return verdictFor({ ...parent, repo }, 'tracker', baseBranch, text.title);

  const extra = await findAdditionalParent({
    ...common,
    author: text.author,
    createdAt: text.createdAt,
    pool,
  });
  if (extra) return verdictFor(extra, `addition-${extra.rule}`, baseBranch, text.title);
  return { backportOf: null };
}

async function verdictFor(parent, rule, baseBranch, title) {
  // This PR's own branch, as GitHub reports it; the title suffix is only a
  // fallback for when that lookup gave nothing.
  const branch = (await baseBranch()) || backportTitleSuffixBranch(title);
  return {
    backportOf: prUrl(parent.repo, parent.number),
    parentNumber: parent.number,
    branch,
    rule,
  };
}

/**
 * Checks every PR in `entries` (anything with a PR `url`; issues are skipped)
 * and returns { backports, notBackports } as described at the top of this file.
 *
 * @param {object}   options
 * @param {Array}    options.entries   contribution entries and workbench items
 * @param {Iterable} [options.openUrls] URLs of PRs that are still open — only
 *                   their parents' merged state is refreshed
 * @param {string}   [options.cacheFile]
 */
async function runBackportDetection({ entries = [], openUrls = [], cacheFile = CACHE_FILE } = {}) {
  const started = Date.now();
  const cache = await readCache(cacheFile);
  const stats = { checked: 0, apiCalls: 0, failed: 0 };
  const getPull = makePullLookup(cache, stats);
  const open = new Set(openUrls);

  // Everything we know about, for title matching — no API calls.
  const pool = new Map();
  for (const entry of entries) {
    const parsed = parsePrUrl(entry?.url);
    if (!parsed) continue;
    pool.set(entry.url, { ...parsed, title: entry.title, createdAt: entry.createdAt || null });
  }
  for (const text of prTexts.values()) {
    pool.set(text.url, {
      repo: text.repo,
      number: text.number,
      title: text.title,
      createdAt: text.createdAt,
    });
  }
  const poolList = [...pool.values()];

  const urls = new Set([...entries.map((e) => e?.url).filter((u) => parsePrUrl(u))]);
  const backports = new Map();
  const notBackports = new Set();

  await mapWithConcurrency([...urls], CONCURRENCY, async (url) => {
    const text = prTexts.get(url);
    let verdict = cache.verdicts[url];
    const stale = !verdict || (text && verdict.updatedAt !== (text.updatedAt || null));
    if (text && stale) {
      try {
        stats.checked++;
        verdict = {
          updatedAt: text.updatedAt || null,
          ...(await checkOne(text, poolList, getPull)),
        };
        cache.verdicts[url] = verdict;
      } catch (err) {
        // Unknown this run — keep whatever was known before, retry next run.
        stats.failed++;
        console.log(`Backport check failed for ${url}: ${err.message}`);
      }
    }
    if (!verdict) return;
    if (!verdict.backportOf) {
      notBackports.add(url);
      return;
    }

    // While the backport is open, its parent's merged state matters to the
    // workbench, so look it up (fetched fresh once per run if still open).
    const parent = parsePrUrl(verdict.backportOf);
    let parentInfo = cache.pulls[`${parent.repo}#${parent.number}`] || null;
    if (open.has(url)) {
      try {
        parentInfo = (await getPull(parent.repo, parent.number)) || parentInfo;
      } catch (err) {
        console.log(`Could not refresh parent ${verdict.backportOf}: ${err.message}`);
      }
    }
    backports.set(url, {
      backportOf: verdict.backportOf,
      parentNumber: verdict.parentNumber,
      branch: verdict.branch || null,
      parentMerged: Boolean(parentInfo && parentInfo.merged),
    });
  });

  try {
    await writeCache(cacheFile, cache);
  } catch (err) {
    console.error('Failed to persist backport cache:', err.message);
  }
  console.log(
    `Backport check: ${urls.size} PRs, ${stats.checked} checked this run, ` +
      `${stats.apiCalls} API calls, ${backports.size} backports found` +
      (stats.failed ? `, ${stats.failed} failed (kept previous result)` : '') +
      `, ${((Date.now() - started) / 1000).toFixed(1)}s.`
  );
  return { backports, notBackports };
}

/**
 * Adds `backportOf` and `branch` to each backport PR entry, in place. Entries
 * that are not backports are left exactly as they are — the only change to
 * one is removing these two fields when a fresh check says it is no longer a
 * backport (e.g. after a rule change). An entry with no verdict at all is not
 * touched.
 */
function applyBackportFields(contributions, { backports, notBackports }) {
  for (const list of Object.values(contributions || {})) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || !parsePrUrl(entry.url)) continue;
      const info = backports.get(entry.url);
      if (info) {
        entry.backportOf = info.backportOf;
        if (info.branch) entry.branch = info.branch;
        else delete entry.branch;
      } else if (notBackports.has(entry.url)) {
        delete entry.backportOf;
        delete entry.branch;
      }
    }
  }
}

module.exports = {
  CACHE_FILE,
  rememberPrText,
  runBackportDetection,
  pruneForFullSync,
  // Exported for the fixture and audit runs only.
  makePullLookup,
  checkOne,
  applyBackportFields,
  parsePrUrl,
};
