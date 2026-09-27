/**
 * BACKPORT RULES — copied from the Mautic docs PR tracker
 *
 * A backport (or cherry-pick) is one change opened again against another
 * branch, e.g. the reviewed 7.3 docs PR copied onto 8.0. These rules decide
 * which earlier PR ("the parent") a PR was copied from.
 *
 * Source: adiati98/mautic-docs-prs-tracker, tracker.js at commit a1ef8af5
 * (its PR #42). The tracker is the source of truth for these rules, and it is
 * used by a team, so it is never changed from here. Only its public file is
 * read. The patterns and functions below are copied as closely as possible —
 * edit them only to follow a change in the tracker, never on their own.
 *
 * tracker-rules-watch.js compares this copy against the tracker's current
 * tracker.js on every run and prints a warning when the tracker's backport
 * logic has changed. When that happens: copy the new rules here, update
 * TRACKER_RULES_COMMIT, and refresh the baseline in tracker-rules-watch.js.
 *
 * What differs from the tracker, on purpose:
 *   - The tracker checks docs PRs one repo at a time. oss-portfolio uses the
 *     same rules for every repo.
 *   - The tracker's title match reads a list of each repo's 500 most recently
 *     updated PRs. oss-portfolio matches against PRs it already knows (the
 *     contributions data and the workbench), so it costs no API calls.
 *   - The tracker can also check a parent against the branch its linked code
 *     PR names. oss-portfolio has no code-PR data for that, so it always uses
 *     the tracker's other mode: the parent must be a real PR in the same repo,
 *     on a different branch.
 */

/**
 * The tracker commit these rules were copied from. Stored with every cached
 * verdict, so changing it makes the next run check every PR again.
 */
const TRACKER_RULES_COMMIT = 'a1ef8af5';

/** The repos the tracker covers (its REPOS.docs). */
const TRACKER_REPOS = ['mautic/developer-documentation-new', 'mautic/user-documentation'];

const DEPENDABOT_LOGIN = 'dependabot[bot]';

