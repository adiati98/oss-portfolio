/**
 * SHARED: Resilience + throughput helpers for GitHub REST API calls.
 * Centralizes secondary-rate-limit backoff, rate-limit visibility, and
 * bounded-concurrency batching so every fetcher (ongoing workbench,
 * historical contributions) behaves the same way under GitHub's
 * abuse-detection / secondary rate limits instead of each reinventing it.
 */

const https = require('https');

const MAX_RATE_LIMIT_RETRIES = 6;

// GitHub's own infra occasionally 502/503/504s — transient, unlike a 403
// (which means "you're being throttled"). Both are worth retrying, but a
// 5xx usually clears in seconds, not the up-to-60s a secondary rate limit
// needs.
const RETRYABLE_SERVER_ERRORS = new Set([502, 503, 504]);

// Transient network failures where the request never got an HTTP response at
// all — the socket was reset / timed out / dropped mid-flight, typically when
// a burst of concurrent TLS connections overwhelms the client or an
// intermediary. Unlike a 4xx/5xx these carry no `err.response`, so they're
// matched by `err.code` (or a couple of message-only variants). They almost
// always succeed on a quick retry.
const RETRYABLE_NETWORK_ERRORS = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'ERR_SOCKET_CONNECTION_TIMEOUT',
]);

function isRetryableNetworkError(err) {
  if (err.response) return false; // got an HTTP response — not a network-level failure
  if (RETRYABLE_NETWORK_ERRORS.has(err.code)) return true;
  return /socket hang up|network socket disconnected/i.test(err.message || '');
}

// A shared keep-alive agent, reused across every axios instance. Two jobs:
//   1. keepAlive reuses TCP/TLS connections instead of doing a fresh handshake
//      per request — far fewer handshakes means far fewer resets.
//   2. maxSockets caps how many connections can be open at once, so the
//      per-PR fan-out (getPrActivityMeta fires 4 parallel calls, plus a 5th
//      authoritative draft-state call) times the PR-level concurrency can't
//      open dozens of sockets simultaneously and trip a connection reset. Extra
//      requests queue at the socket layer. Set to 6 as a hard ceiling that
//      matches the workbench's PR_CONCURRENCY of 3 and keeps the total
//      simultaneous-connection count well under GitHub's abuse threshold.
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 6 });

let rateLimitLogged = false;

// The latest hourly-quota numbers GitHub reported (core API only — the search
// API has its own small per-minute quota). Read with quotaSummary() so the
// run can log how much of the hour's quota each step used.
let lastQuota = null;

function recordQuota(headers) {
  const remaining = Number(headers?.['x-ratelimit-remaining']);
  if (!Number.isFinite(remaining)) return;
  const resource = String(headers['x-ratelimit-resource'] || 'core').toLowerCase();
  if (resource !== 'core') return;
  lastQuota = {
    remaining,
    limit: Number(headers['x-ratelimit-limit']) || null,
    reset: Number(headers['x-ratelimit-reset']) || null,
  };
}

/**
 * "4012/5000 left, resets 18:38:53 UTC", or null before the first answer.
 * Used for the quota lines in the log (see main.js and the historical crawl).
 */
function quotaSummary() {
  if (!lastQuota) return null;
  const reset = lastQuota.reset ? `, resets ${formatClock(lastQuota.reset * 1000)}` : '';
  return `${lastQuota.remaining}/${lastQuota.limit ?? '?'} left${reset}`;
}

/**
 * Logs x-ratelimit-remaining/limit from a GitHub API response exactly once
 * per process, so a run can confirm empirically whether slowdowns are
 * caused by the secondary (abuse-detection) limiter or just raw latency.
 */
function logRateLimitOnce(response) {
  if (rateLimitLogged) return;
  const headers = response?.headers;
  const remaining = headers?.['x-ratelimit-remaining'];
  if (remaining === undefined) return;

  rateLimitLogged = true;
  const limit = headers['x-ratelimit-limit'];
  const resource = headers['x-ratelimit-resource'] || 'core';
  console.log(`[rate-limit] ${remaining}/${limit} requests remaining (resource: ${resource})`);
}

