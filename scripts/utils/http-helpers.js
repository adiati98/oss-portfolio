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
//      per-PR fan-out (getPrActivityMeta fires 4 parallel calls) times the
//      PR-level concurrency can't open dozens of sockets simultaneously and
//      trip a connection reset. Extra requests queue at the socket layer. Set
//      to 6 as a hard ceiling that matches the workbench's PR_CONCURRENCY of 3
//      (3 PRs * up to ~2 in-flight of their 4 calls) and keeps the total
//      simultaneous-connection count well under GitHub's abuse threshold.
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 6 });

let rateLimitLogged = false;

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

/**
 * A 403 with a `retry-after` header, or with `x-ratelimit-remaining: 0`, is
 * GitHub telling us to slow down — worth waiting out. A 403 with neither
 * signal present isn't a rate limit at all; it's a permission problem.
 */
function classify403(err) {
  const headers = err.response?.headers || {};
  const retryAfter = Number(headers['retry-after']);
  const remaining = Number(headers['x-ratelimit-remaining']);
  const hasRetryAfter = Number.isFinite(retryAfter) && retryAfter > 0;
  const isQuotaExhausted = Number.isFinite(remaining) && remaining === 0;
  return {
    isConfirmedRateLimit: hasRetryAfter || isQuotaExhausted,
    retryAfterMs: hasRetryAfter ? retryAfter * 1000 : null,
  };
}

/**
 * Runs `fn` (an async function performing one axios call) with backoff retry
 * on a confirmed 403 rate limit and on transient 502/503/504 server errors.
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
 */
async function withRateLimitRetry(
  fn,
  { retries = MAX_RATE_LIMIT_RETRIES, label = '', assumeRateLimit = false } = {}
) {
  let attempt = 0;
  let quickAttempt = 0;
  // Network-level failures (ECONNRESET etc.) get their OWN retry budget,
  // independent of the rate-limit budget above. They have different root
  // causes, so a run that already spent its rate-limit retries this call
  // shouldn't die on the first unrelated socket reset (and vice versa).
  let networkAttempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;

      if (status === 403) {
        const { isConfirmedRateLimit, retryAfterMs } = classify403(err);

        if (assumeRateLimit || isConfirmedRateLimit) {
          if (attempt >= retries) throw err;
          attempt++;
          const delay = retryAfterMs ?? Math.min(60000, 2000 * 2 ** (attempt - 1));
          console.log(
            `[retry] rate-limit (403) on ${label || 'request'} (attempt ${attempt}/${retries}), backing off ${Math.round(delay / 1000)}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
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
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (RETRYABLE_SERVER_ERRORS.has(status)) {
        if (attempt >= retries) throw err;
        attempt++;
        const delay = Math.min(10000, 1000 * 2 ** (attempt - 1)); // transient 5xx: usually clears in seconds
        console.log(
          `[retry] server error (${status}) on ${label || 'request'} (attempt ${attempt}/${retries}), backing off ${Math.round(delay / 1000)}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
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
        await new Promise((resolve) => setTimeout(resolve, delay));
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
  attachRateLimitLogger,
  withRateLimitRetry,
  mapWithConcurrency,
  keepAliveAgent,
};
