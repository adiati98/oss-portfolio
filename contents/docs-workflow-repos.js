module.exports = {
  /**
   * Docs-Workflow Repositories
   * --------------------------
   * Some projects run a documentation workflow with housekeeping steps that
   * mean nothing anywhere else — a release milestone on every PR, for
   * instance. Prompting for those on a repo that has never used them is pure
   * noise, so each repo-scoped rule below is scoped to an explicit list of
   * repos.
   *
   * The scope is deliberately a list, never an inference: a PR that happens to
   * carry a milestone (or happens not to) says nothing about whether its
   * project expects one, so the presence of the field can't be used to decide
   * this.
   *
   * Matching follows the same convention as excludedRepos in
   * repo-exclusions.js and allowedBot in allowed-bot.js — case-insensitive
   * .includes(), so:
   *   'mautic/'                    matches every repo in the mautic org
   *   'mautic/user-documentation'  matches only that repository
   *
   * Leave a list empty to switch that rule off entirely.
   */

  /** Repos whose release process runs on milestones. Emits "Add milestone". */
  milestoneRepos: ['mautic/user-documentation', 'mautic/developer-documentation-new'],

  /**
   * NOT repo-scoped, unlike the list above it.
   *
   * GitHub reports `mergeable_state: blocked` when a PR's branch protection
   * requirements aren't satisfied — required reviews missing, required checks
   * failing or still running. Nobody can merge such a PR yet, whatever repo it
   * lives in, so there is no repo list to scope this to.
   *
   * The row states that reason in words. It is configured here rather than
   * written into a renderer because the wording is a judgement about what the
   * state means to a reader, and both generators must say the same thing.
   *
   * Blank it out to switch the reason (and with it the rule) off entirely.
   */
  mergeBlockedReason: 'required checks or reviews not met',
};
