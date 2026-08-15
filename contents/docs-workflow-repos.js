module.exports = {
  /**
   * Docs-Workflow Repositories
   * --------------------------
   * Some projects run a documentation workflow with housekeeping steps that
   * mean nothing anywhere else — a release milestone on every PR, a label that
   * marks a docs PR as waiting on its code PR. Prompting for those on a repo
   * that has never used them is pure noise, so each rule below is scoped to an
   * explicit list of repos.
   *
   * The scope is deliberately a list, never an inference: a PR that happens to
   * carry a milestone (or happens not to) says nothing about whether its
   * project expects one, so the presence of the field can't be used to decide
   * this. Same for labels.
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
   * Repos that mark a docs PR as waiting on its code PR with a label. Emits
   * "Add <pendingLabel> label" on DRAFT PRs that don't carry it yet — a draft
   * docs PR is, by definition, still pending something.
   *
   * The prompt is a live read of the PR's labels every build, not a stored
   * flag: add the label on GitHub and the chip is gone on the next run, with
   * nothing to clear by hand.
   */
  pendingLabelRepos: ['mautic/user-documentation', 'mautic/developer-documentation-new'],

  /** The label name those repos use. */
  pendingLabel: 'pending-pr-merge',
};