function isTrackerRepo(repo) {
  const lower = String(repo || '').toLowerCase();
  return TRACKER_REPOS.includes(lower);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A maintainer hand-porting a dependency bump names the PR after the original
// bump's title with a "— branch X.Y" suffix, e.g. "chore(deps): bump rstcheck
// from 6.2.5 to 6.3.0 in /docs — branch 7.0" against base branch "7.0".
const DEPENDENCY_BACKPORT_TITLE_PATTERN = /bump.*[-—]\s*branch\s+([\w.]+)\s*$/i;
function isDependencyBumpBackportTitle(title, baseBranch) {
  const m = title.match(DEPENDENCY_BACKPORT_TITLE_PATTERN);
  return m !== null && m[1] === baseBranch;
}

// Fallback for a hand-made bump backport whose title doesn't follow the
// "— branch X.Y" convention: the first same-repo PR it names.
function extractReferencedPRNumber(sourceRepo, text) {
  if (!text) return null;
  const repoEscaped = escapeRegExp(sourceRepo);
  let m = text.match(new RegExp(`github\\.com/${repoEscaped}/pull/(\\d+)`, 'i'));
  if (m) return Number(m[1]);
  m = text.match(/cherry-pick(?:ed|s|ing)?\s*(?:of\s*)?#(\d+)/i);
  if (m) return Number(m[1]);
  m = text.match(/\bfollowing\s+#(\d+)/i);
  if (m) return Number(m[1]);
  return null;
}

// "… (8.0 backport)", "… (backport 8.0)", "… (8.0)", "… [8.0]" — the trailing
// marker that tells two otherwise identical PRs apart. Captures the branch.
const BACKPORT_TITLE_SUFFIX_PATTERN =
  /[\s—-]*[([](?:backport\s+)?([\w.]+)(?:\s+backport)?[)\]]\s*$/i;

function backportTitleSuffixBranch(title) {
  const m = (title || '').match(BACKPORT_TITLE_SUFFIX_PATTERN);
  return m ? m[1] : null;
}

// The title with that marker removed, whitespace collapsed, lowercased — so a
// copy and its parent compare equal.
function normalizeTitleForBackportMatch(title) {
  return (title || '')
    .replace(BACKPORT_TITLE_SUFFIX_PATTERN, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Backport wording followed by a bare same-repo "#123" within the same
// sentence (at most 150 characters later). A "#" glued to a word or a "/"
// (like "mautic/mautic#123") is another repo's number, so it is skipped. A
// sentence ends at a "." followed by whitespace and a capital letter, so the
// dots inside "7.1" don't end it.
const SENTENCE_BREAK = String.raw`\.\s+[A-Z]`;
const BACKPORT_REFERENCE_WORD_PATTERN = new RegExp(
  String.raw`\b(?:back(?:[\s/-]+(?:and[\s/-]+)?forward)?[\s/-]?port(?:ed|s|ing)?|forward[\s/-]?port(?:ed|s|ing)?|cherry[-\s]?pick(?:ed|s|ing)?)\b(?:(?!${SENTENCE_BREAK}|\n).){0,150}(?<![\w/])#(\d+)`,
  'i'
);

// Same wording, pointing at a full link to a PR in this same repo.
function backportReferenceUrlPattern(sourceRepo) {
  const repoEscaped = escapeRegExp(sourceRepo);
  return new RegExp(
    String.raw`\b(?:backport(?:ed|s|ing)?|cherry[-\s]?pick(?:ed|s|ing)?)\b(?:(?!${SENTENCE_BREAK}|\n).){0,150}?github\.com/${repoEscaped}/pull/(\d+)`,
    'i'
  );
}

function extractBackportParentNumber(text, sourceRepo) {
  if (!text) return null;
  let m = text.match(BACKPORT_REFERENCE_WORD_PATTERN);
  if (m) return Number(m[1]);
  m = text.match(backportReferenceUrlPattern(sourceRepo));
  if (m) return Number(m[1]);
  return null;
}

/** Accepts a plain value or a (possibly async) function, and calls it at most once. */
function lazy(valueOrFn) {
  let done = false;
  let value;
  return async () => {
    if (!done) {
      value = typeof valueOrFn === 'function' ? await valueOrFn() : valueOrFn;
      done = true;
    }
    return value;
  };
}

/**
 * The tracker's rule for when title matching is allowed: never for a
 * dependabot PR, and never for a hand-made backport of a dependency bump
 * (bump titles repeat across branches without being backports).
 */
async function isTitleMatchAllowed({ repo, number, title, body, author, baseBranch, getPull }) {
  if (author === DEPENDABOT_LOGIN) return false;
  const getBase = lazy(baseBranch);
  if (DEPENDENCY_BACKPORT_TITLE_PATTERN.test(title || '')) {
    if (isDependencyBumpBackportTitle(title, await getBase())) return false;
  }
  const referencedNumber = extractReferencedPRNumber(repo, `${title}\n${body || ''}`);
  if (referencedNumber && referencedNumber !== number) {
    const referenced = await getPull(repo, referencedNumber);
    if (referenced && referenced.author === DEPENDABOT_LOGIN) return false;
  }
  return true;
}

/**
 * Finds the PR this one was copied from, or null. Follows the tracker's
 * findBackportParent for a PR with no linked code PR (expectedBranch null):
 *
 *   1. An explicit reference in the title/body wins outright.
 *   2. Otherwise, a PR with the same title (branch suffix ignored), opened
 *      EARLIER than this one. Titles under 12 characters are too generic, and
 *      dependency bumps never match by title. The earliest match wins.
 *
 * Either way the parent is confirmed before it counts: it must be a real PR in
 * the same repo, on a different branch than this one.
 *
 * `baseBranch` and `allowTitleMatch` may be functions, so the caller only pays
 * for looking them up when a candidate actually exists. `pool` is the list of
 * known PRs ({ repo, number, title, createdAt }) used for title matching.
 * `getPull(repo, number)` returns { baseBranch, merged, mergedAt, author } or
 * null when the PR does not exist; it throws when the lookup failed, so a
 * failure never becomes a "not a backport" verdict.
 */
async function findBackportParent({
  repo,
  number,
  title,
  body,
  baseBranch,
  createdAt,
  allowTitleMatch = true,
  pool = [],
  getPull,
}) {
  const getBase = lazy(baseBranch);

  const confirm = async (candidate) => {
    if (!candidate || candidate === number) return null;
    const mine = await getBase();
    if (!mine) return null;
    const parent = await getPull(repo, candidate);
    if (!parent || !parent.baseBranch || parent.baseBranch === mine) return null;
    return {
      number: candidate,
      branch: parent.baseBranch,
      merged: parent.merged === true,
      mergedAt: parent.mergedAt || null,
    };
  };

  const referenced = extractBackportParentNumber(`${title}\n${body || ''}`, repo);
  const byReference = await confirm(referenced);
  if (byReference) return byReference;

  const normalized = normalizeTitleForBackportMatch(title);
  if (!normalized || normalized.length < 12 || !createdAt) return null;

  const mineTime = new Date(createdAt).getTime();
  const candidates = pool
    .filter(
      (item) =>
        String(item.repo || '').toLowerCase() === String(repo).toLowerCase() &&
        item.number !== number &&
        item.createdAt &&
        new Date(item.createdAt).getTime() < mineTime &&
        normalizeTitleForBackportMatch(item.title) === normalized
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!candidates.length) return null;

  const allowed = typeof allowTitleMatch === 'function' ? await allowTitleMatch() : allowTitleMatch;
  if (!allowed) return null;

  for (const item of candidates) {
    const confirmed = await confirm(item.number);
    if (confirmed) return confirmed;
  }
  return null;
}

module.exports = {
  TRACKER_RULES_COMMIT,
  TRACKER_REPOS,
  DEPENDABOT_LOGIN,
  isTrackerRepo,
  isDependencyBumpBackportTitle,
  extractReferencedPRNumber,
  backportTitleSuffixBranch,
  normalizeTitleForBackportMatch,
  extractBackportParentNumber,
  isTitleMatchAllowed,
  findBackportParent,
};
