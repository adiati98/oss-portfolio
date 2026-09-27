/**
 * Fixture run for the copied tracker backport rules and the change alert.
 * Run: node scripts/utils/backport-rules.test.js
 */
const assert = require('assert');
const {
  extractBackportParentNumber,
  normalizeTitleForBackportMatch,
  backportTitleSuffixBranch,
  findBackportParent,
  isTitleMatchAllowed,
} = require('./backport-rules');
const {
  extractDeclaration,
  hashWatchedPieces,
  diffAgainstBaseline,
} = require('./tracker-rules-watch');

const REPO = 'mautic/user-documentation';

async function run(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

/** A fake getPull backed by a table of PRs: { number: { baseBranch, author, merged } }. */
function fakePulls(table) {
  const calls = [];
  const getPull = async (repo, number) => {
    calls.push(number);
    return table[number] ? { merged: false, ...table[number] } : null;
  };
  return { getPull, calls };
}

(async () => {
  console.log('backport-rules fixtures');

  // --- Reference in the title/body -----------------------------------------

  await run('R1 · "cherry-pick #927" in the title (real #937)', () => {
    const text = 'docs: cherry-pick #927 Point Actions nav path and label update (7.1)';
    assert.equal(extractBackportParentNumber(text, REPO), 927);
  });

  await run('R2 · "back/forward port … (PR #973)" in the body (real #1000)', () => {
    const body = 'This is a back/forward port of the same fix opened for 7.3 (PR #973).';
    assert.equal(extractBackportParentNumber(body, REPO), 973);
  });

  await run('R3 · other wordings: backported, forward port, back and forward port', () => {
    assert.equal(extractBackportParentNumber('Backported from #913', REPO), 913);
    assert.equal(extractBackportParentNumber('A forward port of #12 to 8.0', REPO), 12);
    assert.equal(extractBackportParentNumber('The back and forward port of #44', REPO), 44);
  });

  await run('R4 · a cross-repo number (mautic/mautic#16849) is not a parent', () => {
    const body = 'This cherry-picks the documentation for mautic/mautic#16849 onto 7.1.';
    assert.equal(extractBackportParentNumber(body, REPO), null);
  });

  await run('R5 · a number in the NEXT sentence is not a parent', () => {
    const body = 'Merge this, then cherry-pick to 7.1/7.0/6.0/5.x. Resolves docs issue #391';
    assert.equal(extractBackportParentNumber(body, REPO), null);
  });

  await run('R6 · a full link to a PR in the same repo counts', () => {
    const body = `Backport of https://github.com/${REPO}/pull/880 to 6.0`;
    assert.equal(extractBackportParentNumber(body, REPO), 880);
  });

  await run('R7 · a plain mention with no backport wording is not a parent', () => {
    assert.equal(extractBackportParentNumber('Follow-up to #500, fixes a typo.', REPO), null);
  });

  // --- Title suffix -----------------------------------------------------------

  await run('T1 · branch suffixes are removed before comparing titles', () => {
    const a = 'docs: Fix linkcheck failure on aivie.ch (WAF rejects the checker) (8.0)';
    const b = 'docs: Fix linkcheck failure on aivie.ch (WAF rejects the checker) (7.3 backport)';
    assert.equal(normalizeTitleForBackportMatch(a), normalizeTitleForBackportMatch(b));
    assert.equal(backportTitleSuffixBranch(a), '8.0');
    assert.equal(backportTitleSuffixBranch('Some title [backport 6.0]'), '6.0');
  });

  // --- findBackportParent ---------------------------------------------------

  await run('F1 · #1000 → #973: reference found, parent on another branch', async () => {
    const { getPull } = fakePulls({ 973: { baseBranch: '7.3', merged: true } });
    const parent = await findBackportParent({
      repo: REPO,
      number: 1000,
      title: 'docs: Fix linkcheck failure on aivie.ch (WAF rejects the checker) (8.0)',
      body: 'This is a back/forward port of the same fix opened for 7.3 (PR #973).',
      baseBranch: '8.0',
      createdAt: '2026-09-24T00:00:00Z',
      getPull,
    });
    assert.equal(parent.number, 973);
    assert.equal(parent.branch, '7.3');
    assert.equal(parent.merged, true);
  });

  await run('F2 · a referenced number that is an issue (no PR) is rejected', async () => {
    const { getPull } = fakePulls({});
    const parent = await findBackportParent({
      repo: REPO,
      number: 50,
      title: 'Cherry-pick #49 to 7.0',
      body: '',
      baseBranch: '7.0',
      createdAt: '2026-01-02T00:00:00Z',
      getPull,
    });
    assert.equal(parent, null);
  });

  await run('F3 · a referenced PR on the SAME branch is rejected', async () => {
    const { getPull } = fakePulls({ 49: { baseBranch: '7.0' } });
    const parent = await findBackportParent({
      repo: REPO,
      number: 50,
      title: 'Cherry-pick #49 to 7.0',
      body: '',
      baseBranch: '7.0',
      createdAt: '2026-01-02T00:00:00Z',
      getPull,
    });
    assert.equal(parent, null);
  });

  const pool = [
    {
      repo: REPO,
      number: 10,
      title: 'docs: Add Tags documentation for Contact management',
      createdAt: '2026-04-01T00:00:00Z',
    },
    {
      repo: REPO,
      number: 11,
      title: 'docs: Add Tags documentation for Contact management (6.0)',
      createdAt: '2026-04-02T00:00:00Z',
    },
    {
      repo: REPO,
      number: 12,
      title: 'docs: Add Tags documentation for Contact management (5.2)',
      createdAt: '2026-04-03T00:00:00Z',
    },
  ];

  await run('F4 · same title, no reference → the earliest older PR on another branch', async () => {
    const { getPull } = fakePulls({ 10: { baseBranch: '7.0' }, 11: { baseBranch: '6.0' } });
    const parent = await findBackportParent({
      repo: REPO,
      number: 12,
      title: pool[2].title,
      body: '',
      baseBranch: '5.2',
      createdAt: pool[2].createdAt,
      pool,
      getPull,
    });
    assert.equal(parent.number, 10);
  });

  await run('F5 · the ORIGINAL is never a copy of its own later copy', async () => {
    const { getPull, calls } = fakePulls({ 11: { baseBranch: '6.0' }, 12: { baseBranch: '5.2' } });
    const parent = await findBackportParent({
      repo: REPO,
      number: 10,
      title: pool[0].title,
      body: '',
      baseBranch: '7.0',
      createdAt: pool[0].createdAt,
      pool,
      getPull,
    });
    assert.equal(parent, null);
    assert.equal(calls.length, 0, 'no API call when no candidate exists');
  });

  await run('F6 · title matching is off for dependabot and for a bump backport title', async () => {
    const { getPull } = fakePulls({});
    assert.equal(
      await isTitleMatchAllowed({
        repo: REPO,
        number: 1,
        title: 'x',
        author: 'dependabot[bot]',
        getPull,
      }),
      false
    );
    assert.equal(
      await isTitleMatchAllowed({
        repo: REPO,
        number: 1,
        title: 'chore(deps): bump rstcheck from 6.2.5 to 6.3.0 in /docs — branch 7.0',
        author: 'someone',
        baseBranch: '7.0',
        getPull,
      }),
      false
    );
    assert.equal(
      await isTitleMatchAllowed({
        repo: REPO,
        number: 1,
        title: 'docs: a normal change',
        author: 'someone',
        getPull,
      }),
      true
    );
  });

  await run('F7 · no branch lookup at all for a PR with no candidate', async () => {
    let asked = false;
    const parent = await findBackportParent({
      repo: REPO,
      number: 99,
      title: 'docs: something completely different',
      body: 'Nothing to see here.',
      baseBranch: () => {
        asked = true;
        return '7.0';
      },
      createdAt: '2026-05-01T00:00:00Z',
      pool,
      getPull: async () => {
        throw new Error('should not be called');
      },
    });
    assert.equal(parent, null);
    assert.equal(asked, false);
  });

  // --- Change alert ---------------------------------------------------------

  const trackerSample = [
    'const REPOS = {',
    '\tdocs: ["a/b"],',
    '}',
    '',
    '// explains the pattern',
    'const SENTENCE_BREAK = String.raw`\\.\\s+[A-Z]`',
    'async function findBackportParent({',
    '\trepo,',
    '}) {',
    '\t// a comment',
    '\treturn null',
    '}',
    'function main() {',
    '\tconst backportParentMerged = backportParent !== null && backportParent.merged',
    '}',
  ].join('\n');

  await run('W1 · declarations are cut at the right place', () => {
    assert.equal(extractDeclaration(trackerSample, 'REPOS'), 'const REPOS = {\ndocs: ["a/b"],\n}');
    assert.equal(
      extractDeclaration(trackerSample, 'findBackportParent'),
      'async function findBackportParent({\nrepo,\n}) {\nreturn null\n}'
    );
    assert.equal(extractDeclaration(trackerSample, 'missingThing'), null);
  });

  await run('W2 · a comment change is ignored, a code change is caught', () => {
    const base = hashWatchedPieces(trackerSample);
    const reworded = hashWatchedPieces(trackerSample.replace('// a comment', '// reworded'));
    assert.deepEqual(diffAgainstBaseline(reworded, base), { changed: [], missing: [] });
    const changed = hashWatchedPieces(trackerSample.replace('\treturn null', '\treturn 1'));
    assert.deepEqual(diffAgainstBaseline(changed, base).changed, ['findBackportParent']);
    const handling = hashWatchedPieces(
      trackerSample.replace('backportParent.merged', 'backportParent.mergedAt')
    );
    assert.deepEqual(diffAgainstBaseline(handling, base).changed, [
      'backport handling (lines inside main)',
    ]);
  });

  await run('W3 · a renamed declaration is reported as missing', () => {
    const base = hashWatchedPieces(trackerSample);
    const renamed = hashWatchedPieces(
      trackerSample.replace('const SENTENCE_BREAK', 'const SENTENCE_END')
    );
    assert.ok(diffAgainstBaseline(renamed, base).missing.includes('SENTENCE_BREAK'));
  });

  if (process.exitCode) {
    console.error('\nfixture run FAILED');
  } else {
    console.log('\nall backport-rules fixtures passed');
  }
})();
