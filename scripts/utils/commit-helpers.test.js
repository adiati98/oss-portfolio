/**
 * Fixture run for which cached commit results a full sync keeps.
 * Run: node scripts/utils/commit-helpers.test.js
 */
const assert = require('assert');
const { isSettledCommitResult, COMMIT_RULES_VERSION } = require('./commit-helpers');

function run(name, body) {
  try {
    body();
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

const result = (overrides) => ({
  firstCommitDate: '2026-05-01T10:00:00Z',
  commitCount: 2,
  prUpdatedAt: '2026-05-02T10:00:00Z',
  merged: true,
  rulesVersion: COMMIT_RULES_VERSION,
  ...overrides,
});

console.log('commit-helpers fixtures');

run('C1 · a merged PR, looked up fine, current rules → kept', () => {
  assert.equal(isSettledCommitResult(result()), true);
  assert.equal(isSettledCommitResult(result({ firstCommitDate: null, commitCount: 0 })), true);
});

run('C2 · an open or closed-but-not-merged PR → checked again', () => {
  assert.equal(isSettledCommitResult(result({ merged: false })), false);
});

run('C3 · a failed lookup (e.g. a 403) → checked again', () => {
  assert.equal(isSettledCommitResult(result({ fetchFailed: true })), false);
});

run('C4 · made with older matching rules, or before this field existed → checked again', () => {
  assert.equal(isSettledCommitResult(result({ rulesVersion: COMMIT_RULES_VERSION - 1 })), false);
  const old = result();
  delete old.merged;
  delete old.rulesVersion;
  assert.equal(isSettledCommitResult(old), false);
});

run('C5 · nothing cached → checked', () => {
  assert.equal(isSettledCommitResult(undefined), false);
  assert.equal(isSettledCommitResult(null), false);
});

if (process.exitCode) {
  console.error('\nfixture run FAILED');
} else {
  console.log('\nall commit-helpers fixtures passed');
}
