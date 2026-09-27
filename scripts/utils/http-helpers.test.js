/**
 * Fixture run for the rate-limit waits in http-helpers.js. The clock and the
 * waiting are faked, so nothing really sleeps.
 * Run: node scripts/utils/http-helpers.test.js
 */
const assert = require('assert');
const {
  withRateLimitRetry,
  classify403,
  resetRateLimitStateForTests,
  MAX_RATE_LIMIT_WAIT_MS,
} = require('./http-helpers');

// A fake clock: sleeping just moves it forward.
const realNow = Date.now;
let clock = Date.UTC(2026, 8, 27, 16, 19, 0);
Date.now = () => clock;
const waits = [];
const sleep = async (ms) => {
  waits.push(ms);
  clock += ms;
};

function reset() {
  resetRateLimitStateForTests();
  waits.length = 0;
}

/** An axios-like error. */
function httpError(status, headers = {}, message = '') {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, headers, data: { message } };
  return err;
}

/** fn that fails with the given errors first, then succeeds. */
function failThen(errors, value = 'ok') {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (errors.length) throw errors.shift();
    return value;
  };
  fn.calls = () => calls;
  return fn;
}

const quiet = async (body) => {
  const log = console.log;
  console.log = () => {};
  try {
    return await body();
  } finally {
    console.log = log;
  }
};

async function run(name, body) {
  reset();
  try {
    await quiet(body);
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  console.log('http-helpers fixtures');

  await run('R1 · quota at 0: waits until x-ratelimit-reset, then succeeds', async () => {
    const reset = Math.floor(clock / 1000) + 300; // 5 minutes from now
    const fn = failThen([
      httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
    ]);
    assert.equal(await withRateLimitRetry(fn, { label: 'reviews#719', sleep }), 'ok');
    assert.equal(waits.length, 1, 'one wait, not a ladder of short ones');
    assert.ok(waits[0] >= 300000 && waits[0] <= 302000, `waited ${waits[0]}ms`);
  });

  await run('R2 · retry-after: waits exactly that long', async () => {
    const fn = failThen([httpError(403, { 'retry-after': '45' })]);
    await withRateLimitRetry(fn, { sleep });
    assert.deepEqual(waits, [45000]);
  });

  await run('R3 · "secondary rate limit" with no time: waits at least a minute', async () => {
    const fn = failThen([httpError(403, {}, 'You have exceeded a secondary rate limit.')]);
    await withRateLimitRetry(fn, { sleep });
    assert.equal(waits.length, 1);
    assert.ok(waits[0] >= 60000, `waited ${waits[0]}ms`);
  });

  await run('R4 · 429 is a rate limit too', async () => {
    const fn = failThen([httpError(429, { 'retry-after': '10' })]);
    await withRateLimitRetry(fn, { sleep });
    assert.deepEqual(waits, [10000]);
  });

  await run('R5 · a block longer than the limit gives up at once, without waiting', async () => {
    const reset = Math.floor((clock + MAX_RATE_LIMIT_WAIT_MS + 5 * 60000) / 1000);
    const fn = failThen([
      httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
    ]);
    await assert.rejects(() => withRateLimitRetry(fn, { sleep }));
    assert.deepEqual(waits, []);
    assert.equal(fn.calls(), 1);
  });

  await run(
    'R6 · other requests wait for a block one request found, instead of failing',
    async () => {
      const reset = Math.floor(clock / 1000) + 120;
      const first = failThen([
        httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
      ]);
      await withRateLimitRetry(first, { sleep });
      // Rewind as if a second request started while the first was waiting.
      clock -= 60000;
      const second = failThen([]);
      await withRateLimitRetry(second, { sleep });
      assert.equal(second.calls(), 1, 'the second request never hit the block');
      assert.ok(waits[1] >= 60000, 'it waited for the shared block time first');
    }
  );

  await run('R7 · a plain 403 (no rate-limit signal) is still a permission problem', async () => {
    const fn = failThen([httpError(403), httpError(403)]);
    const err = await withRateLimitRetry(fn, { sleep }).catch((e) => e);
    assert.equal(err.isPermanent403, true);
    assert.deepEqual(waits, [2000]);
  });

  await run('R8 · search (assumeRateLimit) with no signal waits at least a minute', async () => {
    const fn = failThen([httpError(403)]);
    await withRateLimitRetry(fn, { assumeRateLimit: true, sleep });
    assert.ok(waits[0] >= 60000);
  });

  await run('R10 · a search-only block is not shared with other requests', async () => {
    const reset = Math.floor(clock / 1000) + 40;
    const search = failThen([
      httpError(403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(reset),
        'x-ratelimit-resource': 'search',
      }),
    ]);
    await withRateLimitRetry(search, { assumeRateLimit: true, sleep });
    clock -= 30000;
    const other = failThen([]);
    await withRateLimitRetry(other, { sleep });
    assert.equal(waits.length, 1, 'the other request did not wait');
  });

  await run('R11 · one request stops after 20 minutes of waiting in total', async () => {
    const block = () =>
      httpError(403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(clock / 1000) + 14 * 60),
      });
    let calls = 0;
    const fn = async () => {
      calls++;
      throw block();
    };
    await assert.rejects(() => withRateLimitRetry(fn, { sleep }));
    assert.equal(waits.length, 1, 'waited once (14 min); a second 14-min wait would pass 20 min');
    assert.equal(calls, 2);
  });

  await run('R9 · classify403 reads the reset time', () => {
    const c = classify403(
      httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790000000' }),
      0
    );
    assert.equal(c.isRateLimit, true);
    assert.equal(c.waitUntil, 1790000000 * 1000 + 1000);
  });

  Date.now = realNow;
  if (process.exitCode) {
    console.error('\nfixture run FAILED');
  } else {
    console.log('\nall http-helpers fixtures passed');
  }
})();
