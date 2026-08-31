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

// 3b. Tracker-only row enriched with a fetched title + linked code PR (see
// fetchTrackerTitleInfo) renders both instead of falling back to repo#number.
run(
  'tracker-only row enriched by titles',
  {
    tracker: {
      'mautic/user-documentation#880': {
        docsUpdatedAt: daysAgo(3),
        codeUpdatedAt: daysAgo(2),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
    titles: {
      'mautic/user-documentation#880': {
        title: 'Update the campaign builder docs',
        linkedCodePr: 'mautic/mautic#16760',
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#880');
    assert.equal(r.source, 'tracker');
    assert.equal(r.title, 'Update the campaign builder docs');
    assert.equal(r.linkedCodePr.ref, 'mautic/mautic#16760');
    assert.equal(r.linkedCodePr.hasActivity, true);
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

// 7. 31 days idle, not approved, and WAITING ON SOMEONE ELSE → stalled with a
// decision hint. The last-actor is you: you've said your piece and nobody has
// come back, which is what "stale" is supposed to mean.
//
// This fixture used to use `lastActor: 'other'` — a human replying on your own
// PR — and assert that it stalled. That is the case the turn rule now rejects:
// a reply you haven't answered is YOUR move, so it belongs in the action lane
// however old it is (see TA3). Staleness needs a row where the ball genuinely
// sits with someone else, so the fixture moves the ball rather than dropping
// the check.
run(
  '31d idle, waiting on others → stalled',
  { prs: [local({ number: 31, updatedAt: daysAgo(31), lastSubstantiveDate: daysAgo(31), lastActor: ME, author: ME })] },
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
      // Shaped like the real all-contributions.json records: no author/user
      // field, because the historical fetch layer never records one.
      reviewedPrs: [
        { mergedAt: daysAgo(1) },
        { mergedAt: daysAgo(1) },
        { mergedAt: daysAgo(1) },
      ],
      coAuthoredPrs: [{ date: daysAgo(2), mergedAt: daysAgo(1) }],
    },
    NOW
  );
  // 1 own PR + 3 reviewed + 1 co-authored merged this quarter; the 2024 PR
  // is out of quarter. shippedThisQuarter counts every way work ships
  // (own/reviewed/co-authored), unlike helpedShipCount below which is
  // deliberately reviewed/co-authored only.
  assert.equal(impact.shippedThisQuarter, 5);
  assert.equal(impact.helpedShipCount, 4); // all 4 merged items
  // Every item above merged within the last 2 days, so the this-month
  // figure (what the Workbench shows) matches the lifetime one here.
  assert.equal(impact.helpedShipThisMonth, 4);
  assert.equal(impact.approvedLanding, 1);
  assert.equal(impact.needAction, 1);
  console.log('  ok  impact numbers');
}

// 13a. No "contributors helped" figure is emitted. It was derived from
// `item.author` / `item.user`, which no historical record carries, so it was
// structurally pinned at 0 — a stat that could only ever report zero is worse
// than no stat. Asserting its ABSENCE keeps it from being reintroduced without
// the fetch-layer change that would make it real.
{
  const impact = computeImpact([], { reviewedPrs: [{ mergedAt: daysAgo(1) }] }, NOW);
  assert.ok(
    !('contributorsHelped' in impact),
    'contributorsHelped must not be emitted — no record carries an author'
  );
  assert.ok(!('contributorsHelpedThisMonth' in impact), 'nor its this-month twin');
  console.log('  ok  no structurally-zero contributorsHelped stat');
}

// 13b. Reviewed/co-authored PRs that never merged don't count as "helped
// ship" — regression: helpedShipCount used to count every reviewed/co-authored
// PR regardless of outcome, so a PR still open or closed without merging was
// claimed as shipped work.
{
  const impact = computeImpact(
    [],
    {
      reviewedPrs: [
        { mergedAt: daysAgo(1) }, // merged → counts
        { mergedAt: null, state: 'open' }, // still open
        { mergedAt: null, state: 'closed' }, // closed, never merged
      ],
      coAuthoredPrs: [
        { mergedAt: daysAgo(1) }, // merged → counts
        { mergedAt: null, state: 'open' },
      ],
    },
    NOW
  );
  assert.equal(impact.helpedShipCount, 2, `expected only the 2 merged items, got ${impact.helpedShipCount}`);
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
        { repo: 'reviewed/this-month', date: daysAgo(2), mergedAt: daysAgo(2) },
        { repo: 'reviewed/last-month', date: '2026-05-15T00:00:00Z', mergedAt: '2026-05-15T00:00:00Z' },
      ],
      coAuthoredPrs: [{ repo: 'reviewed/this-month', date: daysAgo(3), mergedAt: daysAgo(1) }],
    },
    NOW
  );
  assert.equal(impact.helpedShipThisMonth, 2, "the May merge must not count in July");
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

// ===========================================================================
// New tracker semantics, generalized to all repos (§ tracker parity)
// ===========================================================================

// 15. Approval dismissed after a push → stays ready, re-request the approver.
// A dismissed approval no longer shows as APPROVED in GitHub's reviews list
// (it flips to DISMISSED, keeping the approver's login), so it must not be
// silently dropped into the turn-based/stalled logic.
run(
  'dismissed approval → ready, re-request from the approver',
  {
    tasks: [local({ repo: 'mautic/user-documentation', number: 704, lastActor: 'author1', author: 'author1' })],
    tracker: {
      'mautic/user-documentation#704': {
        docsUpdatedAt: daysAgo(1),
        codeUpdatedAt: null,
        rawDocsReviews: [{ user: { login: 'escopecz' }, state: 'DISMISSED', submitted_at: daysAgo(2) }],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#704');
    assert.equal(r.approval.state, 'APPROVED');
    assert.equal(r.approval.dismissed, true);
    assert.equal(r.approval.by, 'escopecz');
    assert.equal(r.lane, 'ready', `expected ready, got ${r.lane}`);
    assert.ok(/re-request review from escopecz/i.test(r.nextStep), r.nextStep);
  }
);

// 15b. Boundary: a change request landing AFTER the dismissal supersedes it —
// the PR is no longer approved, so it falls to the turn-based lane, not ready.
run(
  'dismissed approval then changes requested → not ready (turn-based)',
  {
    tasks: [local({ repo: 'mautic/user-documentation', number: 741, lastActor: 'author2', author: 'author2' })],
    tracker: {
      'mautic/user-documentation#741': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [
          { user: { login: 'escopecz' }, state: 'DISMISSED', submitted_at: daysAgo(6) },
          { user: { login: 'adiati98' }, state: 'CHANGES_REQUESTED', submitted_at: daysAgo(2) },
        ],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#741');
    assert.equal(r.approval, null, 'later change request supersedes the dismissed approval');
    assert.notEqual(r.lane, 'ready');
    assert.equal(r.lane, 'action'); // author is the last actor → your turn
  }
);

// 16. Formal review request aimed at me → action lane, like an @-mention.
// The team request and the non-existent reviewer entries are ignored.
run(
  'review request aimed at me → action (Review requested)',
  {
    tasks: [local({ repo: 'someorg/human-docs', number: 42, lastActor: 'maintainerX', author: 'writer2' })],
    tracker: {
      'someorg/human-docs#42': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
        rawReviewRequests: [
          { actor: { login: 'maintainerX' }, created_at: daysAgo(1), requested_reviewer: { login: 'adiati98' }, requested_team: null },
          { actor: { login: 'maintainerX' }, created_at: daysAgo(1), requested_reviewer: null, requested_team: { slug: 'docs-team' } },
        ],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'someorg/human-docs#42');
    assert.ok(r.reviewRequest && r.reviewRequest.of === 'adiati98', 'review request of me captured');
    assert.equal(r.lane, 'action');
    assert.equal(r.ball, 'Take Action');
    assert.ok(/review requested/i.test(r.nextStep), r.nextStep);
  }
);

// 16b. A review request aimed only at a team or another reviewer is NOT my
// ping — it must not force a row into the action lane.
run(
  'review request aimed at others only → no review-request signal',
  {
    tasks: [local({ repo: 'someorg/human-docs', number: 43, lastActor: 'writer2', author: 'writer2', status: 'Review in progress' })],
    tracker: {
      'someorg/human-docs#43': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
        rawReviewRequests: [
          { actor: { login: 'maintainerX' }, created_at: daysAgo(1), requested_reviewer: { login: 'favour-chibueze' }, requested_team: null },
          { actor: { login: 'maintainerX' }, created_at: daysAgo(1), requested_reviewer: null, requested_team: { slug: 'docs-team' } },
        ],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'someorg/human-docs#43');
    assert.equal(r.reviewRequest, null, 'no request aimed at me');
  }
);

// 17. Reviewed-but-not-approved → muted "<login> reviewed this" context that
// does NOT change the lane. Bot reviews (incl. allow-listed Promptless) and
// my own reviews are skipped when picking the reviewer to surface.
run(
  'human reviewed, no approval → muted "reviewed this", lane unchanged',
  {
    prs: [local({ repo: 'someorg/human-docs', number: 55, lastActor: 'adiati98', author: 'adiati98' })],
    tracker: {
      'someorg/human-docs#55': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [
          { user: { login: 'promptless-for-oss' }, state: 'COMMENTED', submitted_at: daysAgo(3) },
          { user: { login: 'escopecz' }, state: 'COMMENTED', submitted_at: daysAgo(2) },
        ],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'someorg/human-docs#55');
    assert.equal(r.approval, null);
    assert.ok(r.reviewedNote && r.reviewedNote.by === 'escopecz', 'latest human reviewer surfaced (bot skipped)');
    assert.equal(r.lane, 'waiting', 'muted context must not move the lane');
  }
);

// 18. Allow-listed bot (Promptless) authorship must NOT route to the bot lane.
// Promptless PRs are active review work — the allowlist exists precisely to
// keep them in the human lanes. Here Promptless pushed last, so it's her turn
// to review: action, never folded away.
run(
  'Promptless-authored PR I review → active lane, NOT bot',
  {
    tasks: [
      local({
        repo: 'mautic/developer-documentation-new',
        number: 592,
        user: { login: 'promptless-for-oss' },
        author: 'promptless-for-oss',
        lastActor: 'promptless-for-oss',
        title: 'docs: automated update',
      }),
    ],
  },
  ({ records }) => {
    assert.notEqual(records[0].lane, 'bot', 'allow-listed bot author stays out of the bot lane');
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].ball, 'Take Action');
  }
);

// 18b. A GENUINE (non-allow-listed) bot author still folds to the bot lane BY
// AUTHOR, not last actor — here a human (me) touched it last, yet the bot
// authored it, so it's automated work and stays out of the way.
run(
  'non-allow-listed bot author → bot lane (by author, not last actor)',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 77,
        user: { login: 'renovate[bot]' },
        author: 'renovate[bot]',
        lastActor: 'adiati98',
        title: 'chore(deps): update dependency',
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'bot');
    assert.equal(records[0].ball, 'Bot');
  }
);

// ===========================================================================
// Review-request liveness (§ A) — rawReviewRequests persist after fulfillment,
// so a request is live ONLY when I haven't already answered it.
// ===========================================================================

// A1. A request I already answered (my review after it) must NOT resurface,
// even when a third party comments later. It stays out of the action lane.
run(
  'fulfilled review request + later third-party comment → not action',
  {
    tasks: [
      local({
        repo: 'someorg/human-docs',
        number: 60,
        lastActor: 'thirdparty',
        author: 'writerX',
        status: 'Review in progress',
      }),
    ],
    tracker: {
      'someorg/human-docs#60': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [{ user: { login: 'adiati98' }, state: 'COMMENTED', submitted_at: daysAgo(4) }],
        rawDocsComments: [{ user: { login: 'thirdparty' }, created_at: daysAgo(2), body: 'looks good to me' }],
        rawReviewRequests: [
          { actor: { login: 'maintainerX' }, created_at: daysAgo(5), requested_reviewer: { login: 'adiati98' }, requested_team: null },
        ],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'someorg/human-docs#60');
    assert.equal(r.reviewRequest, null, 'a request I already answered is not live');
    assert.notEqual(r.lane, 'action');
    assert.equal(r.lane, 'waiting');
  }
);

// A2. A genuinely unanswered request (no review/comment of mine after it, only a
// third party spoke) is still live → action.
run(
  'unanswered review request (only others spoke after) → action, still live',
  {
    tasks: [
      local({
        repo: 'someorg/human-docs',
        number: 61,
        lastActor: 'maintainerX',
        author: 'writerX',
        status: 'Review in progress',
      }),
    ],
    tracker: {
      'someorg/human-docs#61': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [{ user: { login: 'writerX' }, created_at: daysAgo(2), body: 'friendly ping' }],
        rawReviewRequests: [
          { actor: { login: 'maintainerX' }, created_at: daysAgo(3), requested_reviewer: { login: 'adiati98' }, requested_team: null },
        ],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'someorg/human-docs#61');
    assert.ok(r.reviewRequest && r.reviewRequest.of === 'adiati98', 'unanswered request stays live');
    assert.equal(r.lane, 'action');
  }
);

// ===========================================================================
// Promptless ping routing (§ B) — an allow-listed bot that authored a row and
// pushed last routes by who it pinged, never the human "author replied" step.
// ===========================================================================

const AUTHOR_REPLIED = 'Author replied — review the latest changes';

// B1. Bot's latest comment @-mentions me → my turn: action, no botPing, and
// never the forbidden "author replied" step. The step is routed BY THE PING —
// who named me and when — so the row says what the ping was, not who "replied".
run(
  'Promptless last actor @-mentions me → action, routed by the ping',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 900,
        user: { login: 'promptless-for-oss' },
        author: 'promptless-for-oss',
        lastActor: 'promptless-for-oss',
        status: 'Review in progress',
      }),
    ],
    tracker: {
      'mautic/user-documentation#900': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [
          { user: { login: 'promptless-for-oss' }, created_at: daysAgo(3), body: '@favour-chibueze ptal' },
          { user: { login: 'promptless-for-oss' }, created_at: daysAgo(1), body: 'Thanks @adiati98! Addressed all three points.' },
        ],
        rawReviewRequests: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#900');
    assert.notEqual(r.lane, 'bot');
    assert.equal(r.lane, 'action');
    assert.equal(r.ball, 'Take Action');
    assert.equal(
      r.nextStep,
      'Mentioned by promptless-for-oss 1d ago — reply',
      `nextStep was: ${r.nextStep}`
    );
    assert.ok(!r.botPing, 'no botPing when the bot pinged me');
    assert.notEqual(r.nextStep, AUTHOR_REPLIED);
  }
);

