/**
 * BACKPORT RULES — oss-portfolio additions
 *
 * backport-rules.js is an exact copy of the Mautic docs PR tracker's rules.
 * Checked against every PR in the two Mautic docs repos, those rules miss
 * backports written in other ways. The rule below catches one that remains.
 * It is oss-portfolio's own, NOT the tracker's — it lives in this separate
 * file so the copy in backport-rules.js stays exact, and so the change alert
 * (tracker-rules-watch.js) keeps watching only the tracker. If the tracker
 * later covers this itself, delete it here.
 *
 * HISTORY — as of the tracker's commit 92436323 ("Fix: backport and
 * cherry-pick detection edge cases"), five of oss-portfolio's six earlier
 * additions are now covered by the tracker's own rules directly:
 *   - the "first #N, not the last" fix (extractBackportParentNumber is lazy
 *     now)
 *   - recording a hand-made dependency-bump copy's parent
 *     (resolveManualDependencyBackport)
 *   - the bare word "port" alongside "backport"/"cherry-pick"
 *     (includePortAlone)
 *   - "— branch X" / "- branch X" / "(X port)" title endings
 *     (BACKPORT_TITLE_SUFFIX_PATTERN)
 *   - a "— branch X" title trusting the first same-repo "#N" the body names,
 *     any wording (findBackportParent's signal 1b)
 * They were removed from this file. See backport-rules.test.js for the real
 * PRs that prove each one now passes through the tracker's own rules alone.
 *
 * STILL NEEDED — a link to a PR in the SISTER docs repo (e.g. a cherry-pick
 * from user-documentation referenced inside developer-documentation-new).
 * The tracker's own extractBackportParentNumber can find this too (it checks
 * both docs repos), but only when nothing else matches first: a same-repo
 * bare "#N" appearing anywhere near backport wording wins outright, even
 * when that number turns out not to exist, and the function never falls back
 * to the sister-repo link once that has happened. A real PR does exactly
 * this — its title says "Cherry pick PR #842 ... from user docs ... branch
 * 7.2", so the bare "#842" (read as this repo's own #842, which doesn't
 * exist) blocks the tracker's own rule from ever trying the body's explicit
 * link to the real #842 in the other repo. This rule tries that link
 * directly, without the same-repo bare number getting in the way first.
 */
const { TRACKER_REPOS, escapeRegExp } = require('./backport-rules');

/**
 * Bump this whenever the rule below changes. It is stored with every cached
 * verdict (next to the tracker commit), so the next run judges every PR again.
 */
const ADDITIONS_VERSION = 'additions-2';

// The same sentence limit and backport words as the tracker.
const SENTENCE_BREAK = String.raw`\.\s+[A-Z]`;
const SAME_SENTENCE = String.raw`(?:(?!${SENTENCE_BREAK}|\n).){0,150}?`;
const TRACKER_WORDS = String.raw`back(?:[\s/-]+(?:and[\s/-]+)?forward)?[\s/-]?port(?:ed|s|ing)?|forward[\s/-]?port(?:ed|s|ing)?|cherry[-\s]?pick(?:ed|s|ing)?`;

/** A link to a PR in the OTHER Mautic docs repo, after backport words. */
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
 * Confirms a suggested sister-repo parent: it must be a real PR. There's no
 * shared branch to compare against a PR in a different repo, so being in
 * that other repo is confirmation enough — same as the tracker's own rule.
 */
async function confirmParent({ repo, number, parentRepo, parentNumber, getPull }) {
  if (!parentNumber) return null;
  if (String(parentRepo).toLowerCase() === String(repo).toLowerCase() && parentNumber === number) {
    return null;
  }
  const parent = await getPull(parentRepo, parentNumber);
  if (!parent || !parent.baseBranch) return null;
  return {
    repo: parentRepo,
    number: parentNumber,
    branch: parent.baseBranch,
    merged: parent.merged === true,
  };
}

/** Tried only when the tracker's own rules found nothing. */
async function findAdditionalParent({ repo, number, title, body, getPull }) {
  const text = `${title}\n${body || ''}`;
  const other = otherDocsRepoReference(text, repo);
  if (!other) return null;
  const found = await confirmParent({
    repo,
    number,
    parentRepo: other.repo,
    parentNumber: other.number,
    getPull,
  });
  return found ? { ...found, rule: 5 } : null;
}

module.exports = {
  ADDITIONS_VERSION,
  findAdditionalParent,
};
