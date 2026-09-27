/**
 * BACKPORT RULES — oss-portfolio additions
 *
 * backport-rules.js is an exact copy of the Mautic docs PR tracker's rules.
 * Checked against every PR in the two Mautic docs repos, those rules miss
 * backports that are written in other ways. The rules below catch those. They
 * are oss-portfolio's own, NOT the tracker's — they live in this separate file
 * so the copy stays exact, and so the change alert (tracker-rules-watch.js)
 * keeps watching only the tracker. If the tracker later adds one of these
 * itself, delete it here.
 *
 * Every rule only suggests a parent. The parent is then confirmed the same way
 * as the tracker does it: it must be a real PR, and on a different branch than
 * this one (for a parent in the other docs repo, being in another repo is
 * enough — see rule 5).
 *
 *   1. FIRST #N — the tracker's wording rule is meant to take the first "#N"
 *      after "backport"/"cherry-pick" (its own comment says so), but its
 *      pattern takes the last one within 150 characters. In "backport of
 *      … (PR #754 / mautic#16224), brought into 7.x via merge PR #16327" that
 *      is #16327, not #754. This rule reads the first one. It runs BEFORE the
 *      tracker's rules, because when both find a real PR, the first is right.
 *   2. DEPENDENCY-BUMP COPIES — the tracker already recognises a hand-made copy
 *      of a dependabot PR ("… — branch 7.2", or a body "following
 *      …/pull/603" that points at a dependabot PR), but only uses that to skip
 *      triage; it never records the parent. This rule records it.
 *   3. "PORT" WORDING — "Ports … from PR #815", "Ports PR #755's …". Same
 *      sentence limit as the tracker. Skipped for dependabot PRs: their bodies
 *      are copied changelogs ("port of linkify-it … #82") about other projects.
 *   4. MORE TITLE ENDINGS — "— branch 7.0", "- branch 7.1" and "(7.2 port)"
 *      are removed before titles are compared, like the tracker's "(7.3)".
 *   4b. "— BRANCH X" TITLE + ANY LINK — a title ending in "— branch X" (or
 *      "- branch X") that names this PR's own branch says "I am the copy for
 *      branch X". Then the first PR of the same repo that the body links to
 *      ("based on #481", "following …/pull/603") is the parent, whatever the
 *      wording. This follows the tracker's own idea that a title suffix naming
 *      the PR's own branch marks an intentional copy.
 *   5. THE OTHER DOCS REPO — "cherry-picks https://github.com/mautic/
 *      user-documentation/pull/842" inside developer-documentation-new. Only
 *      between the two Mautic docs repos, and only as a full link: the tracker
 *      ignores other repos on purpose so a linked CODE PR (mautic/mautic) is
 *      never taken for a parent, and that stays true here.
 */
const {
  TRACKER_REPOS,
  DEPENDABOT_LOGIN,
  isDependencyBumpBackportTitle,
  extractReferencedPRNumber,
  normalizeTitleForBackportMatch,
} = require('./backport-rules');

/**
 * Bump this whenever a rule below changes. It is stored with every cached
 * verdict (next to the tracker commit), so the next run judges every PR again.
 */
const ADDITIONS_VERSION = 'additions-1';

// The same sentence limit and backport words as the tracker.
const SENTENCE_BREAK = String.raw`\.\s+[A-Z]`;
const SAME_SENTENCE = String.raw`(?:(?!${SENTENCE_BREAK}|\n).){0,150}?`;
const TRACKER_WORDS = String.raw`back(?:[\s/-]+(?:and[\s/-]+)?forward)?[\s/-]?port(?:ed|s|ing)?|forward[\s/-]?port(?:ed|s|ing)?|cherry[-\s]?pick(?:ed|s|ing)?`;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** First bare same-repo "#N" or same-repo PR link after `words`, in the same sentence. */
function firstReferenceAfter(words, text, repo) {
  const bare = new RegExp(String.raw`\b(?:${words})\b${SAME_SENTENCE}(?<![\w/])#(\d+)`, 'i');
  const link = new RegExp(
    String.raw`\b(?:${words})\b${SAME_SENTENCE}github\.com/${escapeRegExp(repo)}/pull/(\d+)`,
    'i'
  );
  const a = text.match(bare);
  const b = text.match(link);
  // Whichever reference comes first in the text wins.
  if (a && b) return a.index + a[0].length <= b.index + b[0].length ? Number(a[1]) : Number(b[1]);
  if (a) return Number(a[1]);
  if (b) return Number(b[1]);
  return null;
}