// B1b. Bot pinged me via a live review request (its latest comment names nobody)
// → still my turn: action, no botPing, and the step names the review it asked
// for rather than any "author" wording. Mirrors real #592.
run(
  'Promptless last actor with live review request aimed at me → action',
  {
    tasks: [
      local({
        repo: 'mautic/developer-documentation-new',
        number: 592,
        user: { login: 'promptless-for-oss' },
        author: 'promptless-for-oss',
        lastActor: 'promptless-for-oss',
        status: 'Request review',
      }),
    ],
    tracker: {
      'mautic/developer-documentation-new#592': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
        rawReviewRequests: [
          { actor: { login: 'promptless-for-oss' }, created_at: daysAgo(1), requested_reviewer: { login: 'adiati98' }, requested_team: null },
          { actor: { login: 'promptless-for-oss' }, created_at: daysAgo(1), requested_reviewer: { login: 'favour-chibueze' }, requested_team: null },
        ],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/developer-documentation-new#592');
    assert.equal(r.lane, 'action');
    assert.equal(r.ball, 'Take Action');
    assert.equal(r.nextStep, 'Review requested — review it', `nextStep was: ${r.nextStep}`);
    assert.notEqual(r.nextStep, AUTHOR_REPLIED);
    assert.ok(!r.botPing, 'pinged me too → my turn, not a "pinged others" row');
  }
);

// B2. Bot pings ONLY someone else (its latest comment @-mentions another human,
// no request/mention aimed at me) → their turn: waiting + botPing { by, of }.
run(
  'Promptless last actor pings only others → waiting + botPing',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 901,
        user: { login: 'promptless-for-oss' },
        author: 'promptless-for-oss',
        lastActor: 'promptless-for-oss',
        status: 'Review in progress',
      }),
    ],
    tracker: {
      'mautic/user-documentation#901': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [
          { user: { login: 'promptless-for-oss' }, created_at: daysAgo(1), body: 'Thanks @favour-chibueze! Addressed your comments.' },
        ],
        rawReviewRequests: [
          { actor: { login: 'promptless-for-oss' }, created_at: daysAgo(1), requested_reviewer: { login: 'favour-chibueze' }, requested_team: null },
        ],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#901');
    assert.notEqual(r.lane, 'action');
    assert.equal(r.lane, 'waiting');
    assert.ok(
      r.botPing && r.botPing.by === 'promptless-for-oss' && r.botPing.of === 'favour-chibueze',
      `botPing was ${JSON.stringify(r.botPing)}`
    );
    assert.equal(r.reviewRequest, null, 'no live request aimed at me');
    assert.notEqual(r.nextStep, AUTHOR_REPLIED);
  }
);

// ===========================================================================
// Standing-rule regressions — the new signals must not disturb these.
// ===========================================================================

// SR1. Assigned issues resolve BEFORE the staleness check: an old assigned
// issue with no PR stays "To Write" in the action lane, never demoted.
run(
  'SR1 · assigned issue idle 40d, no PR → action/To Write, never stalled',
  { issues: [{ title: 'Add docs', url: 'u', repo: 'x/y', number: 4001, updatedAt: daysAgo(40) }] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].ball, 'To Write');
    assert.notEqual(records[0].lane, 'stalled');
  }
);

// SR2. Age is urgency shown via idleDays (the pill), never demotion to a
// folded lane. A reviewing row the author last touched 12d ago stays in the
// action lane; nextStep states the reason plainly, without an escalation
// word the row hasn't earned (see the LCP rule 3a fixtures for the one case
// "escalate" is reserved for).
run(
  'SR2 · author replied 12d ago → still action, age shown via idleDays',
  { tasks: [local({ number: 4002, updatedAt: daysAgo(12), lastSubstantiveDate: daysAgo(12), lastActor: 'writer3', author: 'writer3' })] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].nextStep, 'Author replied — review the latest changes');
    assert.ok(records[0].idleDays >= 12, `idleDays was: ${records[0].idleDays}`);
  }
);

// SR3. "Shipped" phrasing counts only mergedAt-bearing items. A PR dated this
// quarter but never merged must not inflate shippedThisQuarter.
{
  const impact = computeImpact(
    [],
    {
      pullRequests: [
        { date: daysAgo(3), mergedAt: daysAgo(3) }, // merged → counts
        { date: daysAgo(2), mergedAt: null }, // open, dated this quarter → must NOT count
      ],
      reviewedPrs: [],
      coAuthoredPrs: [],
    },
    NOW
  );
  assert.equal(impact.shippedThisQuarter, 1, 'only the merged PR ships');
  console.log('  ok  SR3 · "shipped" counts only mergedAt-bearing items');
}

// SR4. Home is lifetime-scoped, the Workbench is this-month — kept as distinct
// fields, never one number readable both ways. A prior-month merge counts
// lifetime but not this month.
{
  const impact = computeImpact(
    [],
    {
      reviewedPrs: [
        { mergedAt: daysAgo(1) }, // this month
        { mergedAt: '2026-04-02T00:00:00Z' }, // April, prior month
      ],
      coAuthoredPrs: [],
    },
    NOW
  );
  assert.equal(impact.helpedShipCount, 2, 'lifetime counts both');
  assert.equal(impact.helpedShipThisMonth, 1, 'this-month counts only July');
  assert.notEqual(impact.helpedShipCount, impact.helpedShipThisMonth);
  console.log('  ok  SR4 · lifetime and this-month stay separate scopes');
}

