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
    assert.equal(r.desync, false);
    assert.ok(r.upstream && r.upstream.codeUpdatedAt);
  }
);

// 2. Local-only row renders without upstream, no desync outside tracked repos
run(
  'local-only row (untracked repo)',
  { prs: [local({ repo: 'OpenSource-Communities/oss-communities', number: 2, lastActor: ME, author: ME })] },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.source, 'local');
    assert.equal(r.upstream, null);
    assert.equal(r.desync, false);
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

// 10. Desync: local row in a tracker-covered repo with no key match
run(
  'unmatched key in tracked repo → desync flag',
  {
    prs: [local({ repo: 'mautic/user-documentation', number: 718, lastActor: ME, author: ME })],
    tracker: {
      'mautic/user-documentation#1': { docsUpdatedAt: daysAgo(1), rawDocsReviews: [], rawDocsComments: [] },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#718');
    assert.equal(r.desync, true);
    assert.equal(r.source, 'local');
  }
);

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
      pullRequests: [{ date: daysAgo(5) }, { date: '2024-01-01' }],
      reviewedPrs: [{ author: 'alice' }, { author: 'bob' }, { author: 'dependabot[bot]' }],
      coAuthoredPrs: [{ author: 'alice', date: daysAgo(2) }],
    },
    NOW
  );
  assert.equal(impact.shippedThisQuarter, 2); // 1 PR + 1 co-authored this quarter
  assert.equal(impact.contributorsHelped, 2); // alice + bob, bot excluded
  assert.equal(impact.approvedLanding, 1);
  assert.equal(impact.needAction, 1);
  console.log('  ok  impact numbers');
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