// Rule 4: extra title endings, removed on top of the tracker's own.
const EXTRA_TITLE_SUFFIX =
  /\s*(?:["']\s*)?(?:[-—]\s*branch\s+([\w.]+)|\(\s*([\w.]+)\s+port\s*\))\s*$/i;

function normalizeTitleExtended(title) {
  return normalizeTitleForBackportMatch(String(title || '').replace(EXTRA_TITLE_SUFFIX, ''));
}

/** The branch named by a "— branch X" / "- branch X" title ending, or null. */
function branchTitleSuffix(title) {
  const m = String(title || '').match(/[-—]\s*branch\s+([\w.]+)\s*$/i);
  return m ? m[1] : null;
}

/** Text without HTML comments (PR templates put example "#" text in them). */
function withoutComments(text) {
  return String(text || '').replace(/<!--[\s\S]*?-->/g, ' ');
}

/** Rule 4b: the first same-repo PR the body links to, in any wording. */
function firstSameRepoReference(text, repo) {
  const clean = withoutComments(text);
  const bare = clean.match(/(?<![\w/])#(\d+)/);
  const link = clean.match(
    new RegExp(String.raw`github\.com/${escapeRegExp(repo)}/pull/(\d+)`, 'i')
  );
  if (bare && link) return bare.index <= link.index ? Number(bare[1]) : Number(link[1]);
  if (bare) return Number(bare[1]);
  if (link) return Number(link[1]);
  return null;
}

/** Rule 5: a link to a PR in the OTHER Mautic docs repo, after backport words. */
function otherDocsRepoReference(text, repo) {
  const own = String(repo || '').toLowerCase();
  if (!TRACKER_REPOS.includes(own)) return null;
  const others = TRACKER_REPOS.filter((r) => r !== own)
    .map(escapeRegExp)
    .join('|');
  const m = String(text || '').match(
    new RegExp(
      String.raw`\b(?:${TRACKER_WORDS})\b${SAME_SENTENCE}github\.com/(${others})/pull/(\d+)`,
      'i'
    )
  );
  return m ? { repo: m[1].toLowerCase(), number: Number(m[2]) } : null;
}

/**
 * Confirms a suggested parent: a real PR, not this one, on a different branch
 * (same repo) — or simply a real PR (the other docs repo). Returns the parent
 * as { repo, number, branch, merged } or null.
 */
async function confirmParent({ repo, number, parentRepo, parentNumber, getBase, getPull }) {
  if (!parentNumber) return null;
  const sameRepo = String(parentRepo).toLowerCase() === String(repo).toLowerCase();
  if (sameRepo && parentNumber === number) return null;
  const parent = await getPull(parentRepo, parentNumber);
  if (!parent || !parent.baseBranch) return null;
  if (sameRepo) {
    const mine = await getBase();
    if (!mine || parent.baseBranch === mine) return null;
  }
  return {
    repo: parentRepo,
    number: parentNumber,
    branch: parent.baseBranch,
    merged: parent.merged === true,
  };
}

/** Rule 1 — runs before the tracker's rules. */
async function findFirstReferenceParent({ repo, number, title, body, getBase, getPull }) {
  const text = `${title}\n${body || ''}`;
  const parentNumber = firstReferenceAfter(TRACKER_WORDS, text, repo);
  return confirmParent({ repo, number, parentRepo: repo, parentNumber, getBase, getPull });
}

/**
 * Rules 2, 4b, 3, 4 and 5, in that order (explicit references before title
 * matching) — tried only when the tracker's rules found nothing.
 */
async function findAdditionalParent({
  repo,
  number,
  title,
  body,
  author,
  createdAt,
  getBase,
  getPull,
  pool = [],
}) {
  const text = `${title}\n${body || ''}`;
  const confirm = (parentNumber, parentRepo = repo) =>
    confirmParent({ repo, number, parentRepo, parentNumber, getBase, getPull });
  const isDependabot = author === DEPENDABOT_LOGIN;

  // Rule 2 — a hand-made copy of a dependabot PR.
  const referenced = extractReferencedPRNumber(repo, text);
  if (referenced && referenced !== number) {
    let isBumpCopy =
      /bump.*[-—]\s*branch\s+[\w.]+\s*$/i.test(title || '') &&
      isDependencyBumpBackportTitle(
        String(title).replace(/["']\s*(?=[-—]\s*branch)/, ''),
        await getBase()
      );
    if (!isBumpCopy) {
      const target = await getPull(repo, referenced);
      isBumpCopy = Boolean(target && target.author === DEPENDABOT_LOGIN);
    }
    if (isBumpCopy) {
      const found = await confirm(referenced);
      if (found) return { ...found, rule: 2 };
    }
  }

  // Rule 4b — "— branch X" names this PR's own branch: its first same-repo link is the parent.
  const suffixBranch = branchTitleSuffix(title);
  if (suffixBranch && suffixBranch === (await getBase())) {
    const found = await confirm(firstSameRepoReference(body, repo));
    if (found) return { ...found, rule: '4b' };
  }

  // Rule 3 — "port / ports / ported / porting".
  if (!isDependabot) {
    const found = await confirm(firstReferenceAfter(String.raw`port(?:ed|s|ing)?`, text, repo));
    if (found) return { ...found, rule: 3 };
  }

  // Rule 4 — same title once the extra endings are removed. Same limits as the
  // tracker's title match: 12+ characters, an older PR, never a dependency bump.
  const normalized = normalizeTitleExtended(title);
  if (normalized.length >= 12 && createdAt && !isDependabot && !/\bbump\b/i.test(title || '')) {
    const mine = new Date(createdAt).getTime();
    const candidates = pool
      .filter(
        (p) =>
          String(p.repo).toLowerCase() === String(repo).toLowerCase() &&
          p.number !== number &&
          p.createdAt &&
          new Date(p.createdAt).getTime() < mine &&
          normalizeTitleExtended(p.title) === normalized
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    for (const p of candidates) {
      const found = await confirm(p.number);
      if (found) return { ...found, rule: 4 };
    }
  }

  // Rule 5 — the other Mautic docs repo.
  const other = otherDocsRepoReference(text, repo);
  if (other) {
    const found = await confirm(other.number, other.repo);
    if (found) return { ...found, rule: 5 };
  }

  return null;
}

module.exports = {
  ADDITIONS_VERSION,
  normalizeTitleExtended,
  findFirstReferenceParent,
  findAdditionalParent,
};