// SR5. The removed source chips and desync flag must not creep back into the
// record contract. (`source` is an internal provenance string, not a chip.)
run(
  'SR5 · records carry no desync flag and no source-chip field',
  {
    tasks: [local({ number: 4005, lastActor: 'someone', author: 'someone' })],
    tracker: { 'x/y#4005': { docsUpdatedAt: daysAgo(1), rawDocsReviews: [], rawDocsComments: [] } },
  },
  ({ records }) => {
    for (const r of records) {
      assert.ok(!('desync' in r), 'no desync flag on record');
      assert.ok(!('sourceChip' in r), 'no source-chip field on record');
      assert.ok(!('sourceChips' in r), 'no source-chip field on record');
    }
  }
);

// ===========================================================================
// Turn beats age — a row whose ball is YOURS never folds into Stalled.
// Regression: the idleDays >= 30 check ran before the turn logic, so live work
// aged into a folded lane reading "nudge or close". Only assigned issues were
// carved out; every path below reaches the action lane and must survive age.
// ===========================================================================

// TA1. Reviewing, the author replied — 40 days ago. Still your review to do.
run(
  'TA1 · reviewing, author replied, idle 40d → action, not stalled',
  {
    tasks: [
      local({
        number: 5001,
        updatedAt: daysAgo(40),
        lastSubstantiveDate: daysAgo(40),
        lastActor: 'writer1',
        author: 'writer1',
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.equal(records[0].ball, 'Take Action');
    assert.equal(records[0].nextStep, 'Author replied — review the latest changes');
    // Age is not lost — it's carried on idleDays (rendered on the pill)
    // instead of demoting the row or being misworded as "escalate" in the
    // step text, which is reserved for the real code-author-reminder case.
    assert.ok(records[0].idleDays >= 40, `idleDays was: ${records[0].idleDays}`);
  }
);

// TA2. A LIVE review request aimed at you, unanswered for 45 days. The oldest
// ping is the most urgent, not the most stale.
run(
  'TA2 · live review request of me, idle 45d → action, not stalled',
  {
    tasks: [
      local({
        number: 5002,
        updatedAt: daysAgo(45),
        lastSubstantiveDate: daysAgo(45),
        lastActor: 'other',
        author: 'someone-else',
      }),
    ],
    tracker: {
      'x/y#5002': {
        docsUpdatedAt: daysAgo(45),
        rawDocsReviews: [],
        rawDocsComments: [],
        rawReviewRequests: [
          { requested_reviewer: { login: ME }, actor: { login: 'maint' }, created_at: daysAgo(45) },
        ],
      },
    },
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.ok(records[0].reviewRequest, 'the review request must survive on the record');
    assert.equal(records[0].nextStep, 'Review requested — review it');
    assert.ok(records[0].idleDays >= 45, `idleDays was: ${records[0].idleDays}`);
  }
);

// TA3. Your own PR carrying maintainer feedback from two months ago. Overdue,
// not dead — the next step is still yours to take.
run(
  'TA3 · authored PR with maintainer feedback, idle 60d → action, not stalled',
  {
    prs: [
      local({
        number: 5003,
        updatedAt: daysAgo(60),
        lastSubstantiveDate: daysAgo(60),
        lastActor: 'maintainer1',
        author: ME,
        hasFormalReview: true,
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.ok(/review feedback/i.test(records[0].nextStep), records[0].nextStep);
    assert.ok(records[0].idleDays >= 30, 'the row is genuinely old — it just is not stale');
  }
);

// TA4. An allow-listed bot pinged YOU. Its own push is not "someone else's
// turn", so age must not fold it away either.
run(
  'TA4 · allow-listed bot pinged me, idle 50d → action, not stalled',
  {
    tasks: [
      local({
        number: 5004,
        updatedAt: daysAgo(50),
        lastSubstantiveDate: daysAgo(50),
        lastActor: 'promptless-app[bot]',
        author: 'promptless-app[bot]',
      }),
    ],
    tracker: {
      'x/y#5004': {
        docsUpdatedAt: daysAgo(50),
        rawDocsReviews: [],
        rawDocsComments: [
          {
            user: { login: 'promptless-app[bot]' },
            created_at: daysAgo(50),
            body: `Thanks @${ME}, addressed your comments!`,
          },
        ],
      },
    },
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.equal(records[0].botPing, null, 'a ping AT me is my turn, not a "waiting on" note');
  }
);

// TA5. The counter-case: waiting on someone else and untouched for 35 days
// still folds. The staleness rule is narrowed, not removed.
run(
  'TA5 · waiting on others, idle 35d → still stalled',
  {
    prs: [
      local({
        number: 5005,
        updatedAt: daysAgo(35),
        lastSubstantiveDate: daysAgo(35),
        lastActor: ME,
        author: ME,
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'stalled');
    assert.equal(records[0].ball, 'Stale');
    assert.ok(/nudge or close/.test(records[0].nextStep), records[0].nextStep);
  }
);

// TA6. Contextual fields survive the demotion. A stalled row that a bot pinged
// SOMEONE ELSE on still has to be able to say who it's waiting on.
run(
  'TA6 · botPing survives a stalled demotion',
  {
    tasks: [
      local({
        number: 5006,
        updatedAt: daysAgo(40),
        lastSubstantiveDate: daysAgo(40),
        lastActor: 'promptless-app[bot]',
        author: 'promptless-app[bot]',
      }),
    ],
    tracker: {
      'x/y#5006': {
        docsUpdatedAt: daysAgo(40),
        rawDocsReviews: [],
        rawDocsComments: [
          {
            user: { login: 'promptless-app[bot]' },
            created_at: daysAgo(40),
            body: 'Hi @maintainer1, this is ready for your review',
          },
        ],
      },
    },
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'stalled', 'pinged at others → their turn → stalls with age');
    assert.ok(records[0].botPing, 'botPing must survive the demotion');
    assert.equal(records[0].botPing.of, 'maintainer1');
    assert.equal(records[0].botPing.by, 'promptless-app[bot]');
  }
);

// TA7. reviewedNote and approval are record-level fields, so a demotion can
// never strip them either.
run(
  'TA7 · reviewedNote survives a stalled demotion',
  {
    prs: [
      local({
        number: 5007,
        updatedAt: daysAgo(38),
        lastSubstantiveDate: daysAgo(38),
        lastActor: ME,
        author: ME,
      }),
    ],
    tracker: {
      'x/y#5007': {
        docsUpdatedAt: daysAgo(38),
        rawDocsReviews: [
          { state: 'CHANGES_REQUESTED', user: { login: 'reviewer9' }, submitted_at: daysAgo(38) },
        ],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'stalled');
    assert.ok(records[0].reviewedNote, 'reviewedNote must survive the demotion');
    assert.equal(records[0].reviewedNote.by, 'reviewer9');
  }
);

// ===========================================================================
// Generalized next steps (§ G) — every repo, not just the tracker-covered ones.
//
// These rows deliberately live in UNTRACKED repos with an EMPTY tracker feed:
// each step below is derived purely from the widened local activity the fetch
// layer caches (reviews, comments with mentions, reviewRequests,
// requestedReviewers, mergeableState, baseRef, milestone). Before this, every
// one of them fell through to `nextStep: null`.
// ===========================================================================

/** The widened PR-detail/activity block the fetch layer now writes onto each
 * local record. Present-but-empty is meaningful: it says "we looked", which is
 * what lets rules like "no reviewer assigned" speak at all. */
function detail(overrides = {}) {
  return {
    reviews: [],
    comments: [],
    reviewRequests: [],
    requestedReviewers: [],
    mergeableState: null,
    baseRef: null,
    milestone: null,
    ...overrides,
  };
}

// G1. Reviewing, you moved last → the row can finally say why it's parked.
run(
  'G1 · reviewing, I reviewed last → "Reviewed Nd ago — author hasn\'t replied"',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6001,
        lastActor: ME,
        author: 'writerA',
        ...detail({ reviews: [{ login: ME, state: 'COMMENTED', submittedAt: daysAgo(4) }] }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.source, 'local', 'derived with no tracker record at all');
    assert.equal(r.upstream, null);
    assert.equal(r.lane, 'waiting');
    assert.equal(r.ball, 'Waiting');
    assert.equal(r.nextStep, "Reviewed 4d ago — author hasn't replied", r.nextStep);
  }
);

// G2. Reviewing, a third party moved last → name the reviewer still on the hook.
run(
  'G2 · reviewing, third party last → "Waiting on LOGIN to review — requested Nd ago"',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6002,
        lastActor: 'thirdparty',
        author: 'writerA',
        ...detail({
          requestedReviewers: ['maintainerZ'],
          reviewRequests: [
            { requestedReviewer: 'maintainerZ', actor: 'writerA', createdAt: daysAgo(5) },
          ],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'waiting');
    assert.equal(r.ball, 'Watching');
    assert.equal(r.nextStep, 'Waiting on maintainerZ to review — requested 5d ago', r.nextStep);
  }
);

// G2b. Nobody resolvable to wait on → drop the whole clause rather than print
// "Waiting on  to review". The Watching pill already says this much.
run(
  'G2b · no resolvable reviewer → no step, never an empty placeholder',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6021,
        lastActor: 'thirdparty',
        author: 'writerA',
        ...detail(),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, null, records[0].nextStep);
  }
);

// G2c. A live pending reviewer with no surviving request event still gets
// named — only the date clause drops.
run(
  'G2c · pending reviewer, no request event → date clause dropped',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6022,
        lastActor: 'thirdparty',
        author: 'writerA',
        ...detail({ requestedReviewers: ['maintainerZ'] }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Waiting on maintainerZ to review', records[0].nextStep);
  }
);

// G2d. You're still a pending reviewer, but a fellow reviewer already asked
// for changes and the author hasn't addressed it — the request isn't stale
// in the sense G3b covers, it just isn't the real blocker right now. Stays
// in the action lane (never silently buried) with honest wording instead of
// a flat "review it" that implies nothing has happened yet.
run(
  'G2d · fellow reviewer already requested changes, author silent → softened wording',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6023,
        status: 'Request review',
        lastActor: 'reviewerB',
        author: 'writerA',
        ...detail({
          reviews: [{ login: 'reviewerB', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(6) }],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'action');
    assert.equal(r.ball, 'Take Action');
    assert.equal(
      r.nextStep,
      'reviewerB requested changes 6d ago — not yet addressed',
      r.nextStep
    );
  }
);

// G2e. Same setup, but the author already replied since the change request
// (even though a third reviewer, not the author, ends up as the record's
// last actor) — softened wording no longer applies, back to the plain
// prompt, since there's something new for you to look at now.
run(
  'G2e · fellow reviewer requested changes, author already replied → plain prompt',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6024,
        status: 'Request review',
        lastActor: 'reviewerC',
        author: 'writerA',
        ...detail({
          reviews: [{ login: 'reviewerB', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(6) }],
          comments: [
            { login: 'writerA', createdAt: daysAgo(3), mentions: [] },
            { login: 'reviewerC', createdAt: daysAgo(1), mentions: [] },
          ],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.nextStep, 'Review requested — review it', r.nextStep);
  }
);

// G3. Your own PR, you spoke last → say when, and who owes you.
run(
  'G3 · authored, I replied last → "Replied Nd ago — waiting on LOGIN"',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6003,
        lastActor: ME,
        author: ME,
        ...detail({
          requestedReviewers: ['maintainerZ'],
          comments: [{ login: ME, createdAt: daysAgo(3), mentions: [] }],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'waiting');
    assert.equal(r.nextStep, 'Replied 3d ago — waiting on maintainerZ', r.nextStep);
  }
);

// G3b. A stale, forgotten formal review request must not outrank a fresher
// informal ping to someone else. Reproduces a real case: a reviewer was
// formally requested via GitHub's "Request review" button months ago, never
// answered, and never withdrawn — meanwhile the actual ask moved on to a
// different person entirely, chased only through plain @-mentions.
run(
  'G3b · fresher ping to LOGIN outranks a stale, unwithdrawn formal request',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6005,
        lastActor: ME,
        author: ME,
        ...detail({
          requestedReviewers: ['favour-chibueze'],
          reviewRequests: [
            { requestedReviewer: 'favour-chibueze', actor: ME, createdAt: daysAgo(190) },
          ],
          comments: [{ login: ME, createdAt: daysAgo(10), mentions: ['andersonjeccel'] }],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'waiting');
    assert.equal(r.nextStep, 'Replied 10d ago — waiting on andersonjeccel', r.nextStep);
  }
);

// G4. A bot pushed to your own PR. Never "author replied" — a push is not a
// person answering you, it's a diff that moved under you.
run(
  'G4 · authored, bot pushed last → "LOGIN pushed Nd ago — re-check the changes"',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6004,
        user: { login: ME },
        author: ME,
        lastActor: 'renovate[bot]',
        isLastActorBot: true,
        ...detail(),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.notEqual(r.lane, 'bot', 'my PR, not bot-lane clutter');
    assert.equal(r.ball, 'Watching');
    assert.equal(r.nextStep, 'renovate[bot] pushed 2d ago — re-check the changes', r.nextStep);
  }
);

// G5. Changes requested and unanswered → say who, on any repo.
run(
  'G5 · changes requested → "Changes requested by LOGIN — address the feedback"',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6005,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({
          reviews: [{ login: 'reviewerQ', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(2) }],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'action', 'the wording sharpens; the lane is untouched');
    assert.equal(r.ball, 'Take Action');
    assert.equal(r.nextStep, 'Changes requested by reviewerQ — address the feedback', r.nextStep);
  }
);

// G5b. Once you reply, it stops nagging and the generic step returns.
run(
  'G5b · changes requested, answered by a later reply of mine → back to generic',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6023,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({
          reviews: [{ login: 'reviewerQ', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(4) }],
          comments: [{ login: ME, createdAt: daysAgo(2), mentions: [] }],
        }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Address the review feedback', records[0].nextStep);
  }
);

// G6. A direct @-mention outranks the turn reading — being named is being asked.
run(
  'G6 · @-mention of me → "Mentioned by LOGIN Nd ago — reply"',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6006,
        lastActor: 'writerA',
        author: 'writerA',
        ...detail({
          comments: [{ login: 'writerA', createdAt: daysAgo(2), mentions: ['adiati98'] }],
        }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'action', 'lane still comes from the turn reading');
    assert.equal(r.nextStep, 'Mentioned by writerA 2d ago — reply', r.nextStep);
  }
);

// G6b. A mention you already answered is spent — no later comment of mine, no
// step. (Here I commented after it, so the row falls back to its turn step.)
run(
  'G6b · mention already answered → no ping step',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6024,
        lastActor: 'writerA',
        author: 'writerA',
        ...detail({
          comments: [
            { login: 'writerA', createdAt: daysAgo(5), mentions: ['adiati98'] },
            { login: ME, createdAt: daysAgo(3), mentions: [] },
          ],
        }),
      }),
    ],
  },
  ({ records }) => {
    assert.ok(!/^Mentioned by/.test(records[0].nextStep || ''), records[0].nextStep);
  }
);

