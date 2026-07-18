/**
 * Fixture run for the workbench merge engine — executable spec for the lane
 * derivation in the design blueprint §05. Run: node scripts/services/workbench-merge.test.js
 */
const assert = require('assert');
const {
  mergeWorkbench,
  computeImpact,
  isValidTrackerShape,
  extractLinkedCodePr,
  extractIssueRefs,
} = require('./workbench-merge');

const NOW = new Date('2026-07-11T12:00:00Z');
const ME = 'adiati98';
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function local(overrides) {
  return {
    title: 'Fixture task',
    url: 'https://github.com/x/y/pull/1',
    repo: 'x/y',
    number: 1,
    status: 'Review in progress',
    updatedAt: daysAgo(2),
    lastSubstantiveDate: daysAgo(2),
    user: { login: 'someone' },
    ...overrides,
  };
}

function run(name, input, checks) {
  const feed = input.feed || { data: input.tracker || {}, fetchedAt: NOW.toISOString(), degraded: false };
  const out = mergeWorkbench({ ...input, feed, username: ME, now: NOW });
  try {
    checks(out);
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`);
    process.exitCode = 1;
  }
  return out;
}

console.log('workbench-merge fixtures');

// 1. Matched pair joins on repo#number
run(
  'matched local+tracker pair',
  {
    tasks: [local({ repo: 'mautic/developer-documentation-new', number: 593, lastActor: 'reviewer1', author: 'reviewer1' })],
    tracker: {
      'mautic/developer-documentation-new#593': {
        docsUpdatedAt: daysAgo(1),
        codeUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/developer-documentation-new#593');
    assert.equal(r.source, 'local+tracker');
    assert.ok(r.upstream && r.upstream.codeUpdatedAt);
  }
);

// 2. Local-only row renders without upstream
run(
  'local-only row (untracked repo)',
  { prs: [local({ repo: 'OpenSource-Communities/oss-communities', number: 2, lastActor: ME, author: ME })] },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.source, 'local');
    assert.equal(r.upstream, null);
    assert.equal(r.lane, 'waiting'); // last actor is me → ball with others
  }
);

// 3. Tracker-only row appears with constructed URL, null title
run(
  'tracker-only row',
  {
    tracker: {
      'mautic/user-documentation#800': {
        docsUpdatedAt: daysAgo(3),
        codeUpdatedAt: null,
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#800');
    assert.equal(r.source, 'tracker');
    assert.equal(r.title, null);
    assert.equal(r.url, 'https://github.com/mautic/user-documentation/pull/800');
  }
);

// 4. Approved + linked code PR → ready lane, code-aware next step
run(
  'approved with linked code PR → ready, bring-it-home step',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 714,
        reviewState: 'APPROVED',
        approvedBy: 'escopecz',
        author: ME,
        lastActor: 'escopecz',
        body: 'Docs for https://github.com/mautic/mautic/pull/16123',
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'ready');
    assert.equal(r.ball, 'Approved');
    assert.equal(r.approval.by, 'escopecz');
    assert.equal(r.linkedCodePr.ref, 'mautic/mautic#16123');
    assert.ok(/code PR/i.test(r.nextStep), `nextStep was: ${r.nextStep}`);
  }
);

// 5. Note after approval flips back to the action lane
run(
  'note since approval → action lane',
  {
    tasks: [local({ repo: 'mautic/user-documentation', number: 807, lastActor: 'author1', author: 'author1' })],
    tracker: {
      'mautic/user-documentation#807': {
        docsUpdatedAt: daysAgo(1),
        codeUpdatedAt: null,
        rawDocsReviews: [{ user: { login: 'adiux' }, state: 'APPROVED', submitted_at: daysAgo(4) }],
        rawDocsComments: [{ user: { login: 'author1' }, created_at: daysAgo(1), body: 'One more thing…' }],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#807');
    assert.equal(r.approval.state, 'APPROVED');
    assert.equal(r.approval.noteSince, true);
    assert.equal(r.lane, 'action');
    assert.ok(/note since approval/i.test(r.nextStep));
  }
);

// 6. Approved and idle past the reminder threshold → nudge hint
run(
  'approved 9 days idle → nudge a maintainer',
  {
    prs: [
      local({
        repo: 'x/y',
        number: 9,
        reviewState: 'APPROVED',
        approvedBy: 'm1',
        updatedAt: daysAgo(9),
        lastSubstantiveDate: daysAgo(9),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'ready');
    assert.ok(/nudge/i.test(records[0].nextStep), records[0].nextStep);
  }
);

// 7. 31 days idle, not approved → stalled with decision hint
run(
  '31d idle → stalled',
  { prs: [local({ number: 31, updatedAt: daysAgo(31), lastSubstantiveDate: daysAgo(31), lastActor: 'other', author: ME })] },
  ({ records }) => {
    assert.equal(records[0].lane, 'stalled');
    assert.equal(records[0].ball, 'Stale');
    assert.ok(/nudge or close/.test(records[0].nextStep));
  }
);

// 8. Bot traffic folds into the bot lane
run(
  'dependabot → bot lane',
  { tasks: [local({ number: 99, user: { login: 'dependabot[bot]' }, title: 'Bump lodash from 4 to 5' })] },
  ({ records }) => assert.equal(records[0].lane, 'bot')
);

// 9. Malformed upstream data degrades, never throws
run(
  'schema drift degrades the feed, local rows still lane-placed',
  {
    prs: [local({ number: 5, lastActor: 'other-human', author: ME, hasFormalReview: true })],
    feed: { data: {}, fetchedAt: null, degraded: true, reason: 'schema drift' },
  },
  ({ records, feed }) => {
    assert.equal(feed.degraded, true);
    assert.equal(records[0].lane, 'action');
    assert.ok(/review feedback/i.test(records[0].nextStep));
  }
);
assert.equal(isValidTrackerShape([1, 2, 3]), false);
assert.equal(isValidTrackerShape({ 'not a key': {} }), false);
assert.equal(isValidTrackerShape({}), true);
console.log('  ok  isValidTrackerShape rejects drifted shapes');

// 11. Reviewing and the author moved → your turn
run(
  'reviewing, author replied → action',
  { tasks: [local({ number: 11, lastActor: 'writer1', author: 'writer1' })] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].ball, 'Take Action');
  }
);

// 12. Assigned issue → action ("to write")
run(
  'assigned issue → to write',
  { issues: [{ title: 'Add docs', url: 'u', repo: 'x/y', number: 12, updatedAt: daysAgo(1), labels: ['documentation'] }] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].ball, 'To Write');
  }
);

// 12b. An assigned issue with no PR stays actionable however long it sits.
// Regression: staleness used to win, burying it in a folded lane that read
// "nudge or close" — the opposite of "write this".
run(
  'assigned issue idle 50d, no PR → still To Write, never stalled',
  { issues: [{ title: 'Add docs', url: 'u', repo: 'x/y', number: 731, updatedAt: daysAgo(50) }] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].ball, 'To Write');
    assert.ok(/no PR yet/i.test(records[0].nextStep), records[0].nextStep);
    assert.ok(/50d/.test(records[0].nextStep), records[0].nextStep);
  }
);

// 12c. Once a PR of yours addresses the issue, it stops nagging
run(
  'assigned issue with a linked PR → watching, not To Write',
  {
    issues: [{ title: 'Add docs', url: 'u', repo: 'x/y', number: 731, updatedAt: daysAgo(50) }],
    prs: [local({ repo: 'x/y', number: 900, body: 'Closes #731', lastActor: ME, author: ME })],
  },
  ({ records }) => {
    const issue = records.find((r) => r.relationship === 'assigned issue');
    assert.equal(issue.lane, 'waiting');
    assert.equal(issue.ball, 'Watching');
    assert.equal(issue.linkedPr.ref, 'x/y#900');
    assert.ok(/x\/y#900/.test(issue.nextStep), issue.nextStep);
  }
);

// 12d. PR-template boilerplate must not silence a real issue. Unedited
// templates ship "Closes: #123" across unrelated PRs; #123 is assigned to
// nobody, so the placeholder is dropped and #731 still reads To Write.
run(
  'template placeholder ref does not link',
  {
    issues: [{ title: 'Add docs', url: 'u', repo: 'x/y', number: 731, updatedAt: daysAgo(3) }],
    prs: [
      local({ repo: 'x/y', number: 848, body: 'Closes: #123', lastActor: ME, author: ME }),
      local({ repo: 'x/y', number: 841, body: 'Closes: #123', lastActor: ME, author: ME }),
    ],
  },
  ({ records }) => {
    const issue = records.find((r) => r.relationship === 'assigned issue');
    assert.equal(issue.linkedPr, null);
    assert.equal(issue.ball, 'To Write');
  }
);

// 12e. Cross-repo and URL-shaped issue refs both resolve
{
  const refs = extractIssueRefs('see https://github.com/a/b/issues/5 and c/d#7 plus #9', 'x/y');
  assert.ok(refs.has('a/b#5'), 'issue URL');
  assert.ok(refs.has('c/d#7'), 'cross-repo shorthand');
  assert.ok(refs.has('x/y#9'), 'bare ref resolves to own repo');
  assert.ok(!refs.has('x/y#7'), 'cross-repo ref must not resolve to own repo');
  console.log('  ok  issue ref extraction');
}

// 13. Impact numbers
{
  const { records } = mergeWorkbench({
    prs: [local({ number: 9, reviewState: 'APPROVED', approvedBy: 'm', updatedAt: daysAgo(1), lastSubstantiveDate: daysAgo(1) })],
    issues: [{ title: 'i', url: 'u', repo: 'a/b', number: 1, updatedAt: daysAgo(1) }],
    feed: { data: {}, fetchedAt: null, degraded: false },
    username: ME,
    now: NOW,
  });
  const impact = computeImpact(
    records,
    {
      pullRequests: [
        { date: daysAgo(5), mergedAt: daysAgo(5) },
        { date: '2024-01-01', mergedAt: '2024-01-01' },
      ],
      reviewedPrs: [
        { author: 'alice', mergedAt: daysAgo(1) },
        { author: 'bob', mergedAt: daysAgo(1) },
        { author: 'dependabot[bot]', mergedAt: daysAgo(1) },
      ],
      coAuthoredPrs: [{ author: 'alice', date: daysAgo(2), mergedAt: daysAgo(1) }],
    },
    NOW
  );
  // 1 own PR + 3 reviewed + 1 co-authored merged this quarter; the 2024 PR
  // is out of quarter. shippedThisQuarter counts every way work ships
  // (own/reviewed/co-authored), unlike helpedShipCount below which is
  // deliberately reviewed/co-authored only.
  assert.equal(impact.shippedThisQuarter, 5);
  assert.equal(impact.contributorsHelped, 2); // alice + bob, bot excluded
  assert.equal(impact.helpedShipCount, 4); // all 4 merged items, bot included
  // Every item above merged within the last 2 days, so the this-month
  // figures (what the Workbench shows) match the lifetime ones here.
  assert.equal(impact.contributorsHelpedThisMonth, 2);
  assert.equal(impact.helpedShipThisMonth, 4);
  assert.equal(impact.approvedLanding, 1);
  assert.equal(impact.needAction, 1);
  console.log('  ok  impact numbers');
}

// 13b. Reviewed/co-authored PRs that never merged don't count as "helped
// ship" — regression: helpedShipCount and contributorsHelped used to count
// every reviewed/co-authored PR regardless of outcome, so a PR still open
// or closed without merging was claimed as shipped work.
{
  const impact = computeImpact(
    [],
    {
      reviewedPrs: [
        { author: 'alice', mergedAt: daysAgo(1) }, // merged → counts
        { author: 'carol', mergedAt: null, state: 'open' }, // still open
        { author: 'dave', mergedAt: null, state: 'closed' }, // closed, never merged
      ],
      coAuthoredPrs: [
        { author: 'alice', mergedAt: daysAgo(1) }, // merged → counts
        { author: 'erin', mergedAt: null, state: 'open' },
      ],
    },
    NOW
  );
  assert.equal(impact.helpedShipCount, 2, `expected only the 2 merged items, got ${impact.helpedShipCount}`);
  assert.equal(impact.contributorsHelped, 1, 'only alice merged; carol/dave/erin never shipped');
  console.log('  ok  unmerged reviewed/co-authored PRs excluded from "helped ship"');
}

// 13c. The Workbench's "this month" figures reset by calendar month, not by
// a rolling window — work merged/dated in a prior month must not leak into
// the current month's count, for either the helped-ship tally or the
// projects/organizations touched.
{
  const impact = computeImpact(
    [],
    {
      pullRequests: [{ repo: 'solo/repo', date: daysAgo(2) }], // authored, this month; doesn't count toward "helped ship"
      reviewedPrs: [
        { author: 'alice', repo: 'reviewed/this-month', date: daysAgo(2), mergedAt: daysAgo(2) },
        { author: 'bob', repo: 'reviewed/last-month', date: '2026-05-15T00:00:00Z', mergedAt: '2026-05-15T00:00:00Z' },
      ],
      coAuthoredPrs: [
        { author: 'alice', repo: 'reviewed/this-month', date: daysAgo(3), mergedAt: daysAgo(1) },
      ],
    },
    NOW
  );
  assert.equal(impact.helpedShipThisMonth, 2, "bob's May merge must not count in July");
  assert.equal(impact.contributorsHelpedThisMonth, 1, 'only alice shipped this month');
  assert.equal(
    impact.projectsThisMonth,
    2,
    "solo/repo + reviewed/this-month; reviewed/last-month wasn't touched this month"
  );
  assert.equal(impact.organizationsThisMonth, 2);
  console.log('  ok  "this month" figures reset by calendar month, not a rolling window');
}

// 14. Linked code PR extraction ignores self-references
assert.equal(extractLinkedCodePr('see mautic/mautic#161', 'mautic/docs'), 'mautic/mautic#161');
assert.equal(extractLinkedCodePr('fixes x/y#5', 'x/y'), null);
console.log('  ok  linked code PR extraction');

if (process.exitCode) {
  console.error('\nfixture run FAILED');
} else {
  console.log('\nall workbench-merge fixtures passed');
}