/**
 * Attaches a response interceptor that logs rate-limit headers once. Safe
 * to call on any axios instance; never throws or alters the response.
 */
function attachRateLimitLogger(axiosInstance) {
  axiosInstance.interceptors.response.use((response) => {
    logRateLimitOnce(response);
    recordQuota(response?.headers);
    return response;
  });
  return axiosInstance;
}

// How many extra tries to give a 403 that carries no rate-limit signal at
// all (no retry-after, quota not at 0) before concluding it's not a rate
// limit — just an access restriction on that specific repo (e.g. an org
// enforcing SSO we haven't authorized the token for) — and giving up. One
// retry is enough to rule out a one-off blip; more than that just burns
// minutes on something that will 403 again no matter how long we wait.
const UNCONFIRMED_403_RETRIES = 1;

// ---------------------------------------------------------------------------
// Rate-limit waits
//
// GitHub says how long a block lasts, in one of two headers:
//   - `retry-after`: wait this many seconds
//   - `x-ratelimit-remaining: 0` + `x-ratelimit-reset`: wait until this time
//     (seconds since 1970). This is sent for the hourly quota AND for the
//     short "too many requests at once" (secondary) limit.
// When neither is present, GitHub's guidance is to wait at least one minute.
// Retrying earlier than that only fails again — and GitHub warns that
// requests sent while blocked can keep the block going longer.
//
// A block applies to the whole token, not to one request. So the first
// request that learns "blocked until X" records it in `blockedUntil`, and
// every other request in the run waits for the same time instead of trying
// (and failing) on its own.
// ---------------------------------------------------------------------------

// The longest single wait we accept for a short block (the "too many
// requests at once" kind). A block announced to last longer than this gives
// up at once, so the workflow's own retry takes over.
const MAX_RATE_LIMIT_WAIT_MS = 15 * 60 * 1000;

// The HOURLY quota is different: once it runs out, it always comes back
// within an hour (x-ratelimit-reset). A full sync uses close to the whole
// quota, so running out near the end is expected now and then — waiting for
// the reset finishes the run, while giving up only fails it and makes the
// workflow's retries fail too (they start 30 seconds later, still blocked).
const MAX_QUOTA_RESET_WAIT_MS = 61 * 60 * 1000;

// The most one request may wait in total across all its retries. Without
// this, six retries of up to 15 minutes each could hold the job for 90. The
// hourly-quota wait gets more room, since one wait can be close to an hour.
const MAX_TOTAL_RATE_LIMIT_WAIT_MS = 20 * 60 * 1000;
const MAX_TOTAL_WITH_QUOTA_WAIT_MS = 80 * 60 * 1000;

// GitHub's minimum wait when a block comes with no time.
const MIN_UNTIMED_WAIT_MS = 60 * 1000;

let blockedUntil = 0;

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** For the fixture run only: clears the shared block time and quota. */
function resetRateLimitStateForTests() {
  blockedUntil = 0;
  lastQuota = null;
}

function errorMessageOf(err) {
  const data = err.response?.data;
  return String((data && typeof data === 'object' ? data.message : data) || err.message || '');
}

/**
 * Reads a 403/429 answer. Returns:
 *   isRateLimit  whether GitHub is telling us to slow down (as opposed to a
 *                permission problem on one repo)
 *   waitUntil    the time (ms) GitHub says the block ends, or null if it
 *                gave no time
 *   reason       which signal was used, for the log
 *
 * A 403 with none of these signals and no rate-limit wording isn't a rate
 * limit at all; it's a permission problem (e.g. an org enforcing SSO).
 */
