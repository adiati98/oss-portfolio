/**
 * TRACKER-ONLY TITLE ENRICHMENT
 *
 * The upstream docs-PR tracker cache (adiati98/mautic-docs-prs-tracker) only
 * carries activity arrays (reviews, comments, review requests), never a PR's
 * title or body — see workbench-merge.js's tracker-only row construction.
 * For a docs PR that's watched by the tracker but isn't in the local
 * workbench (e.g. someone else's PR triaged as maintainer), that leaves
 * nothing to render but "owner/repo#number".
 *
 * This fetches the one thing missing — title, and any linked code PR named
 * in the body — directly from the GitHub PR detail endpoint, for exactly
 * those tracker-only keys. Results are cached forever: a merged docs PR's
 * title and linked code PR never change retroactively, so every run after
 * the first costs zero API calls for a PR already seen. A fetch failure
 * (rate limit, 404 on a since-deleted PR, an SSO-gated org) is left
 * uncached rather than poisoned with a null — the row falls back to the
 * pre-existing repo#number rendering this run, and gets retried next time.
 */
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { BASE_URL } = require('../config/config');
const { extractLinkedCodePr } = require('../utils/github-helpers');
const {
  attachRateLimitLogger,
  withRateLimitRetry,
  mapWithConcurrency,
  keepAliveAgent,
} = require('../utils/http-helpers');

const CACHE_FILE = path.join('data', 'tracker-titles-cache.json');
const CONCURRENCY = 3;

function buildAxiosInstance(timeoutMs) {
  const token = process.env.GITHUB_TOKEN;
  return attachRateLimitLogger(
    axios.create({
      baseURL: BASE_URL,
      httpsAgent: keepAliveAgent,
      timeout: timeoutMs,
      headers: {
        ...(token ? { Authorization: `token ${token}` } : {}),
        Accept: 'application/vnd.github.v3+json',
      },
    })
  );
}

async function readCache(cacheFile) {
  try {
    return JSON.parse(await fs.readFile(cacheFile, 'utf8'));
  } catch (e) {
    return {};
  }
}

/**
 * @param {string[]} keys  "owner/repo#number" keys to enrich (tracker-only —
 *                         callers should exclude keys already covered by a
 *                         local record, which already carries its own title).
 * @returns {Promise<object>} map keyed by the same "owner/repo#number" →
 *                            { title, linkedCodePr }, ready to pass as
 *                            mergeWorkbench's `titles` input.
 */
async function fetchTrackerTitleInfo(keys, { cacheFile = CACHE_FILE, timeoutMs = 10000 } = {}) {
  const cache = await readCache(cacheFile);
  const result = {};

  const pending = (keys || []).filter((key) => {
    if (cache[key]) {
      result[key] = cache[key];
      return false;
    }
    return true;
  });

  if (pending.length === 0) return result;

  const axiosInstance = buildAxiosInstance(timeoutMs);
  let dirty = false;

  await mapWithConcurrency(pending, CONCURRENCY, async (key) => {
    const match = key.match(/^([^/]+\/[^#]+)#(\d+)$/);
    if (!match) return;
    const [, repo, number] = match;
    try {
      const res = await withRateLimitRetry(
        () => axiosInstance.get(`/repos/${repo}/pulls/${number}`),
        { label: `tracker-title ${key}` }
      );
      const entry = {
        title: res.data.title || null,
        linkedCodePr: extractLinkedCodePr(res.data.body, repo),
      };
      cache[key] = entry;
      result[key] = entry;
      dirty = true;
    } catch (err) {
      // Not cached — falls back to repo#number this run, retried next run.
    }
  });

  if (dirty) {
    try {
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
      /* cache write is best-effort */
    }
  }

  return result;
}

module.exports = { fetchTrackerTitleInfo, CACHE_FILE };
