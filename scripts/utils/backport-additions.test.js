/**
 * Fixture run for oss-portfolio's own backport additions, using the real
 * wording of the PRs they were written for.
 * Run: node scripts/utils/backport-additions.test.js
 */
const assert = require('assert');
const { findAdditionalParent } = require('./backport-additions');
const { backportParentLabel } = require('./contribution-formatters');

const USER = 'mautic/user-documentation';
const DEV = 'mautic/developer-documentation-new';

async function run(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

/** getPull backed by a table keyed "repo#number". */
function pulls(table) {
  return async (repo, number) => {
    const p = table[`${repo}#${number}`];
    return p ? { merged: true, author: 'someone', ...p } : null;
  };
}

(async () => {
  console.log('backport-additions fixtures');

  await run('5 · a link to the other docs repo: dev #596 → user-documentation #842', async () => {
    const parent = await findAdditionalParent({
      repo: DEV,
      number: 596,
      title: 'Cherry pick PR #842 to fix table overflow from user docs to branch 7.2',
      body: `This PR cherry-picks https://github.com/${USER}/pull/842 to fix the table overflow.`,
      getPull: pulls({ [`${USER}#842`]: { baseBranch: '7.2' } }),
    });
    assert.equal(parent.repo, USER);
    assert.equal(parent.number, 842);
    assert.equal(parent.rule, 5);
  });

  await run('5 · a CODE PR link (mautic/mautic) is never a parent', async () => {
    const parent = await findAdditionalParent({
      repo: DEV,
      number: 700,
      title: 'Document the new API',
      body: 'This cherry-picks the documentation for https://github.com/mautic/mautic/pull/16849 onto 7.1.',
      getPull: pulls({ 'mautic/mautic#16849': { baseBranch: '7.x' } }),
    });
    assert.equal(parent, null);
  });

  await run('5 · a referenced sister-repo PR that does not exist is not a parent', async () => {
    const parent = await findAdditionalParent({
      repo: DEV,
      number: 701,
      title: 'Cherry pick PR #900 from user docs to branch 7.2',
      body: `Backport of https://github.com/${USER}/pull/900.`,
      getPull: pulls({}),
    });
    assert.equal(parent, null);
  });

  await run('label · same repo "#842", other repo "user-documentation #842"', () => {
    const url = `https://github.com/${USER}/pull/842`;
    assert.equal(backportParentLabel(url, USER), '#842');
    assert.equal(backportParentLabel(url, DEV), 'user-documentation #842');
  });

  if (process.exitCode) {
    console.error('\nfixture run FAILED');
  } else {
    console.log('\nall backport-additions fixtures passed');
  }
})();