function classify403(err, now = Date.now()) {
  const headers = err.response?.headers || {};
  const retryAfter = Number(headers['retry-after']);
  const remaining = Number(headers['x-ratelimit-remaining']);
  const reset = Number(headers['x-ratelimit-reset']);
  const message = errorMessageOf(err);
  // The search API has its own small per-minute quota. Running out of it
  // says nothing about other requests, so it is not shared with them.
  const searchOnly = String(headers['x-ratelimit-resource'] || '').toLowerCase() === 'search';

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return {
      isRateLimit: true,
      waitUntil: now + retryAfter * 1000,
      reason: 'retry-after',
      message,
      searchOnly,
    };
  }
  if (Number.isFinite(remaining) && remaining === 0) {
    const hasReset = Number.isFinite(reset) && reset > 0;
    return {
      isRateLimit: true,
      waitUntil: hasReset ? reset * 1000 + 1000 : null,
      reason: 'quota at 0, reset time',
      message,
      searchOnly,
      // The hourly quota (not search, and with a reset time) always comes
      // back within an hour — see MAX_QUOTA_RESET_WAIT_MS.
      hourlyQuota: hasReset && !searchOnly,
    };
  }
  if (/secondary rate limit|abuse detection|rate limit exceeded/i.test(message)) {
    return {
      isRateLimit: true,
      waitUntil: null,
      reason: 'rate-limit message, no time given',
      message,
      searchOnly,
    };
  }
  return { isRateLimit: false, waitUntil: null, reason: null, message, searchOnly };
}

function formatClock(ms) {
  return new Date(ms).toISOString().slice(11, 19) + ' UTC';
}

/** Waits out a block another request already found, if there is one. */
async function waitForSharedBlock(sleep, label) {
  const ms = blockedUntil - Date.now();
  if (ms <= 0) return;
  console.log(
    `[rate-limit] ${label || 'request'} waits ${Math.round(ms / 1000)}s for the block to end (${formatClock(blockedUntil)})...`
  );
  await sleep(ms);
}

/**
 * Runs `fn` (an async function performing one axios call) with retry on a
 * rate limit (403/429) and on transient 502/503/504 server errors.
 *
 * On a rate limit it waits until the time GitHub gives (see the "Rate-limit
 * waits" note above), shares that time with every other request in the run,
 * and gives up at once if a short block lasts longer than
 * MAX_RATE_LIMIT_WAIT_MS. When the hourly quota runs out it waits for the
 * reset, up to MAX_QUOTA_RESET_WAIT_MS. With no time given it waits at least
 * a minute.
 *
 * A 403 that carries no rate-limit signal gets one quick retry (to rule out
 * a fluke) and is then thrown with `isPermanent403` set, so callers can
 * record it and stop re-attempting it on future runs instead of burning the
 * full backoff ladder on something that will never succeed.
 *
 * Pass `assumeRateLimit: true` for search/list endpoints (e.g.
 * `/search/issues`), where "permanently forbidden" isn't a coherent concept
 * — a query isn't scoped to one repo's permissions, so a 403 there is always
 * a rate limit (GitHub's search abuse-detection doesn't reliably send
 * retry-after/remaining headers), never a permission problem to remember.
 *
 * `sleep` is only replaced in the fixture run, so it doesn't really wait.
 */