// G7. Ready, non-draft, nobody asked to look → that IS the remaining step.
run(
  'G7 · ready with no reviewer and no review → "No reviewer assigned — request one"',
  {
    prs: [local({ repo: 'someorg/app', number: 6007, lastActor: ME, author: ME, ...detail() })],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'No reviewer assigned — request one', records[0].nextStep);
  }
);

// G7b. A draft is not "ready", so it keeps the draft step instead.
run(
  'G7b · draft with no reviewer → still the draft step, not "request one"',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6025,
        lastActor: ME,
        author: ME,
        isDraft: true,
        ...detail(),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Draft — finish and mark ready', records[0].nextStep);
  }
);

// G7c. Without the PR-detail block there is no evidence either way, so the
// rule stays silent rather than claiming nobody was asked.
run(
  'G7c · no cached PR detail → no "request one" claim',
  {
    prs: [local({ repo: 'someorg/app', number: 6026, lastActor: ME, author: ME })],
  },
  ({ records }) => {
    assert.ok(!/reviewer assigned/.test(records[0].nextStep || ''), records[0].nextStep);
  }
);

// G8. A definitively dirty merge state names the base branch.
run(
  'G8 · mergeableState dirty → "Conflicts with BRANCH — rebase needed"',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6008,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({ mergeableState: 'dirty', baseRef: 'main' }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Conflicts with main — rebase needed', records[0].nextStep);
  }
);

// G8b. No base branch to name → drop the clause, keep the fact.
run(
  'G8b · dirty with no baseRef → clause dropped',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6027,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({ mergeableState: 'dirty', baseRef: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Conflicts — rebase needed', records[0].nextStep);
  }
);

// G8c. Only `dirty` is a conflict. Every other state read here means UNKNOWN
// as far as conflicts go — not clean and not conflicted — so emit nothing;
// there is nothing to retry, the next build reads a fresh value anyway.
//
// `blocked` is deliberately absent from this list. It is not a conflict either,
// but it is not inert: it is its own definitive signal, read in § H below. It
// still never produces a rebase step, which § H2c re-asserts from that side.
for (const state of [null, 'unknown', 'behind', 'clean']) {
  run(
    `G8c · mergeableState ${JSON.stringify(state)} → no conflict step`,
    {
      prs: [
        local({
          repo: 'someorg/app',
          number: 6028,
          lastActor: 'reviewerQ',
          author: ME,
          hasFormalReview: true,
          ...detail({ mergeableState: state, baseRef: 'main' }),
        }),
      ],
    },
    ({ records }) => {
      assert.ok(!/rebase|onflict/.test(records[0].nextStep || ''), records[0].nextStep);
      assert.equal(records[0].nextStep, 'Address the review feedback', records[0].nextStep);
    }
  );
}

// ===========================================================================
// Precedence (§ P) — one row carrying every signal at once, peeled back a
// layer at a time. Ping → changes requested → conflicts → turn.
//
// Deliberately NOT a milestone repo: the milestone reminder appends rather
// than competes (see § M), so keeping it out here leaves the ladder legible.
// ===========================================================================

function stacked(overrides) {
  return local({
    repo: 'someorg/app',
    number: 6009,
    lastActor: ME,
    author: ME,
    ...detail({
      requestedReviewers: ['escopecz'],
      reviews: [{ login: 'reviewerQ', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(2) }],
      comments: [{ login: 'reviewerQ', createdAt: daysAgo(1), mentions: ['adiati98'] }],
      mergeableState: 'dirty',
      baseRef: 'main',
      milestone: null,
    }),
    ...overrides,
  });
}

run(
  'P1 · ping outranks changes requested, conflicts and the turn',
  { prs: [stacked({})] },
  ({ records }) => {
    assert.equal(
      records[0].nextStep,
      'Mentioned by reviewerQ 1d ago — reply',
      records[0].nextStep
    );
  }
);

run(
  'P2 · no ping → changes requested outranks conflicts and the turn',
  { prs: [stacked({ comments: [] })] },
  ({ records }) => {
    assert.equal(
      records[0].nextStep,
      'Changes requested by reviewerQ — address the feedback',
      records[0].nextStep
    );
  }
);

run(
  'P3 · no ping, no change request → conflicts outrank the turn',
  { prs: [stacked({ comments: [], reviews: [] })] },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Conflicts with main — rebase needed', records[0].nextStep);
  }
);

run(
  'P4 · nothing pressing → the turn reading is what is left',
  { prs: [stacked({ comments: [], reviews: [], mergeableState: null })] },
  ({ records }) => {
    assert.equal(
      records[0].nextStep,
      'Replied 2d ago — waiting on escopecz',
      records[0].nextStep
    );
  }
);

// ===========================================================================
// Milestone reminder (§ M) — scoped by a repo list, never inferred from the
// data, and carried as its OWN record field rather than spliced into nextStep.
//
// This follows the upstream docs-PR tracker, which models a missing milestone
// as a lifecycle category (needs-milestone / needs-label-and-milestone) with
// "act" severity, and renders it as a separate "Add milestone" chip pushed
// AHEAD of the review chip. Two consequences differ from a plain suffix:
// nextStep stays clean, and drafts are triaged rather than exempted.
// ===========================================================================

