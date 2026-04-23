module.exports = {
  /**
   * Repository & Organization Exclusion List
   * ----------------------------------------
   * The script uses .includes() and .toLowerCase() to match these strings.
   * HOW TO EXCLUDE:
   * 1. By Organization: Use the org name with a trailing slash.
   * Example: 'my-old-org/'
   * (This matches: 'my-old-org/repo-1', 'my-old-org/repo-2')
   * 2. By Specific Repository: Use the full 'org/repo' or 'user/repo' string.
   * Example: 'org-name/repo-name'
   * (This matches only that specific repository)
   * 3. By Partial String: Use any unique part of the name.
   * Example: 'sandbox'
   * (This matches: 'user/my-sandbox-project', 'sandbox-org/docs')
   * Note: This is case-insensitive. 'MY-ORG' is the same as 'my-org'.
   */
  excludedRepos: [
    'open-sauced/',
    'astro-partykit-starter',
    'career-lab-fall-2021',
    'podcast-transcripts',
  ],
};