async function withRateLimitRetry(
  fn,
  { retries = MAX_RATE_LIMIT_RETRIES, label = '', assumeRateLimit = false, sleep = realSleep } = {}
) {
  let attempt = 0;
  let quickAttempt = 0;
  // Network-level failures (ECONNRESET etc.) get their OWN retry budget,
  // independent of the rate-limit budget above. They have different root
  // causes, so a run that already spent its rate-limit retries this call
  // shouldn't die on the first unrelated socket reset (and vice versa).
  let networkAttempt = 0;
  let totalRateLimitWait = 0;
  while (true) {
    await waitForSharedBlock(sleep, label);
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;

      if (status === 403 || status === 429) {
        const now = Date.now();
        const { isRateLimit, waitUntil, reason, message, searchOnly, hourlyQuota } = classify403(
          err,
          now
        );

        // 429 is always "too many requests"; search endpoints never mean a
        // permission problem (see the note above).
        if (assumeRateLimit || isRateLimit || status === 429) {
          if (attempt >= retries) throw err;
          attempt++;
          let until = waitUntil;
          if (until === null) {
            // No time given: at least a minute, a little jitter so parallel
            // requests don't all come back in the same instant.
            until = now + MIN_UNTIMED_WAIT_MS + Math.floor(Math.random() * 2000);
          }
          const delay = Math.max(0, until - now);
          const maxWait = hourlyQuota ? MAX_QUOTA_RESET_WAIT_MS : MAX_RATE_LIMIT_WAIT_MS;
          const maxTotal = hourlyQuota
            ? MAX_TOTAL_WITH_QUOTA_WAIT_MS
            : MAX_TOTAL_RATE_LIMIT_WAIT_MS;
          if (delay > maxWait || totalRateLimitWait + delay > maxTotal) {
            console.log(
              `[rate-limit] ${label || 'request'} is blocked until ${formatClock(until)} (${Math.round(delay / 60000)} min, ${reason}) — longer than this run will wait, giving up.`
            );
            throw err;
          }
          totalRateLimitWait += delay;
          if (!searchOnly) blockedUntil = Math.max(blockedUntil, until);
          console.log(
            `[retry] rate-limit (${status}) on ${label || 'request'} (attempt ${attempt}/${retries}), waiting ${Math.round(delay / 1000)}s until ${formatClock(until)} — ${reason}${message ? `: "${message.slice(0, 120)}"` : ''}`
          );
          await sleep(delay);
          continue;
        }

        if (quickAttempt >= UNCONFIRMED_403_RETRIES) {
          err.isPermanent403 = true;
          throw err;
        }
        quickAttempt++;
        console.log(
          `[retry] 403 on ${label || 'request'} with no rate-limit signal — quick retry ${quickAttempt}/${UNCONFIRMED_403_RETRIES}...`
        );
        await sleep(2000);
        continue;
      }

      if (RETRYABLE_SERVER_ERRORS.has(status)) {
        if (attempt >= retries) throw err;
        attempt++;
        const delay = Math.min(10000, 1000 * 2 ** (attempt - 1)); // transient 5xx: usually clears in seconds
        console.log(
          `[retry] server error (${status}) on ${label || 'request'} (attempt ${attempt}/${retries}), backing off ${Math.round(delay / 1000)}s...`
        );
        await sleep(delay);
        continue;
      }

      if (isRetryableNetworkError(err)) {
        if (networkAttempt >= retries) throw err;
        networkAttempt++;
        // On a search endpoint a reset is almost always GitHub's abuse
        // detection escalating from "403, slow down" to just killing the
        // socket — so back off on the same long ladder as a rate limit
        // rather than the short one a plain transport blip needs. Jitter so a
        // batch of connections that reset together don't retry in lockstep
        // and immediately re-storm the pool.
        const base = assumeRateLimit
          ? Math.min(60000, 2000 * 2 ** (networkAttempt - 1))
          : Math.min(15000, 1000 * 2 ** (networkAttempt - 1));
        const delay = base + Math.floor(Math.random() * 500);
        console.log(
          `[retry] network error (${err.code || err.message}) on ${label || 'request'} (attempt ${networkAttempt}/${retries}), backing off ${Math.round(delay / 1000)}s...`
        );
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }
}

/**
 * Runs `items` through `iteratee` with bounded concurrency, processing in
 * chunks so we never have more than `concurrency` requests in-flight —
 * the same throttled-but-parallel shape `searchAll` uses for pagination,
 * applied across PRs instead of across pages. Result order matches `items`.
 */
async function mapWithConcurrency(items, concurrency, iteratee) {
  const results = new Array(items.length);
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item, idx) => iteratee(item, i + idx)));
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j];
    }
  }
  return results;
}

module.exports = {
  MAX_RATE_LIMIT_RETRIES,
  MAX_RATE_LIMIT_WAIT_MS,
  MAX_QUOTA_RESET_WAIT_MS,
  attachRateLimitLogger,
  quotaSummary,
  recordQuota,
  classify403,
  withRateLimitRetry,
  resetRateLimitStateForTests,
  mapWithConcurrency,
  keepAliveAgent,
};