/** Every eligible row must expose the flag; none may leak it into the prose. */
function assertMilestone(record, expected) {
  assert.equal(
    record.milestoneMissing,
    expected,
    `milestoneMissing was ${record.milestoneMissing}`
  );
  assert.ok(
    !/milestone/i.test(record.nextStep || ''),
    `nextStep must stay clean, was: ${record.nextStep}`
  );
}

// M1. Fires on a listed Mautic repo, as a field — the row's own step is
// untouched, so the renderer can draw the chip separately.
run(
  'M1 · listed Mautic repo → flag set, nextStep left alone',
  {
    prs: [
      local({
        repo: 'mautic/developer-documentation-new',
        number: 6031,
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assertMilestone(records[0], true);
    assert.equal(
      records[0].nextStep,
      'Replied 2d ago — waiting on escopecz',
      records[0].nextStep
    );
  }
);

// M2. …and NOT on an identical row in a repo that isn't on the list. Same
// missing milestone, same shape — only the repo differs.
run(
  'M2 · milestone reminder does NOT fire for a non-Mautic repo',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6032,
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assertMilestone(records[0], false);
    assert.equal(
      records[0].nextStep,
      'Replied 2d ago — waiting on escopecz',
      records[0].nextStep
    );
  }
);

// M3. A listed repo that DOES carry a milestone says nothing about it — and a
// non-listed repo carrying one is equally silent. Presence of the field is
// never what decides the scope.
run(
  'M3 · milestone present → silent, on listed and unlisted repos alike',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6033,
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: 'Q3 docs' }),
      }),
      local({
        repo: 'someorg/app',
        number: 6034,
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: 'Q3 docs' }),
      }),
    ],
  },
  ({ records }) => {
    for (const r of records) assertMilestone(r, false);
  }
);

// M4. The action lane — where most of the real board's Mautic rows sit. The
// instruction is untouched; the chip is an independent field beside it.
run(
  'M4 · action lane → instruction untouched, flag set alongside',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 6029,
        lastActor: 'writerA',
        author: 'writerA',
        ...detail({ milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assertMilestone(records[0], true);
    assert.equal(records[0].nextStep, AUTHOR_REPLIED, records[0].nextStep);
  }
);

// M5. A missing milestone is YOUR move, so the row must not sit in a lane that
// means the opposite. "Waiting on others" reads *your part is done*; "Stalled"
// reads *nudge or close* AND folds the row shut so the chip goes unseen. Both
// are false while a milestone is owed, so the row is promoted — and because
// the promotion happens in the turn logic, the staleness fold skips it for
// free, the same way it skips assigned issues and review pings.
run(
  'M5 · a stalled row is promoted to action, never folded away',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6035,
        updatedAt: daysAgo(40),
        lastSubstantiveDate: daysAgo(40),
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.equal(records[0].ball, 'Take Action');
    assert.ok(
      records[0].idleDays >= 30,
      'genuinely old — it just is not stale while you owe it something'
    );
    assert.ok(!/nudge or close/.test(records[0].nextStep), records[0].nextStep);
    assertMilestone(records[0], true);
  }
);

// M5b. The plain waiting case, same rule.
run(
  'M5b · a waiting row is promoted to action',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6041,
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.equal(records[0].ball, 'Take Action');
  }
);

// M5c. …but with the milestone set, the identical row stays where it was. The
// promotion is caused by the missing milestone, not by the repo.
run(
  'M5c · milestone set → the same row stays in waiting',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6042,
        lastActor: ME,
        author: ME,
        ...detail({ requestedReviewers: ['escopecz'], milestone: 'Q3 docs' }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'waiting');
    assert.equal(records[0].ball, 'Waiting');
  }
);

// M5d. Drafts are triaged, NOT exempted. The upstream tracker's
// needs-label-and-milestone category fires precisely on drafts and carries
// "act" severity — a draft is when the milestone is cheapest to set, before
// anyone is waiting on the merge. The draft instruction survives beside it.
run(
  'M5d · a draft is promoted too, keeping its own instruction',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6043,
        lastActor: ME,
        author: ME,
        isDraft: true,
        ...detail({ milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assertMilestone(records[0], true);
    assert.equal(records[0].nextStep, 'Draft — finish and mark ready', records[0].nextStep);
  }
);

// M6. The approval branch returns before the turn logic runs at all, so the
// flag has to survive that route too — an approved PR still wants a milestone.
// The lane is deliberately NOT promoted: "Approved — bring it home" already
// means work is left before it ships, and the Approved pill says something
// Take Action would throw away.
run(
  'M6 · reaches approved rows, and leaves that lane and pill alone',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6036,
        reviewState: 'APPROVED',
        approvedBy: 'escopecz',
        lastActor: 'escopecz',
        author: ME,
        ...detail({ milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'ready');
    assert.equal(records[0].ball, 'Approved');
    assertMilestone(records[0], true);
    assert.equal(records[0].nextStep, 'Final review, then merge', records[0].nextStep);
  }
);

// M7. A row with nothing else to say carries the flag alone — the chip is the
// whole message, and nextStep stays null rather than inventing prose for it.
run(
  'M7 · no other step → the flag stands alone, nextStep stays null',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 6037,
        lastActor: 'thirdparty',
        author: 'writerA',
        ...detail({ milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assertMilestone(records[0], true);
    assert.equal(records[0].nextStep, null, records[0].nextStep);
  }
);

// M8. The bot lane is folded away precisely so it carries no instructions —
// a dependabot PR in a Mautic repo must stay silent. The upstream tracker
// exempts Dependabot from milestone triage for the same reason.
run(
  'M8 · never on the bot lane',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 6038,
        user: { login: 'dependabot[bot]' },
        author: 'dependabot[bot]',
        title: 'Bump lodash from 4 to 5',
        ...detail({ milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'bot');
    assertMilestone(records[0], false);
    assert.equal(records[0].nextStep, null, records[0].nextStep);
  }
);

// M9. idleDays and the milestone flag are two separate channels on the
// record — the missing-milestone flag never gets folded into nextStep text,
// and nextStep stays the plain reason regardless of age.
run(
  'M9 · idleDays and milestone stay separate fields, nextStep stays plain',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 6039,
        updatedAt: daysAgo(20),
        lastSubstantiveDate: daysAgo(20),
        lastActor: 'writerA',
        author: 'writerA',
        ...detail({ milestone: null }),
      }),
    ],
  },
  ({ records }) => {
    assertMilestone(records[0], true);
    assert.equal(records[0].nextStep, AUTHOR_REPLIED, records[0].nextStep);
    assert.ok(records[0].idleDays >= 20, `idleDays was: ${records[0].idleDays}`);
  }
);

// M10. Every record carries the field, so renderers never have to guard for
// undefined — the same contract botPing follows.
run(
  'M10 · the field is present on every record, tracker-only rows included',
  {
    prs: [local({ repo: 'someorg/app', number: 6044, lastActor: ME, author: ME })],
    tracker: {
      'mautic/user-documentation#6045': {
        docsUpdatedAt: daysAgo(3),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    for (const r of records) {
      assert.ok('milestoneMissing' in r, `missing on ${r.key}`);
      assert.equal(typeof r.milestoneMissing, 'boolean', `not a boolean on ${r.key}`);
    }
    // A tracker-only row has no local PR detail, so "no milestone" is an
    // unknown, not a fact.
    const trackerOnly = records.find((r) => r.source === 'tracker');
    assert.equal(trackerOnly.milestoneMissing, false);
  }
);

// ===========================================================================
// Definitive holds (§ H) — mergeable_state was already fetched on every run
// and read only half-way: it only ever acted on `dirty`. `blocked` says branch
// protection isn't satisfied — required reviews missing, required checks
// failing or still running — so nobody can merge the PR yet.
//
// That is not a reason to hide a row, so nothing is dropped: a held row moves
// from "Needs your action" to "Waiting on others" and carries the reason with
// it. The wording is read from contents/docs-workflow-repos.js so both
// generators say the same thing.
// ===========================================================================

const DOCS_WORKFLOW_CONFIG = require('../../contents/docs-workflow-repos');
const BLOCKED_REASON = DOCS_WORKFLOW_CONFIG.mergeBlockedReason;

/** A docs PR the ladder would otherwise put in the action lane: you're the
 * reviewer, the author moved last. Milestone set on purpose — a missing one is
 * a real job the owner owes, and § H must not be tested through it. */
function heldCandidate(overrides) {
  return local({
    repo: 'mautic/user-documentation',
    lastActor: 'writerA',
    author: 'writerA',
    status: 'Review in progress',
    isDraft: false,
    ...detail({ milestone: 'Q3 docs' }),
    ...overrides,
  });
}

const AUTHOR_REPLIED_STEP = 'Author replied — review the latest changes';

// H0 · the control. Same row, no blocked state → action lane, exactly as
// today. Every H case below differs from this by one field only.
run(
  'H0 · control — no hold → action lane, unchanged',
  { tasks: [heldCandidate({ number: 6201 })] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.equal(records[0].nextStep, AUTHOR_REPLIED_STEP, records[0].nextStep);
    assert.deepEqual(records[0].waitingReasons, []);
  }
);

// H2 · mergeable_state blocked → out of the action lane, and the row names the
// reason in words.
run(
  'H2 · mergeableState blocked → waiting lane, reason named in words',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6205,
        lastActor: 'writerA',
        author: 'writerA',
        status: 'Review in progress',
        ...detail({ mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'waiting', `lane was ${r.lane}`);
    assert.equal(r.ball, 'Watching');
    assert.equal(r.nextStep, null, r.nextStep);
    assert.deepEqual(r.waitingReasons, [BLOCKED_REASON]);
    assert.ok(BLOCKED_REASON, 'the reason must be configured, not left to the renderers');
  }
);

// H2b · THE RULE THAT DID NOT CHANGE. Only values GitHub states definitively
// are acted on; `unknown` (and the null this field reports while GitHub is
// still computing) is never guessed at, and neither is any other state.
for (const state of [null, 'unknown', 'behind', 'clean', 'unstable', 'draft']) {
  run(
    `H2b · mergeableState ${JSON.stringify(state)} → nothing inferred, lane untouched`,
    {
      tasks: [
        local({
          repo: 'someorg/app',
          number: 6206,
          lastActor: 'writerA',
          author: 'writerA',
          status: 'Review in progress',
          ...detail({ mergeableState: state }),
        }),
      ],
    },
    ({ records }) => {
      assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
      assert.deepEqual(records[0].waitingReasons, []);
    }
  );
}

// H2c · The two definitive states are read separately and neither swallowed
// the other: `dirty` still means conflicts and only conflicts, and `blocked`
// still never produces a rebase step (the § G8c case, from this side).
run(
  'H2c · dirty is still the conflict signal, not a hold',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6207,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({ mergeableState: 'dirty', baseRef: 'main' }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, 'Conflicts with main — rebase needed', records[0].nextStep);
    assert.deepEqual(records[0].waitingReasons, []);
  }
);

run(
  'H2d · blocked never produces a rebase step',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6226,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({ mergeableState: 'blocked', baseRef: 'main' }),
      }),
    ],
  },
  ({ records }) => {
    assert.ok(!/rebase|onflict/.test(records[0].nextStep || ''), records[0].nextStep);
    assert.equal(records[0].lane, 'waiting', `lane was ${records[0].lane}`);
    assert.deepEqual(records[0].waitingReasons, [BLOCKED_REASON]);
  }
);

