/**
 * Fixture run for oss-portfolio's own backport additions, using the real
 * wording of the PRs they were written for.
 * Run: node scripts/utils/backport-additions.test.js
 */
const assert = require('assert');
const { findFirstReferenceParent, findAdditionalParent } = require('./backport-additions');
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

  await run('1 · first #N wins: user #785 → #754, not the later #16327', async () => {
    const parent = await findFirstReferenceParent({
      repo: USER,
      number: 785,
      title: 'Clarify segment behavioral date filters evaluate most recent date (7.2)',
      body: '7.2 backport of the segment read-date clarification (PR #754 / mautic#16224), brought into 7.x via merge PR #16327. Documents that…',
      getBase: async () => '7.2',
      getPull: pulls({ [`${USER}#754`]: { baseBranch: '7.1' } }),
    });
    assert.equal(parent.number, 754);
  });

  await run(
    '2 · dependency-bump copy: dev #607 → #603 (dependabot parent, "following" link)',
    async () => {
      const parent = await findAdditionalParent({
        repo: DEV,
        number: 607,
        title: 'chore(deps): bump rstcheck from 6.2.5 to 6.3.0 in /docs" — branch 7.2',
        body: `This PR bumps rstcheck from 6.2.5 to 6.3.0 in /docs, following https://github.com/${DEV}/pull/603.`,
        author: 'adiati98',
        createdAt: '2026-07-30T00:00:00Z',
        getBase: async () => '7.2',
        getPull: pulls({ [`${DEV}#603`]: { baseBranch: '7.1', author: 'dependabot[bot]' } }),
      });
      assert.equal(parent.number, 603);
      assert.equal(parent.rule, 2);
    }
  );

  await run('3 · "Ports … from PR #815": user #821 → #815', async () => {
    const parent = await findAdditionalParent({
      repo: USER,
      number: 821,
      title: 'docs: Add Roles overview section with User Count sorting (7.2 port)',
      body: 'Ports the Roles overview documentation from PR #815 to the 7.2 branch, as requested by maintainer @adiati98.',
      author: 'promptless-for-oss',
      createdAt: '2026-07-02T12:00:00Z',
      getBase: async () => '7.2',
      getPull: pulls({ [`${USER}#815`]: { baseBranch: '7.1' } }),
    });
    assert.equal(parent.number, 815);
    assert.equal(parent.rule, 3);
  });

  await run(
    '3 · a dependabot changelog saying "port of linkify-it … #82" is NOT a parent',
    async () => {
      const parent = await findAdditionalParent({
        repo: DEV,
        number: 635,
        title: 'chore(deps): bump linkify-it-py from 2.1.0 to 2.1.1 in /docs',
        body: 'Fix match(), port of linkify-it 5.0.1 (#82)',
        author: 'dependabot[bot]',
        createdAt: '2026-08-01T00:00:00Z',
        getBase: async () => '7.1',
        getPull: pulls({ [`${DEV}#82`]: { baseBranch: 'main' } }),
      });
      assert.equal(parent, null);
    }
  );

  await run('4b · "- branch 7.1" + "based on #481": dev #499 → #481', async () => {
    const parent = await findAdditionalParent({
      repo: DEV,
      number: 499,
      title: 'docs: Add Tags API endpoint documentation - branch 7.1',
      body: '## Description\n\nThis PR adds Tags API endpoint documentation based on #481.\n\n<!-- Type "Closes" followed by a hashtag (#) symbol -->',
      author: 'adiati98',
      createdAt: '2026-05-26T00:00:00Z',
      getBase: async () => '7.1',
      getPull: pulls({ [`${DEV}#481`]: { baseBranch: '7.0' } }),
    });
    assert.equal(parent.number, 481);
    assert.equal(parent.rule, '4b');
  });

  await run(
    '4 · "— branch 6.0" title matches the earliest older copy: user #444 → #443',
    async () => {
      const title = (b) =>
        `Add Sphinx variables in \`html_context\` to display edit on GH link — branch ${b}`;
      const parent = await findAdditionalParent({
        repo: USER,
        number: 444,
        title: title('6.0'),
        body: '',
        author: 'adiati98',
        createdAt: '2025-09-20T10:02:00Z',
        getBase: async () => '6.0',
        pool: [
          { repo: USER, number: 443, title: title('5.2'), createdAt: '2025-09-20T10:01:00Z' },
          { repo: USER, number: 445, title: title('7.0'), createdAt: '2025-09-20T10:03:00Z' },
        ],
        getPull: pulls({
          [`${USER}#443`]: { baseBranch: '5.2' },
          [`${USER}#445`]: { baseBranch: '7.0' },
        }),
      });
      assert.equal(parent.number, 443);
      assert.equal(parent.rule, 4);
    }
  );

  await run('5 · a link to the other docs repo: dev #596 → user-documentation #842', async () => {
    const parent = await findAdditionalParent({
      repo: DEV,
      number: 596,
      title: 'Cherry pick PR #842 to fix table overflow from user docs to branch 7.2',
      body: `This PR cherry-picks https://github.com/${USER}/pull/842 to fix the table overflow.`,
      author: 'adiati98',
      createdAt: '2026-06-10T00:00:00Z',
      getBase: async () => '7.2',
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
      author: 'someone',
      createdAt: '2026-06-10T00:00:00Z',
      getBase: async () => '7.1',
      getPull: pulls({ 'mautic/mautic#16849': { baseBranch: '7.x' } }),
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
