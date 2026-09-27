/**
 * Fixture run for the backport cache rules: which PR facts are reused and
 * which are fetched again. Run: node scripts/services/backport-detection.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makePullLookup, pruneForFullSync } = require('./backport-detection');

async function run(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

/** A fake GitHub that answers from a table and counts the calls it gets. */
function fakeHttp(table) {
  const http = {
    calls: 0,
    async get(url) {
      http.calls++;
      const number = Number(url.split('/').pop());
      if (!table[number]) {
        const err = new Error('Not Found');
        err.response = { status: 404 };
        throw err;
      }
      return { data: table[number] };
    },
  };
  return http;
}

const pr = (base, state, merged) => ({ base: { ref: base }, user: { login: 'a' }, state, merged });

(async () => {
  console.log('backport-detection fixtures');

  await run('C1 · merged, closed and "not a PR" facts are reused from an earlier run', async () => {
    const cache = {
      pulls: {
        'o/r#1': { exists: true, baseBranch: '7.0', state: 'closed', merged: true },
        'o/r#2': { exists: true, baseBranch: '7.1', state: 'closed', merged: false },
        'o/r#3': { exists: false },
      },
    };
    const http = fakeHttp({});
    const getPull = makePullLookup(cache, { apiCalls: 0 }, http);
    assert.equal((await getPull('o/r', 1)).baseBranch, '7.0');
    assert.equal((await getPull('o/r', 2)).baseBranch, '7.1');
    assert.equal(await getPull('o/r', 3), null);
    assert.equal(http.calls, 0);
  });

  await run('C2 · an open PR from an earlier run is fetched again, once per run', async () => {
    const cache = {
      pulls: { 'o/r#10': { exists: true, baseBranch: '7.0', state: 'open', merged: false } },
    };
    const http = fakeHttp({ 10: pr('8.0', 'open', false) });
    const getPull = makePullLookup(cache, { apiCalls: 0 }, http);
    assert.equal((await getPull('o/r', 10)).baseBranch, '8.0', 'moved to another branch');
    await getPull('o/r', 10);
    assert.equal(http.calls, 1, 'second ask in the same run is not a new call');
    assert.equal(cache.pulls['o/r#10'].baseBranch, '8.0');
  });

  await run('C3 · a failed lookup throws and is not cached', async () => {
    const cache = { pulls: {} };
    const http = {
      async get() {
        const err = new Error('boom');
        err.response = { status: 422 };
        throw err;
      },
    };
    const getPull = makePullLookup(cache, { apiCalls: 0 }, http);
    await assert.rejects(() => getPull('o/r', 20));
    assert.equal(cache.pulls['o/r#20'], undefined);
  });

  await run('C4 · full sync keeps only merged-PR facts and drops every verdict', async () => {
    const { TRACKER_RULES_COMMIT } = require('../utils/backport-rules');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bp-')), 'backport-cache.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        rulesCommit: TRACKER_RULES_COMMIT,
        verdicts: { 'https://github.com/o/r/pull/5': { backportOf: null } },
        pulls: {
          'o/r#1': { exists: true, merged: true, state: 'closed' },
          'o/r#2': { exists: true, merged: false, state: 'open' },
          'o/r#3': { exists: true, merged: false, state: 'closed' },
          'o/r#4': { exists: false },
        },
      })
    );
    const log = console.log;
    console.log = () => {};
    try {
      await pruneForFullSync(file);
    } finally {
      console.log = log;
    }
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(after.verdicts, {});
    assert.deepEqual(Object.keys(after.pulls), ['o/r#1']);
  });

  if (process.exitCode) {
    console.error('\nfixture run FAILED');
  } else {
    console.log('\nall backport-detection fixtures passed');
  }
})();