// ---------------------------------------------------------------------------
// H4 · A hold never buries a request that named the owner. Each case below is
// a held row that STAYS in the action lane — and shows no reason chip, since
// "required checks or reviews not met" printed next to "reply to X" would
// contradict it.
// ---------------------------------------------------------------------------

function assertNotHeld(record, step) {
  assert.equal(record.lane, 'action', `lane was ${record.lane}`);
  assert.deepEqual(record.waitingReasons, [], 'no contradictory reason on an action row');
  if (step) assert.equal(record.nextStep, step, record.nextStep);
}

run(
  'H4a · an @-mention of you outranks the hold',
  {
    tasks: [
      heldCandidate({
        number: 6209,
        ...detail({
          milestone: 'Q3 docs',
          mergeableState: 'blocked',
          comments: [{ login: 'writerA', createdAt: daysAgo(1), mentions: [ME] }],
        }),
      }),
    ],
  },
  ({ records }) => assertNotHeld(records[0], 'Mentioned by writerA 1d ago — reply')
);

// The one that matters most for `blocked`: the missing requirement is very
// often an approving review, and if you are the requested reviewer then YOU
// are the block. Demoting this would hide the work the board exists to show.
run(
  'H4b · a review request aimed at you outranks the hold',
  {
    tasks: [
      heldCandidate({
        number: 6210,
        status: 'Request review',
        ...detail({ milestone: 'Q3 docs', mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => assertNotHeld(records[0], 'Review requested — review it')
);

run(
  'H4c · unanswered changes requested on your own PR outrank the hold',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6211,
        lastActor: 'reviewerQ',
        author: ME,
        ...detail({
          milestone: 'Q3 docs',
          mergeableState: 'blocked',
          reviews: [{ login: 'reviewerQ', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(2) }],
        }),
      }),
    ],
  },
  ({ records }) =>
    assertNotHeld(records[0], 'Changes requested by reviewerQ — address the feedback')
);

// The linked code PR having merged is decisive: the docs are actionable now,
// whatever the merge state says.
run(
  'H4d · a merged linked code PR outranks the hold',
  {
    tasks: [
      heldCandidate({
        number: 6212,
        linkedCodePrState: 'merged',
        ...detail({ milestone: 'Q3 docs', mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => assertNotHeld(records[0], 'Code PR merged — review the docs now')
);

// A milestone is owed whatever the merge is waiting on, so the housekeeping
// promotion survives — and its own chip is unaffected.
run(
  'H4e · missing housekeeping outranks the hold',
  {
    tasks: [
      heldCandidate({
        number: 6213,
        ...detail({ milestone: null, mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action', `lane was ${records[0].lane}`);
    assert.equal(records[0].milestoneMissing, true);
    assert.deepEqual(records[0].waitingReasons, []);
  }
);

// ---------------------------------------------------------------------------
// H6 · Lane discipline — the hold only ever subtracts from the action lane.
// ---------------------------------------------------------------------------

// A held row stops at "Waiting on others" and is NOT folded on to Stalled,
// however old it is. Stalled is collapsed by default and reads "nudge or
// close"; a row parked on something outside the owner's control must stay
// visible instead of being hidden behind that.
run(
  'H6a · a held row stops at waiting, never folds on to stalled',
  {
    tasks: [
      heldCandidate({
        number: 6217,
        updatedAt: daysAgo(90),
        lastSubstantiveDate: daysAgo(90),
        ...detail({ milestone: 'Q3 docs', mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => {
    assert.ok(records[0].idleDays >= 30, `idleDays was ${records[0].idleDays}`);
    assert.equal(records[0].lane, 'waiting', `lane was ${records[0].lane}`);
    assert.deepEqual(records[0].waitingReasons, [BLOCKED_REASON]);
  }
);

// A row that was ALREADY stalled keeps that lane — the hold never moves rows
// between non-action lanes — but it gains the reason, so the fold no longer
// says "nudge or close" without saying what it is waiting on.
run(
  'H6b · an already-stalled row keeps its lane and gains the reason',
  {
    tasks: [
      heldCandidate({
        number: 6218,
        lastActor: 'thirdparty',
        updatedAt: daysAgo(90),
        lastSubstantiveDate: daysAgo(90),
        ...detail({ milestone: 'Q3 docs', mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'stalled', `lane was ${records[0].lane}`);
    assert.deepEqual(records[0].waitingReasons, [BLOCKED_REASON]);
  }
);

// An approved row is never demoted either: "bring it home" is a different
// claim from "your move", and the Approved pill carries information the
// waiting lane would throw away.
run(
  'H6c · an approved row keeps the ready lane and gains the reason',
  {
    tasks: [
      heldCandidate({
        number: 6219,
        reviewState: 'APPROVED',
        approvedBy: 'maintainerZ',
        ...detail({
          milestone: 'Q3 docs',
          mergeableState: 'blocked',
          reviews: [{ login: 'maintainerZ', state: 'APPROVED', submittedAt: daysAgo(1) }],
        }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'ready', `lane was ${records[0].lane}`);
    assert.equal(records[0].ball, 'Approved');
    assert.deepEqual(records[0].waitingReasons, [BLOCKED_REASON]);
  }
);

// H6d · Bot rows stay clean. The lane is folded away precisely so it carries
// neither instructions nor explanations.
run(
  'H6d · never on the bot lane',
  {
    tasks: [
      heldCandidate({
        number: 6220,
        user: { login: 'dependabot[bot]' },
        author: 'dependabot[bot]',
        title: 'Bump lodash from 4 to 5',
        ...detail({ milestone: 'Q3 docs', mergeableState: 'blocked' }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'bot');
    assert.deepEqual(records[0].waitingReasons, []);
  }
);

// H7 · Present on every record as an array of strings, tracker-only rows
// included, so both generators can loop over it without guarding for
// undefined.
run(
  'H7 · the field is an array on every record',
  {
    prs: [local({ repo: 'someorg/app', number: 6221, lastActor: ME, author: ME })],
    tasks: [
      heldCandidate({ number: 6222, ...detail({ milestone: 'Q3 docs', mergeableState: 'blocked' }) }),
    ],
    issues: [local({ repo: 'mautic/user-documentation', number: 6223 })],
    tracker: {
      'mautic/user-documentation#6224': {
        docsUpdatedAt: daysAgo(3),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    for (const r of records) {
      assert.ok(Array.isArray(r.waitingReasons), `not an array on ${r.key}`);
      for (const reason of r.waitingReasons) {
        assert.equal(typeof reason, 'string', `a non-string reason on ${r.key}`);
        assert.ok(reason, `a reason with nothing to say on ${r.key}`);
      }
    }
    // An assigned issue has no merge state to read.
    const issue = records.find((r) => r.relationship === 'assigned issue');
    assert.deepEqual(issue.waitingReasons, []);
    // A tracker-only row carries no local merge state to read either.
    const trackerOnly = records.find((r) => r.source === 'tracker');
    assert.deepEqual(trackerOnly.waitingReasons, []);
  }
);

// ===========================================================================
// Outside verification of approvals (§ V)
//
// An approval from inside the education team is not the same as the content
// being verified. An operator approving a docs PR vouches for wording and
// style, not for whether the content is accurate — only an approval from
// OUTSIDE that team (the code PR's author, or another outside reviewer) means
// the work has genuinely been checked.
//
// The roster is `educationTeam` in maintainers.json at the root of the same
// public tracker repo this project already reads its feed from, fetched with
// the same degradation discipline. The logins are never written down here:
// the roster belongs to the team and changes without reference to this tool.
// ===========================================================================

const ROSTER = { educationTeam: ['insider1', 'INSIDER2'] };

/** A tracker feed covering the docs repo, which is what puts a row inside the
 * rule's scope: the scope is read off the feed's own keys, never listed here. */
function trackerCovering(repo, number = 9001) {
  return {
    [`${repo}#${number}`]: {
      docsUpdatedAt: daysAgo(3),
      rawDocsReviews: [],
      rawDocsComments: [],
    },
  };
}

/** An approved docs PR you are reviewing, approved by `approvedBy`. */
function approvedRow(approvedBy, overrides = {}) {
  return local({
    repo: 'mautic/user-documentation',
    number: 6301,
    lastActor: approvedBy,
    author: 'writerA',
    reviewState: 'APPROVED',
    approvedBy,
    ...detail({
      milestone: 'Q3 docs',
      reviews: [{ login: approvedBy, state: 'APPROVED', submittedAt: daysAgo(1) }],
    }),
    ...overrides,
  });
}

// V1 · approved from INSIDE the team → not decisive. The row leaves the
// "approved, heading to merge" lane, which is one of only two lanes published
// on the live site, and says what it is actually waiting for. The approver is
// still named on the row.
run(
  'V1 · an education-team approval is not decisive',
  {
    tasks: [approvedRow('insider1')],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.lane, 'waiting', `lane was ${r.lane}`);
    assert.equal(r.ball, 'Waiting');
    assert.equal(r.approval.verified, false);
    assert.equal(r.approval.by, 'insider1', 'who approved is still recorded');
    assert.equal(
      r.nextStep,
      'Approved by the education team — waiting on an outside review',
      r.nextStep
    );
  }
);

// V1b · roster logins are matched case-insensitively, the way every other
// login comparison in this engine is.
run(
  'V1b · roster matching ignores case',
  {
    tasks: [approvedRow('Insider2')],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.approval.verified, false);
    assert.equal(r.lane, 'waiting', `lane was ${r.lane}`);
  }
);

// V2 · approved from OUTSIDE the team → decisive, exactly as today. The
// content has been checked by someone who can vouch for it.
run(
  'V2 · an outside approval is decisive',
  {
    tasks: [approvedRow('outsiderX')],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.lane, 'ready', `lane was ${r.lane}`);
    assert.equal(r.ball, 'Approved');
    assert.equal(r.approval.verified, true);
  }
);

// V2b · one outside approval is enough, even alongside an in-team one.
run(
  'V2b · an outside approval alongside an in-team one still counts',
  {
    tasks: [
      approvedRow('insider1', {
        ...detail({
          milestone: 'Q3 docs',
          reviews: [
            { login: 'insider1', state: 'APPROVED', submittedAt: daysAgo(2) },
            { login: 'outsiderX', state: 'APPROVED', submittedAt: daysAgo(1) },
          ],
        }),
      }),
    ],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.approval.verified, true);
    assert.equal(r.lane, 'ready', `lane was ${r.lane}`);
  }
);

// V3 · THE DEGRADATION CASE. The roster failed to fetch and no cached copy
// exists, so it arrives empty — and every approval is decisive, exactly as the
// code behaved before this rule existed. A file that failed to download must
// never look like a judgement about someone's content.
run(
  'V3 · no roster (fetch failed, no cache) → every approval is decisive',
  {
    tasks: [approvedRow('insider1')],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: { educationTeam: [] },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.lane, 'ready', `lane was ${r.lane}`);
    assert.equal(r.ball, 'Approved');
    assert.equal(r.approval.verified, true);
  }
);

// V3b · the roster argument omitted entirely behaves the same way.
run(
  'V3b · no roster argument at all → every approval is decisive',
  {
    tasks: [approvedRow('insider1')],
    tracker: trackerCovering('mautic/user-documentation'),
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.lane, 'ready', `lane was ${r.lane}`);
    assert.equal(r.approval.verified, true);
  }
);

// V4 · SCOPE. The same in-team login approving in a repo the tracker does not
// cover changes nothing: an education-team approval means nothing in an
// unrelated org, and applying the rule everywhere would quietly demote
// approvals from projects it was never about.
run(
  'V4 · an approval outside the tracker\'s repos is unaffected',
  {
    tasks: [approvedRow('insider1', { repo: 'someorg/app', number: 6302, ...detail({
      reviews: [{ login: 'insider1', state: 'APPROVED', submittedAt: daysAgo(1) }],
    }) })],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'someorg/app#6302');
    assert.equal(r.lane, 'ready', `lane was ${r.lane}`);
    assert.equal(r.approval.verified, true);
  }
);

// V4b · A note left AFTER an in-team approval is still a real ask the owner
// owes whoever wrote it, so it keeps the action lane. The verification rule
// only ever removes the "approved, heading to merge" claim — it must not
// swallow a request that named the owner.
run(
  'V4b · a note since the approval still outranks the verification rule',
  {
    tasks: [
      approvedRow('insider1', {
        ...detail({
          milestone: 'Q3 docs',
          reviews: [{ login: 'insider1', state: 'APPROVED', submittedAt: daysAgo(2) }],
          comments: [{ login: 'writerA', createdAt: daysAgo(1) }],
        }),
      }),
    ],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.lane, 'action', `lane was ${r.lane}`);
    assert.equal(r.nextStep, 'Note since approval — take a look, then merge', r.nextStep);
    assert.equal(r.approval.verified, false, 'the approval is still not decisive');
  }
);

// V5 · A DISMISSED approval names an approver but is not a standing verdict on
// the content, so it is not counted either way — the row keeps the "re-request
// the review" reading it has today.
run(
  'V5 · a dismissed approval keeps its re-request reading',
  {
    tasks: [
      approvedRow('insider1', {
        reviewState: null,
        approvedBy: null,
        ...detail({
          milestone: 'Q3 docs',
          reviews: [{ login: 'insider1', state: 'DISMISSED', submittedAt: daysAgo(1) }],
        }),
      }),
    ],
    tracker: trackerCovering('mautic/user-documentation'),
    roster: ROSTER,
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#6301');
    assert.equal(r.lane, 'ready', `lane was ${r.lane}`);
    assert.equal(r.nextStep, 'Re-request review from insider1', r.nextStep);
  }
);


// ===========================================================================
// Idle wording (§ I) — nextStep states the reason plainly at any age. Age
// itself lives only in idleDays (rendered as the pill's "· Nd" badge), never
// folded into the step text as a remind/follow-up/escalate word — that ladder
// belongs to the upstream tracker's own code-author-reminder timeline (see
// the LCP fixtures), which this repo doesn't model for generic action rows.
// Regression: this used to append "· idle Nd, escalate" and mislabel any
// aged action-lane row (e.g. a plain review request) as needing escalation.
// ===========================================================================

for (const days of [3, 8, 11, 20]) {
  run(
    `I1 · idle ${days}d → reason stays plain, age lives in idleDays`,
    {
      tasks: [
        local({
          repo: 'someorg/app',
          number: 6040 + days,
          updatedAt: daysAgo(days),
          lastSubstantiveDate: daysAgo(days),
          lastActor: 'writerA',
          author: 'writerA',
        }),
      ],
    },
    ({ records }) => {
      assert.equal(records[0].nextStep, AUTHOR_REPLIED, records[0].nextStep);
      assert.ok(records[0].idleDays >= days, `idleDays was: ${records[0].idleDays}`);
    }
  );
}

// I2. Same bare reason at zero days too — nothing special about crossing a
// threshold, because there's no longer a threshold-driven suffix to cross.
run(
  'I2 · fresh row → same bare reason',
  {
    tasks: [local({ repo: 'someorg/app', number: 6060, lastActor: 'writerA', author: 'writerA' })],
  },
  ({ records }) => {
    assert.equal(records[0].nextStep, AUTHOR_REPLIED, records[0].nextStep);
  }
);

// I3. Steps that already state their own age don't double up on it.
run(
  'I3 · a step carrying its own age gets no idle suffix',
  {
    tasks: [
      local({
        repo: 'someorg/app',
        number: 6061,
        updatedAt: daysAgo(20),
        lastSubstantiveDate: daysAgo(20),
        lastActor: ME,
        author: 'writerA',
        ...detail({ reviews: [{ login: ME, state: 'COMMENTED', submittedAt: daysAgo(20) }] }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(
      records[0].nextStep,
      "Reviewed 20d ago — author hasn't replied",
      records[0].nextStep
    );
    assert.ok(!/idle 20d/.test(records[0].nextStep), 'no "20d ago · idle 20d"');
  }
);

// ===========================================================================
// Degradation (§ D) — the tracker can be down, and none of this may care.
// ===========================================================================

// D1. Feed down, no cache at all: the local fields carry the whole thing.
run(
  'D1 · tracker feed down → local fields still derive the specific step',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6070,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({
          reviews: [{ login: 'reviewerQ', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(2) }],
        }),
      }),
    ],
    feed: {
      data: {},
      fetchedAt: null,
      degraded: true,
      reason: 'live fetch failed; no cached feed',
    },
  },
  ({ records, feed }) => {
    assert.equal(feed.degraded, true);
    assert.equal(
      records[0].nextStep,
      'Changes requested by reviewerQ — address the feedback',
      records[0].nextStep
    );
  }
);

// D2. Where BOTH sides carry an array, upstream wins — the tracker sees a
// repo's full history, the local cache is capped and can miss older activity.
run(
  'D2 · upstream reviews preferred over the local copy',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6071,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({
          // A milestone is set so this fixture stays about the merge
          // preference and not the § M trailing clause.
          milestone: 'Q3 docs',
          reviews: [{ login: 'localGuy', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(2) }],
        }),
      }),
    ],
    tracker: {
      'mautic/user-documentation#6071': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [
          { user: { login: 'upstreamGuy' }, state: 'CHANGES_REQUESTED', submitted_at: daysAgo(2) },
        ],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    assert.equal(
      records[0].nextStep,
      'Changes requested by upstreamGuy — address the feedback',
      records[0].nextStep
    );
  }
);

// D3. An EMPTY upstream array is not a source of truth — it falls through to
// the local copy instead of blanking a row that has real local activity.
run(
  'D3 · empty upstream array falls through to local activity',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 6072,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({
          // A milestone is set so this fixture stays about the merge
          // preference and not the § M trailing clause.
          milestone: 'Q3 docs',
          reviews: [{ login: 'localGuy', state: 'CHANGES_REQUESTED', submittedAt: daysAgo(2) }],
        }),
      }),
    ],
    tracker: {
      'mautic/user-documentation#6072': {
        docsUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    assert.equal(
      records[0].nextStep,
      'Changes requested by localGuy — address the feedback',
      records[0].nextStep
    );
  }
);

// D4. A record whose activity blows up mid-read yields NO signals rather than
// a thrown build. The row still lands in a lane.
run(
  'D4 · malformed activity degrades to no signals, never a throw',
  {
    prs: [
      local({
        repo: 'someorg/app',
        number: 6073,
        lastActor: 'reviewerQ',
        author: ME,
        hasFormalReview: true,
        ...detail({
          comments: [
            {
              get login() {
                throw new Error('drifted record');
              },
            },
          ],
        }),
      }),
    ],
  },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.equal(records[0].nextStep, 'Address the review feedback', records[0].nextStep);
  }
);

// ===========================================================================
// Linked code PR state (rule 3a)
// ===========================================================================

// LCP1. Linked code PR merged → action lane, "review the docs now".
run(
  'LCP1 · linked code PR merged → action lane',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 7001,
        author: ME,
        lastActor: ME,
        body: 'Docs for https://github.com/mautic/mautic/pull/17001',
        linkedCodePrState: 'merged',
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'action');
    assert.equal(r.ball, 'Take Action');
    assert.equal(r.nextStep, 'Code PR merged — review the docs now');
  }
);

// LCP2. Linked code PR closed unmerged → action lane, "close this docs PR".
run(
  'LCP2 · linked code PR closed unmerged → action lane',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 7002,
        author: ME,
        lastActor: ME,
        body: 'Docs for https://github.com/mautic/mautic/pull/17002',
        linkedCodePrState: 'closed',
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'action');
    assert.equal(r.ball, 'Take Action');
    assert.equal(r.nextStep, 'Code PR closed unmerged — close this docs PR');
  }
);

// LCP3. Linked code PR still open → no verdict, falls through to the
// turn-based reading unchanged (here: the ball is still with the author,
// waiting on their own reply).
run(
  'LCP3 · linked code PR open → falls through to turn logic',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 7003,
        author: ME,
        lastActor: ME,
        body: 'Docs for https://github.com/mautic/mautic/pull/17003',
        linkedCodePrState: 'open',
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'waiting');
    assert.notEqual(r.nextStep, 'Code PR merged — review the docs now');
    assert.notEqual(r.nextStep, 'Code PR closed unmerged — close this docs PR');
  }
);

// LCP4. Unknown (null) state — a failed/403 fetch — carries no verdict
// either, same fallthrough as 'open'.
run(
  'LCP4 · linked code PR state unknown (null) → falls through to turn logic',
  {
    prs: [
      local({
        repo: 'mautic/user-documentation',
        number: 7004,
        author: ME,
        lastActor: ME,
        body: 'Docs for https://github.com/mautic/mautic/pull/17004',
        linkedCodePrState: null,
      }),
    ],
  },
  ({ records }) => {
    const r = records[0];
    assert.equal(r.lane, 'waiting');
    assert.notEqual(r.nextStep, 'Code PR merged — review the docs now');
    assert.notEqual(r.nextStep, 'Code PR closed unmerged — close this docs PR');
  }
);


// ===========================================================================
// Tracker-only idleDays: docs PR and code PR move on separate clocks, so
// staleness must look at whichever one moved last.
// ===========================================================================

// TID1. Docs PR moved recently, code PR is stale → idleDays follows docs.
run(
  'TID1 · tracker-only, docs newer than code → idleDays from docs date',
  {
    tracker: {
      'mautic/user-documentation#900': {
        docsUpdatedAt: daysAgo(2),
        codeUpdatedAt: daysAgo(83),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#900');
    assert.ok(Math.abs(r.idleDays - 2) < 0.01, `idleDays was ${r.idleDays}`);
    assert.notEqual(r.lane, 'stalled', `lane was ${r.lane}`);
  }
);

// TID1b. The combined clock feeds idleDays and STOPS THERE. `updatedAt` stays
// the docs PR's own date on both record paths, because it answers a different
// question ("when did this row last change") and is published in
// data/workbench.json, where a consumer would read it that way. Pinned as a
// test because the two fields sit on adjacent lines and the wrong one is an
// easy, silent thing to reach for.
run(
  'TID1b · tracker-only, updatedAt stays the docs date even when code is newer',
  {
    tracker: {
      'mautic/user-documentation#902': {
        docsUpdatedAt: daysAgo(83),
        codeUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#902');
    assert.equal(r.updatedAt, r.upstream.docsUpdatedAt, `updatedAt was ${r.updatedAt}`);
    assert.notEqual(r.updatedAt, r.upstream.codeUpdatedAt, 'updatedAt must not follow the code PR');
    assert.ok(Math.abs(r.idleDays - 1) < 0.01, `idleDays was ${r.idleDays}`);
  }
);

// TID2. Code PR moved recently, docs PR is stale → idleDays follows code, not
// docs. This is the bug: previously idleDays only ever looked at docsUpdatedAt,
// so a pair whose code PR moved today still reported 83 days idle.
run(
  'TID2 · tracker-only, code newer than docs → idleDays from code date',
  {
    tracker: {
      'mautic/user-documentation#901': {
        docsUpdatedAt: daysAgo(83),
        codeUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#901');
    assert.ok(Math.abs(r.idleDays - 1) < 0.01, `idleDays was ${r.idleDays}`);
    assert.notEqual(r.lane, 'stalled', `lane was ${r.lane}`);
  }
);

// TID3. codeUpdatedAt absent → idleDays falls back to docsUpdatedAt alone.
run(
  'TID3 · tracker-only, codeUpdatedAt missing → idleDays from docs date',
  {
    tracker: {
      'mautic/user-documentation#902': {
        docsUpdatedAt: daysAgo(5),
        codeUpdatedAt: null,
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#902');
    assert.ok(Math.abs(r.idleDays - 5) < 0.01, `idleDays was ${r.idleDays}`);
  }
);

// TID4. Both dates absent → idleDays stays 0, matching the pre-existing
// no-date fallback (a missing date is not the same as "idle forever").
run(
  'TID4 · tracker-only, both dates missing → idleDays is 0',
  {
    tracker: {
      'mautic/user-documentation#903': {
        docsUpdatedAt: null,
        codeUpdatedAt: null,
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#903');
    assert.equal(r.idleDays, 0, `idleDays was ${r.idleDays}`);
  }
);

// TID5. Matched local+tracker row: lastSubstantiveDate is more recent than
// codeUpdatedAt → the local, more-precise date still wins.
run(
  'TID5 · matched pair, lastSubstantiveDate newer than code → local date wins',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 910,
        lastSubstantiveDate: daysAgo(2),
        updatedAt: daysAgo(2),
      }),
    ],
    tracker: {
      'mautic/user-documentation#910': {
        docsUpdatedAt: daysAgo(2),
        codeUpdatedAt: daysAgo(40),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#910');
    assert.equal(r.source, 'local+tracker');
    assert.ok(Math.abs(r.idleDays - 2) < 0.01, `idleDays was ${r.idleDays}`);
  }
);

// TID6. Matched local+tracker row: codeUpdatedAt is more recent than
// lastSubstantiveDate → the code PR's activity pulls the row out of stalled,
// same as the tracker-only path.
run(
  'TID6 · matched pair, code newer than lastSubstantiveDate → code date wins, leaves stalled',
  {
    tasks: [
      local({
        repo: 'mautic/user-documentation',
        number: 911,
        lastSubstantiveDate: daysAgo(83),
        updatedAt: daysAgo(83),
      }),
    ],
    tracker: {
      'mautic/user-documentation#911': {
        docsUpdatedAt: daysAgo(83),
        codeUpdatedAt: daysAgo(1),
        rawDocsReviews: [],
        rawDocsComments: [],
      },
    },
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'mautic/user-documentation#911');
    assert.equal(r.source, 'local+tracker');
    assert.ok(Math.abs(r.idleDays - 1) < 0.01, `idleDays was ${r.idleDays}`);
    assert.notEqual(r.lane, 'stalled', `lane was ${r.lane}`);
  }
);

// TID7. Matched row with no tracker entry (source 'local', upstream null) →
// codeUpdatedAt has nothing to read, idleDays falls back to the local chain
// exactly as before. Guards against a null-upstream crash.
run(
  'TID7 · local-only row, no tracker entry → idleDays from local chain, no crash',
  {
    tasks: [
      local({
        repo: 'x/y',
        number: 912,
        lastSubstantiveDate: daysAgo(6),
        updatedAt: daysAgo(6),
      }),
    ],
  },
  ({ records }) => {
    const r = records.find((x) => x.key === 'x/y#912');
    assert.equal(r.source, 'local');
    assert.ok(Math.abs(r.idleDays - 6) < 0.01, `idleDays was ${r.idleDays}`);
  }
);

// ===========================================================================
// UTC period boundaries
// ===========================================================================

// UTC1. Month and quarter boundaries are UTC instants, so the same data yields
// the same numbers on a UTC CI runner and on a UTC+2 laptop. Pinned to the
// sharpest instant available: 30 minutes into 2026-07-01, which starts both a
// month and a quarter. Under runner-local boundaries the June 30 23:00Z merge
// lands inside "this month" for any timezone east of UTC, silently inflating
// the Workbench's figures for the first hours of every period.
{
  const boundaryNow = new Date('2026-07-01T00:30:00Z');
  const impact = computeImpact(
    [],
    {
      pullRequests: [{ date: '2026-06-30T23:00:00Z', mergedAt: '2026-06-30T23:00:00Z' }],
      reviewedPrs: [
        { repo: 'a/june', date: '2026-06-30T23:00:00Z', mergedAt: '2026-06-30T23:00:00Z' },
        { repo: 'a/july', date: '2026-07-01T00:10:00Z', mergedAt: '2026-07-01T00:10:00Z' },
      ],
      coAuthoredPrs: [],
    },
    boundaryNow
  );
  assert.equal(impact.helpedShipThisMonth, 1, 'only the 00:10Z July merge is in July (UTC)');
  assert.equal(impact.shippedThisQuarter, 1, 'the 23:00Z June merge belongs to Q2, not Q3');
  assert.equal(impact.projectsThisMonth, 1, 'a/july only');
  console.log('  ok  UTC1 · month/quarter boundaries are UTC, not runner-local');
}

if (process.exitCode) {
  console.error('\nfixture run FAILED');
} else {
  console.log('\nall workbench-merge fixtures passed');
}
