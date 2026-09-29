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
  resolveManualDependencyBackport,
} = require('./backport-rules');
const {
  extractDeclaration,
  hashWatchedPieces,
  diffAgainstBaseline,
} = require('./tracker-rules-watch');

const REPO = 'mautic/user-documentation';
const DEV = 'mautic/developer-documentation-new';

/** The parent number from extractBackportParentNumber's { number, repo }, or null. */
const num = (r) => (r ? r.number : null);

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
    assert.equal(num(extractBackportParentNumber(text, REPO)), 927);
  });

  await run('R2 · "back/forward port … (PR #973)" in the body (real #1000)', () => {
    const body = 'This is a back/forward port of the same fix opened for 7.3 (PR #973).';
    assert.equal(num(extractBackportParentNumber(body, REPO)), 973);
  });

  await run('R3 · other wordings: backported, forward port, back and forward port', () => {
    assert.equal(num(extractBackportParentNumber('Backported from #913', REPO)), 913);
    assert.equal(num(extractBackportParentNumber('A forward port of #12 to 8.0', REPO)), 12);
    assert.equal(num(extractBackportParentNumber('The back and forward port of #44', REPO)), 44);
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
    assert.equal(num(extractBackportParentNumber(body, REPO)), 880);
  });

  await run('R7 · a plain mention with no backport wording is not a parent', () => {
    assert.equal(extractBackportParentNumber('Follow-up to #500, fixes a typo.', REPO), null);
  });

  await run('R8 · the FIRST "#N" wins, not the last one within reach (real #785)', () => {
    const body =
      '7.2 backport of the segment read-date clarification (PR #754 / mautic#16224), ' +
      'brought into 7.x via merge PR #16327.';
    assert.equal(num(extractBackportParentNumber(body, REPO)), 754);
  });

  await run('R9 · "port" alone only counts when includePortAlone is true', () => {
    const body = 'Ports the Roles overview documentation from PR #815 to the 7.2 branch.';
    assert.equal(num(extractBackportParentNumber(body, REPO, true)), 815);
    assert.equal(extractBackportParentNumber(body, REPO, false), null);
  });

  await run("R10 · a link to the sister docs repo is read as that repo's PR", () => {
    const body = `This PR cherry-picks https://github.com/${REPO}/pull/842 to fix the table overflow.`;
    const found = extractBackportParentNumber(body, DEV);
    assert.equal(found.number, 842);
    assert.equal(found.repo, REPO);
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

  await run('F8 · a "— branch X" title trusts the first bare "#N" in the body (real dev #499)', async () => {
    const { getPull } = fakePulls({ 481: { baseBranch: '7.0' } });
    const parent = await findBackportParent({
      repo: DEV,
      number: 499,
      title: 'docs: Add Tags API endpoint documentation - branch 7.1',
      body:
        '## Description\n\nThis PR adds Tags API endpoint documentation based on #481.\n\n' +
        '<!-- Type "Closes" followed by a hashtag (#) symbol -->',
      baseBranch: '7.1',
      createdAt: '2026-05-26T00:00:00Z',
      getPull,
    });
    assert.equal(parent.number, 481);
    assert.equal(parent.branch, '7.0');
  });

  // The real body (GitHub's standard PR template), including the "Closes
  // #123" example wrapped in an HTML comment — invisible on GitHub, but a
  // real trap for any bare-"#N" pattern that doesn't skip comments.
  const DEV_596_BODY = [
    '## Description',
    '',
    'This PR cherry-picks https://github.com/mautic/user-documentation/pull/842 from user docs into the 7.2 branch.',
    '',
    '<!-- PLEASE WRITE ABOVE THIS COMMENT. -->',
    '',
    '## Linked issue',
    '',
    'N/A',
    '',
    '<!--',
    '',
    'Type the keyword "Closes" followed by a hashtag (#) symbol and the issue number. For example:',
    '',
    '❌ Closes: #123.',
    '',
    '✅ Closes #123',
    '',
    '-->',
  ].join('\n');

  await run(
    'F9 · a same-repo bare "#N" that fails still blocks the sister-repo URL (real dev #596, KNOWN GAP)',
    async () => {
      // The title's bare "#842" matches the tracker's word pattern first and
      // wins outright — even though DEV#842 doesn't exist and the body's URL
      // clearly names the real parent in the sister repo. The tracker's own
      // extractBackportParentNumber never falls back to the URL check once
      // the word pattern has matched, so this real case still needs
      // oss-portfolio's own addition (see backport-additions.js, rule 5).
      const getPull = async (repo, number) => {
        if (repo === REPO && number === 842) return { baseBranch: '7.2', merged: true };
        return null;
      };
      const parent = await findBackportParent({
        repo: DEV,
        number: 596,
        title: 'Cherry pick PR #842 to fix table overflow from user docs to branch 7.2',
        body: DEV_596_BODY,
        baseBranch: '7.2',
        createdAt: '2026-06-10T00:00:00Z',
        getPull,
      });
      assert.equal(parent, null);
    }
  );

  await run(
    'F10 · a "Closes #123" template example inside an HTML comment is never trusted (real dev #596)',
    async () => {
      // Without stripping the comment first, the title's "to branch 7.2"
      // suffix (see F9) makes signal 1b trust the FIRST bare "#N" in the
      // body — which, with no comment-stripping, is the template's own
      // placeholder "#123", not the real "#842" reference (only ever named
      // via a URL). PR #123 happens to be a real PR in this repo, so the
      // wrong number would otherwise pass confirmation and win outright.
      const getPull = async (repo, number) => {
        if (repo === DEV && number === 123) {
          return { baseBranch: 'main', author: 'dependabot[bot]', merged: false };
        }
        return null;
      };
      const parent = await findBackportParent({
        repo: DEV,
        number: 596,
        title: 'Cherry pick PR #842 to fix table overflow from user docs to branch 7.2',
        body: DEV_596_BODY,
        baseBranch: '7.2',
        createdAt: '2026-06-10T00:00:00Z',
        getPull,
      });
      assert.equal(parent, null);
    }
  );

  // --- resolveManualDependencyBackport ---------------------------------------

  await run(
    'D1 · a hand-made copy of a dependabot PR is recorded (real dev #607 → #603)',
    async () => {
      const { getPull } = fakePulls({ 603: { baseBranch: '7.1', author: 'dependabot[bot]' } });
      const { isManualDependencyBackport, parent } = await resolveManualDependencyBackport({
        repo: DEV,
        number: 607,
        title: 'chore(deps): bump rstcheck from 6.2.5 to 6.3.0 in /docs" — branch 7.2',
        body: `This PR bumps rstcheck from 6.2.5 to 6.3.0 in /docs, following https://github.com/${DEV}/pull/603.`,
        baseBranch: '7.2',
        getPull,
      });
      assert.equal(isManualDependencyBackport, true);
      assert.equal(parent.number, 603);
    }
  );

  await run('D2 · a referenced PR that is NOT dependabot is not a manual dependency backport', async () => {
    const { getPull } = fakePulls({ 603: { baseBranch: '7.1', author: 'someone' } });
    const { isManualDependencyBackport, parent } = await resolveManualDependencyBackport({
      repo: DEV,
      number: 607,
      title: 'docs: mention PR #603',
      body: 'See #603 for context.',
      baseBranch: '7.2',
      getPull,
    });
    assert.equal(isManualDependencyBackport, false);
    assert.equal(parent, null);
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
