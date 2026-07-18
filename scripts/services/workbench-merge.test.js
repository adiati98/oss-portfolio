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

// B1. Bot's latest comment @-mentions me → my turn: action, no chip, no botPing,
// and never the forbidden "author replied" step.
run(
  'Promptless last actor @-mentions me → action (no chip)',
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
    assert.equal(r.nextStep, null, 'no chip — the lane already says it is my turn');
    assert.ok(!r.botPing, 'no botPing when the bot pinged me');
    assert.notEqual(r.nextStep, AUTHOR_REPLIED);
  }
);

// B1b. Bot pinged me via a live review request (its latest comment names nobody)
// → still my turn: action, no chip, no botPing. Mirrors real #592.
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
    assert.equal(r.nextStep, null);
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

// SR2. Age is urgency text INSIDE a row, never demotion to a folded lane. A
// reviewing row the author last touched 12d ago stays in the action lane and
// carries the escalation in its nextStep.
run(
  'SR2 · author replied 12d ago → still action, age shown as follow-up text',
  { tasks: [local({ number: 4002, updatedAt: daysAgo(12), lastSubstantiveDate: daysAgo(12), lastActor: 'writer3', author: 'writer3' })] },
  ({ records }) => {
    assert.equal(records[0].lane, 'action');
    assert.ok(/12d/.test(records[0].nextStep), records[0].nextStep);
    assert.ok(/follow up|escalate|reminder/i.test(records[0].nextStep), records[0].nextStep);
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
        { author: 'alice', mergedAt: daysAgo(1) }, // this month
        { author: 'bob', mergedAt: '2026-04-02T00:00:00Z' }, // April, prior month
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

if (process.exitCode) {
  console.error('\nfixture run FAILED');
} else {
  console.log('\nall workbench-merge fixtures passed');
}
