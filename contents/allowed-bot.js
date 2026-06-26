module.exports = {
  /**
   * Allowed Bots List
   * -----------------
   * By default, the Active Workbench excludes bots (Dependabot, Snyk, etc.) from being
   * treated as a "last actor" — their activity is grouped separately and never produces
   * a "Take Action" status or shows up in the "Last Interaction" column.
   *
   * List a bot's username here (matched case-insensitively with .includes(), same as
   * excludedRepos in repo-exclusions.js) to make an exception: that bot will be treated
   * like a human actor in the Active Workbench only — it can show up as the last actor,
   * drive "Take Action" / "Watching" status, and have its tasks excluded from the
   * "Bot request review" bucket.
   * Example: 'promptless' matches 'promptless[bot]' and 'promptless-for-oss[bot]'.
   *
   * Leave this empty if you want every bot excluded — this has no effect elsewhere.
   */
  allowedBot: ['promptless', 'promptless-for-oss'],
};
