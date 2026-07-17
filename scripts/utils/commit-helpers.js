/**
 * SHARED: strict "is this commit the user's own authored work?" test.
 *
 * Used by BOTH the historical crawler and the Active Workbench so the two share
 * one set of matching rules. Historically these lived as two slightly different
 * inline copies, which is how a PR the user only commented on slipped into the
 * co-authored bucket: a commit that was never really theirs matched a loose
 * substring rule, and once the branch was force-pushed the evidence vanished,
 * leaving an entry nothing could disprove.
 *
 * Strictness is the whole point. Co-authored is the only contribution category
 * whose evidence — a commit in the PR branch — can later be erased by a
 * force-push, squash, or rebase, so a false positive here is uniquely damaging.
 * We therefore only count a commit when authorship is *positively* the user's:
 * GitHub resolved the account, an unambiguous `noreply` e-mail, or a real
 * `Co-authored-by:` trailer line — never a loose substring of an email or name.
 *
 * @param {object} commit    A GitHub commit object from the `/commits` endpoint.
 * @param {string} username  The tracked GitHub login (e.g. `adiati98`).
 * @param {object} [opts]
 * @param {string|null} [opts.prCreatedAt]  When set, commits authored before the
 *   PR was opened are ignored — stale commits inherited from a wrong or rebased
 *   base branch, not work done on this PR.
 * @param {boolean} [opts.excludeWebFlow=false]  When true, commits committed
 *   through the GitHub web UI (`web-flow`: applied review suggestions, edits made
 *   on github.com) are not counted. The Active Workbench sets this — for the
 *   "what's an active authoring task" view, applying a reviewer's suggestion is
 *   reviewing, not authoring. The historical record leaves it false, so a genuine
 *   edit the user made through the web UI still counts as their contribution.
 * @returns {boolean}
 */
function isCommitByUser(commit, username, { prCreatedAt = null, excludeWebFlow = false } = {}) {
  try {
    const lowerUsername = String(username || '').toLowerCase();
    if (!lowerUsername) return false;

    const commitAuthorDate = commit?.commit?.author?.date;
    // Ignore stale commits inherited from a wrong/rebased base branch.
    if (prCreatedAt && commitAuthorDate && new Date(commitAuthorDate) < new Date(prCreatedAt)) {
      return false;
    }

    const message = commit?.commit?.message || '';

    // Merge commits are plumbing, never authored content — always ignored.
    if (/^Merge (branch|remote-tracking|pull request)\b/i.test(message)) return false;

    // Optional: ignore GitHub web-UI commits (see opts.excludeWebFlow).
    if (excludeWebFlow) {
      if (commit?.committer?.login === 'web-flow') return false;
      if (/^Apply suggestions from code review\b/i.test(message)) return false;
    }

    // 1. Authoritative: GitHub resolved this commit's author to the user's
    //    account. Catches the common case, including commits made under a
    //    personal email GitHub has linked to the account.
    if (commit?.author?.login && commit.author.login.toLowerCase() === lowerUsername) return true;

    // 2. GitHub `noreply` email forms, which encode the login unambiguously:
    //      <login>@users.noreply.github.com
    //      <id>+<login>@users.noreply.github.com
    const authorEmail = (commit?.commit?.author?.email || '').toLowerCase();
    if (authorEmail === `${lowerUsername}@users.noreply.github.com`) return true;
    if (
      authorEmail.endsWith('@users.noreply.github.com') &&
      authorEmail.includes(`+${lowerUsername}@`)
    ) {
      return true;
    }

    // 3. A real `Co-authored-by:` trailer line that names the user. We require an
    //    actual trailer line rather than the login merely appearing somewhere in
    //    the message body, so an unrelated mention (a "Reported-by", a link, a
    //    quoted comment) can never promote a PR to "co-authored".
    const namesUserInTrailer = message.split(/\r?\n/).some((line) => {
      const l = line.trim().toLowerCase();
      return l.startsWith('co-authored-by:') && l.includes(lowerUsername);
    });
    if (namesUserInTrailer) return true;

    return false;
  } catch (e) {
    return false;
  }
}

module.exports = { isCommitByUser };
