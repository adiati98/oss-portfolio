/**
 * BACKPORT RULES — copied from the Mautic docs PR tracker
 *
 * A backport (or cherry-pick) is one change opened again against another
 * branch, e.g. the reviewed 7.3 docs PR copied onto 8.0. These rules decide
 * which earlier PR ("the parent") a PR was copied from.
 *
 * Source: adiati98/mautic-docs-prs-tracker, tracker.js at commit 92436323
 * ("Fix: backport and cherry-pick detection edge cases"). The tracker is the
 * source of truth for these rules, and it is used by a team, so it is never
 * changed from here. Only its public file is read. The patterns and
 * functions below are copied as closely as possible — edit them only to
 * follow a change in the tracker, never on their own.
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
 *     the tracker's other mode: the parent must be a real PR, on a different
 *     branch than this one (same repo), or simply a real PR (a parent found
 *     in the sister docs repo).
 *   - extractFirstBareReference strips HTML comments first (see its own
 *     comment) — a real PR's body matched a PR template's own placeholder
 *     example number instead of its real, URL-only parent reference.
 */

/**
 * The tracker commit these rules were copied from. Stored with every cached
 * verdict, so changing it makes the next run check every PR again.
 */
const TRACKER_RULES_COMMIT = '92436323';

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

/** The other repo the tracker watches, or null. */
function sisterDocsRepo(repo) {
  const lower = String(repo || '').toLowerCase();
  return TRACKER_REPOS.find((r) => r !== lower) ?? null;
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
// "— branch X.Y" convention above — it may still name its parent PR in the
// body ("following https://github.com/<repo>/pull/<N>"), or use backport
// language like "cherry-pick #<N>" / "following #<N>". Only the first
// same-repo reference is read.
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

/**
 * Whether or not the title already follows the "— branch X.Y" convention, the
 * body may still name the bump PR this one was copied from. Confirming (one
 * extra lookup) that the named PR was really authored by dependabot both
 * catches titles that don't follow the convention and records that PR as
 * this one's original — which the title-only match never gives us.
 */
async function resolveManualDependencyBackport({ repo, number, title, body, baseBranch, getPull }) {
  let isManualDependencyBackport = isDependencyBumpBackportTitle(title || '', baseBranch);
  let parent = null;
  const referencedNumber = extractReferencedPRNumber(repo, `${title}\n${body || ''}`);
  if (referencedNumber && referencedNumber !== number) {
    const referencedPR = await getPull(repo, referencedNumber);
    if (referencedPR && referencedPR.author === DEPENDABOT_LOGIN) {
      isManualDependencyBackport = true;
      parent = {
        number: referencedNumber,
        repo,
        branch: referencedPR.baseBranch,
        merged: referencedPR.merged === true,
        mergedAt: referencedPR.mergedAt || null,
      };
    }
  }
  return { isManualDependencyBackport, parent };
}

// "… (8.0 backport)", "… (backport 8.0)", "… (8.0)", "… [8.0]", "… (8.0
// port)" — the trailing marker that tells two otherwise identical PRs apart.
// A second alternative covers the unbracketed form hand-made dependency-bump
// copies use instead ("… — branch 8.0", "… - branch 8.0"). Captures the
// branch name.
const BACKPORT_TITLE_SUFFIX_PATTERN =
  /[\s—-]*[([](?:backport\s+)?([\w.]+)(?:\s+(?:backport|port))?[)\]]\s*$|[\s—-]+branch\s+([\w.]+)\s*$/i;

function backportTitleSuffixBranch(title) {
  const m = (title || '').match(BACKPORT_TITLE_SUFFIX_PATTERN);
  return m ? (m[1] ?? m[2]) : null;
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
// sentence (at most 150 characters later, lazily — the match stops at the
// FIRST "#" it can reach, not the last). A "#" glued to a word or a "/"
// (like "mautic/mautic#123") is another repo's number, so it is skipped. A
// sentence ends at a "." followed by whitespace and a capital letter, so the
// dots inside "7.1" don't end it. "port" alone ("Ports the Roles overview
// documentation from PR #815") is only included when includePortAlone is
// true — a bare "port" is common enough in unrelated prose that it is only
// trusted where the caller has other reason to believe this is deliberate
// backport wording.
const SENTENCE_BREAK = String.raw`\.\s+[A-Z]`;
function backportReferenceWordPattern(includePortAlone) {
  const portAlone = includePortAlone ? '|port(?:ed|s|ing)?' : '';
  return new RegExp(
    String.raw`\b(?:back(?:[\s/-]+(?:and[\s/-]+)?forward)?[\s/-]?port(?:ed|s|ing)?|forward[\s/-]?port(?:ed|s|ing)?|cherry[-\s]?pick(?:ed|s|ing)?${portAlone})\b(?:(?!${SENTENCE_BREAK}|\n).){0,150}?(?<![\w/])#(\d+)`,
    'i'
  );
}

// Same backport wording, but pointing at a full GitHub URL instead of a bare
// "#123" — only matched when the URL's repo is the given repo, so a link to
// the *code* PR right next to the same wording is never mistaken for the
// docs backport's parent.
function backportReferenceUrlPattern(repo) {
  const repoEscaped = escapeRegExp(repo);
  return new RegExp(
    String.raw`\b(?:backport(?:ed|s|ing)?|cherry[-\s]?pick(?:ed|s|ing)?)\b(?:(?!${SENTENCE_BREAK}|\n).){0,150}?github\.com/${repoEscaped}/pull/(\d+)`,
    'i'
  );
}

/**
 * Returns { number, repo } for the parent this text names, or null. repo is
 * sourceRepo unless the reference is a full URL into the sister docs repo, in
 * which case it's that repo instead — a backport can be copied from either
 * docs repo into the other.
 */
function extractBackportParentNumber(text, sourceRepo, includePortAlone = true) {
  if (!text) return null;
  let m = text.match(backportReferenceWordPattern(includePortAlone));
  if (m) return { number: Number(m[1]), repo: sourceRepo };
  m = text.match(backportReferenceUrlPattern(sourceRepo));
  if (m) return { number: Number(m[1]), repo: sourceRepo };
  const sister = sisterDocsRepo(sourceRepo);
  if (sister) {
    m = text.match(backportReferenceUrlPattern(sister));
    if (m) return { number: Number(m[1]), repo: sister };
  }
  return null;
}

// A bare "#NNN" not glued to a repo qualifier — used only where a title's own
// "— branch X" suffix already establishes this PR as a deliberate copy for
// branch X, so the first PR number the body mentions can be trusted even
// without recognized backport wording next to it (e.g. "based on #481").
//
// DELIBERATE DEVIATION FROM THE TRACKER: HTML comments are stripped first.
// GitHub's default PR template puts an example like "Closes #123" inside an
// HTML comment (invisible on GitHub, meant only as a hint for contributors).
// With no wording requirement at all, this is the one signal a template's
// own placeholder number can slip into by pure luck — a real PR did exactly
// this, matching a real (unrelated) PR number from the template text instead
// of the real parent named later in the body. Every other signal requires
// backport wording right next to the number, which a template's own
// boilerplate does not happen to contain.
function extractFirstBareReference(text) {
  if (!text) return null;
  const withoutComments = String(text).replace(/<!--[\s\S]*?-->/g, ' ');
  const m = withoutComments.match(/(?<![\w/])#(\d+)/);
  return m ? Number(m[1]) : null;
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
 *   1. An explicit reference in the title/body wins outright — including one
 *      naming a PR in the sister docs repo.
 *   1b. A title ending in "— branch X" where X is this PR's own branch
 *       already says this copy was made on purpose for that branch, which is
 *       enough to trust the first same-repo PR number the body mentions even
 *       without recognized backport wording next to it.
 *   2. Otherwise, a PR with the same title (branch suffix ignored), opened
 *      EARLIER than this one. Titles under 12 characters are too generic, and
 *      dependency bumps never match by title. The earliest match wins.
 *
 * Every candidate is confirmed before it counts: it must be a real PR, and
 * (same repo) on a different branch than this one — a sister-repo parent only
 * has to be a real PR, since there's no shared branch to compare.
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
  allowPortAloneWord = true,
  pool = [],
  getPull,
}) {
  const getBase = lazy(baseBranch);

  const confirm = async (candidate) => {
    if (!candidate) return null;
    const candidateRepo = typeof candidate === 'object' ? candidate.repo : repo;
    const candidateNumber = typeof candidate === 'object' ? candidate.number : candidate;
    const sameRepo = String(candidateRepo).toLowerCase() === String(repo).toLowerCase();
    if (!candidateNumber || (sameRepo && candidateNumber === number)) return null;
    const parent = await getPull(candidateRepo, candidateNumber);
    if (!parent || !parent.baseBranch) return null;
    if (sameRepo) {
      const mine = await getBase();
      if (!mine || parent.baseBranch === mine) return null;
    }
    return {
      number: candidateNumber,
      repo: candidateRepo,
      branch: parent.baseBranch,
      merged: parent.merged === true,
      mergedAt: parent.mergedAt || null,
    };
  };

  // Signal 1 — an explicit reference wins outright.
  const referenced = extractBackportParentNumber(`${title}\n${body || ''}`, repo, allowPortAloneWord);
  const byReference = await confirm(referenced);
  if (byReference) return byReference;

  // Signal 1b — a title ending in "— branch X" naming this PR's own branch.
  // Checked before touching getBase() at all, so a title with no such suffix
  // never costs a lookup.
  const allowedForTitle =
    typeof allowTitleMatch === 'function' ? await allowTitleMatch() : allowTitleMatch;
  const suffixBranch = backportTitleSuffixBranch(title);
  if (allowedForTitle && suffixBranch !== null && suffixBranch === (await getBase())) {
    const byBareReference = await confirm(extractFirstBareReference(body));
    if (byBareReference) return byBareReference;
  }

  // Signal 2 — the earliest older PR with the same title, branch suffix aside.
  const normalized = normalizeTitleForBackportMatch(title);
  if (!allowedForTitle || !normalized || normalized.length < 12 || !createdAt) return null;

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
  escapeRegExp,
  isDependencyBumpBackportTitle,
  extractReferencedPRNumber,
  resolveManualDependencyBackport,
  backportTitleSuffixBranch,
  normalizeTitleForBackportMatch,
  extractBackportParentNumber,
  isTitleMatchAllowed,
  findBackportParent,
};
