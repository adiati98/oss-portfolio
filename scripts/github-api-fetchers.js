require('dotenv').config();

const axios = require('axios');

// Import configuration
const { GITHUB_USERNAME, BASE_URL } = require('./config');

/**
 * Fetches all contribution data from the GitHub API for a given year range.
 * This includes Pull Requests, Issues, Reviewed PRs, and Collaborations.
 * It handles pagination and API rate limiting.
 * @param {number} startYear The year to begin fetching contributions from.
 * @param {Set<string>} prCache A set of PR URLs that have already been processed to avoid redundant work.
 * @returns {Promise<{contributions: object, prCache: Set<string>}>} An object containing the fetched contributions and the updated cache.
 */
async function fetchContributions(startYear, prCache, persistentCommitCache) {
  // Ensure the GitHub token is available from the environment variables.
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set.');
  }

  // Create an Axios instance with base URL and authentication headers.
  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  // Initialize objects to store the fetched data and track seen URLs to prevent duplicates.
  const contributions = {
    pullRequests: [],
    issues: [],
    reviewedPrs: [],
    collaborations: [],
    coAuthoredPrs: [],
  };

  const seenUrls = {
    pullRequests: new Set(),
    issues: new Set(),
    reviewedPrs: new Set(),
    collaborations: new Set(),
    coAuthoredPrs: new Set(),
  };

  // Use the persistent commit cache if provided, otherwise start with an empty Map
  // This allows the cache to be updated and returned for persistence across runs
  const commitCache =
    persistentCommitCache instanceof Map ? new Map(persistentCommitCache) : new Map();
  const currentYear = new Date().getFullYear();

  /**
   * A helper function to fetch all pages for a given search query.
   * GitHub's search API is paginated, so this handles fetching all results.
   * It also includes logic to handle API rate limits by waiting for 60 seconds if a 403 error is received.
   * @param {string} query The GitHub search query string.
   * @returns {Promise<Array<object>>} An array of all results from the search.
   */
  async function getAllPages(query) {
    let results = [];
    let page = 1;
    while (true) {
      try {
        const response = await axiosInstance.get(
          `/search/issues?q=${query}&per_page=100&page=${page}`
        );
        results.push(...response.data.items);

        // Check for a 'next' page link in the headers.
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
        } else {
          break;
        }
        // Pause between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        // Handle rate limit errors (status code 403).
        if (err.response && err.response.status === 403) {
          console.log('Rate limit hit. Waiting for 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue; // Retry the same page after waiting.
        } else {
          throw err; // Re-throw other errors.
        }
      }
    }
    return results;
  }

  /**
   * Fetches the date of the user's first review on a given pull request.
   * @param {string} owner The repository owner.
   * @param {string} repo The repository name.
   * @param {number} prNumber The pull request number.
   * @param {string} username The username to filter by.
   * @returns {Promise<string|null>} The date of the user's first review, or null if none is found.
   */
  async function getPrMyFirstReviewDate(owner, repo, prNumber, username) {
    try {
      const response = await axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`);
      // Filter for reviews by the specified user and sort chronologically.
      const myReviews = response.data
        .filter((review) => review.user.login === username)
        .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
      // The first review in the sorted list is the user's first review.
      if (myReviews.length > 0) {
        return myReviews[0].submitted_at;
      }
      return null;
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 404)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetches the date of the user's first comment on an issue or PR.
   * @param {string} url The comments URL for the issue or PR.
   * @param {string} username The username to filter comments by.
   * @returns {Promise<string|null>} The date of the user's first comment, or null if none is found.
   */
  async function getFirstCommentDate(url, username) {
    try {
      let page = 1;
      while (true) {
        const response = await axiosInstance.get(`${url}?per_page=100&page=${page}`);
        const myFirstComment = response.data.find((comment) => comment.user.login === username);
        if (myFirstComment) {
          return myFirstComment.created_at;
        }
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
        } else {
          return null; // No more pages and no comment found.
        }
      }
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 404)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetches the date of the user's first commit on a given PR.
   * @param {string} owner The repository owner.
   * @param {string} repo The repository name.
   * @param {number} prNumber The pull request number.
   * @param {string} username The username to check for.
   * @returns {Promise<{firstCommitDate: string, commitCount: number}|null>} Details of the first commit, or null if none.
   */
  // Now accepts optional `prUpdatedAt` so cached results are re-used only when
  // the PR has not been updated since the cached check. This prevents stale
  // "no commits found" results from persisting after new commits are pushed.
  async function getFirstCommitDetails(
    owner,
    repo,
    prNumber,
    username,
    commitCache,
    prUpdatedAt = null
  ) {
    const prUrlKey = `/repos/${owner}/${repo}/pulls/${prNumber}`; // Use a consistent key for caching

    // 1. CHECK CACHE
    if (commitCache.has(prUrlKey)) {
      const cached = commitCache.get(prUrlKey);
      // Use cached only when it has a recorded prUpdatedAt that matches the
      // current PR updated time. This ensures we re-check commits when the PR
      // has changed (e.g. new commits were pushed).
      if (
        cached &&
        typeof cached === 'object' &&
        cached.prUpdatedAt &&
        prUpdatedAt &&
        cached.prUpdatedAt === prUpdatedAt
      ) {
        return cached;
      }
      // Otherwise fall through and re-fetch commits.
    }

    let result = null; // Initialize result to be cached

    try {
      // Paginate through commits for the PR (some PRs may have >100 commits).
      let page = 1;
      let allCommits = [];
      while (true) {
        const resp = await axiosInstance.get(`${prUrlKey}/commits?per_page=100&page=${page}`);
        allCommits.push(...resp.data);

        const linkHeader = resp.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
          // small delay to be polite to API
          await new Promise((r) => setTimeout(r, 200));
        } else {
          break;
        }
      }

      let commitCount = 0;
      let earliestCommitDate = null;

      // Helper to determine whether a commit should be attributed to the username.
      function isCommitByUser(c) {
        try {
          // 1. Check for explicit GitHub login match (most reliable).
          if (c.author && c.author.login === username) return true;

          // Safely extract and normalize the commit author's email.
          const authorEmail = c.commit?.author?.email?.toLowerCase();
          // Skip if email metadata is missing.
          if (!authorEmail) return false;

          const lowerUsername = username.toLowerCase();

          // --- Email Attribution Checks ---

          // 2. Check for standard GitHub noreply format (ID+username@users.noreply.github.com).
          // This catches local commits made using the user's private GitHub email.
          if (
            authorEmail.endsWith('@users.noreply.github.com') &&
            authorEmail.includes(`+${lowerUsername}@`)
          ) {
            return true;
          }

          // 3. Check for legacy GitHub noreply format (username@users.noreply.github.com).
          if (authorEmail === `${lowerUsername}@users.noreply.github.com`) {
            return true;
          }

          // 4. Fallback: Check if the commit email contains the username.
          if (authorEmail.includes(lowerUsername)) {
            return true;
          }

          // 5. Fallback: Check if the commit author name contains the username (less reliable).
          if (c.commit?.author?.name && c.commit.author.name.toLowerCase().includes(lowerUsername))
            return true;

          // 6. Check for Co-authored-by trailer in the commit message.
          if (
            c.commit?.message &&
            /Co-authored-by:/i.test(c.commit.message) &&
            c.commit.message.toLowerCase().includes(lowerUsername)
          )
            return true;
        } catch (e) {
          // Ignore unexpected errors (e.g., malformed commit object) and default to false.
          return false;
        }
        return false;
      }

      // Filter commits that match the user by any of the heuristics above
      const userCommits = allCommits.filter(isCommitByUser);

      if (userCommits.length > 0) {
        commitCount = userCommits.length;
        // Sort chronologically to find the earliest date
        userCommits.sort((a, b) => new Date(a.commit.author.date) - new Date(b.commit.author.date));
        earliestCommitDate = userCommits[0].commit.author.date;

        result = {
          firstCommitDate: earliestCommitDate,
          commitCount: commitCount,
          prUpdatedAt,
        };
      } else {
        // If no commits were found, cache an explicit object so we can still
        // record the PR's updated timestamp and re-check later if the PR
        // changes.
        result = {
          firstCommitDate: null,
          commitCount: 0,
          prUpdatedAt,
        };
      }
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 404)) {
        // Treat API error/not found as null result for caching
        result = null;
      } else {
        throw err;
      }
    }

    // 2. WRITE CACHE & RETURN
    commitCache.set(prUrlKey, result);
    return result;
  }

  // Loop through each year from the start year to the current year.
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`Fetching contributions for year: ${year}...`);
    // Define the start and end dates for the year to use in API queries.
    const yearStart = `${year}-01-01T00:00:00Z`;
    const yearEnd = `${year + 1}-01-01T00:00:00Z`;

    // --- Fetch PRs authored by the user and merged in the given year ---
    const prs = await getAllPages(
      `is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd}`
    );

    for (const pr of prs) {
      // 1. Check if the PR is already in the long-term cache (`prCache`).
      if (prCache.has(pr.html_url)) {
        continue; // If it's cached, skip to the next PR.
      }

      // Extract repository owner.
      const repoParts = new URL(pr.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      // 2. Check if the PR is from your own repo (self-PRs are typically excluded).
      if (owner === GITHUB_USERNAME) {
        // Log and add to the persistent cache to skip it next time.
        prCache.add(pr.html_url);
        continue;
      }

      // 3. For an external PR, add it to the persistent cache to prevent re-processing in subsequent runs.
      prCache.add(pr.html_url);

      // 4. Check the temporary, in-run cache (`seenUrls`) to avoid processing the same PR twice within this run.
      if (seenUrls.pullRequests.has(pr.html_url)) {
        continue;
      }

      // 5. Process the PR and add it to the final contributions list.
      contributions.pullRequests.push({
        title: pr.title,
        url: pr.html_url,
        repo: `${owner}/${repoName}`,
        date: pr.pull_request.merged_at, // 'date' is used for quarterly grouping, which must be the merge date.
        mergedAt: pr.pull_request.merged_at,
        createdAt: pr.created_at,
        reviewPeriod: Math.round(
          (new Date(pr.pull_request.merged_at) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)
        ),
      });
      // Add the URL to the seen set for this run.
      seenUrls.pullRequests.add(pr.html_url);
    }

    // --- Fetch Issues authored by the user on other people's repositories ---
    const issues = await getAllPages(
      `is:issue author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME} created:>=${yearStart} created:<${yearEnd}`
    );
    for (const issue of issues) {
      if (seenUrls.issues.has(issue.html_url)) {
        continue;
      }
      const repoParts = new URL(issue.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      const closingPeriod =
        issue.state === 'closed'
          ? Math.round(
              (new Date(issue.closed_at) - new Date(issue.created_at)) / (1000 * 60 * 60 * 24)
            )
          : 'Open';

      contributions.issues.push({
        title: issue.title,
        url: issue.html_url,
        repo: `${owner}/${repoName}`,
        date: issue.created_at,
        closedAt: issue.closed_at,
        closingPeriod,
      });
      seenUrls.issues.add(issue.html_url);
    }

    // --- Fetch Reviewed PRs (PRs reviewed, merged, or closed by the user) ---
    // Note: The GitHub search API doesn't support multiple 'closed-by' or 'merged-by' filters,
    // so we combine multiple queries and deduplicate the results.
    const reviewedByPrs = await getAllPages(
      `is:pr reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
    );
    const mergedByPrs = await getAllPages(
      `is:pr merged-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
    );
    const closedByPrs = await getAllPages(
      `is:pr is:closed -author:${GITHUB_USERNAME} closed-by:${GITHUB_USERNAME} commenter:${GITHUB_USERNAME} closed:>=${yearStart} closed:<${yearEnd}`
    );

    const combinedResults = [...reviewedByPrs, ...mergedByPrs, ...closedByPrs];
    const uniqueReviewedPrs = new Set();

    for (const pr of combinedResults) {
      // 1. Initial Checks (Skip Private, Bot, Deduplicate)
      if (pr.private) {
        console.log(`Skipping private repository PR: ${pr.html_url}`);
        prCache.add(pr.html_url);
        continue; // Skip to the next PR
      }

      if (pr.user && pr.user.type === 'Bot') {
        prCache.add(pr.html_url);
        continue;
      }

      // --- 2. Variable Declaration (MUST be 'let' and inside the loop for correct scoping) ---
      let owner = null;
      let repoName = null;
      const prNumber = pr.number; // pr.number is reliably available

      // --- 3. Repository URL Parsing and Owner Check ---
      try {
        const repoParts = new URL(pr.repository_url).pathname.split('/');
        owner = repoParts[repoParts.length - 2];
        repoName = repoParts[repoParts.length - 1];

        // Skip PRs that belong to the user's own repositories.
        if (owner === GITHUB_USERNAME) {
          prCache.add(pr.html_url);
          continue;
        }
      } catch (e) {
        // If URL parsing fails, we must skip the PR since we can't make API calls.
        console.warn(`Skipping PR due to repository URL parsing failure: ${pr.html_url}`);
        prCache.add(pr.html_url);
        continue; // Skip to the next PR
      }

      // --- 4. Date Check ---
      const prDate = new Date(pr.updated_at);
      const yearStartDate = new Date(yearStart);
      const yearEndDate = new Date(yearEnd);

      if (prDate >= yearStartDate && prDate < yearEndDate) {
        // --- 5. MergedAt Logic ---
        let mergedAt = null;
        let mergePeriod = 'Open';

        // Check if the PR is merged and fetch the merged_at date.
        if (pr.pull_request && pr.pull_request.merged_at) {
          mergedAt = pr.pull_request.merged_at;
          mergePeriod =
            Math.round((new Date(mergedAt) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)) +
            ' days';
        } else if (pr.state === 'closed' && pr.merged_at) {
          // Fallback if the search result itself has the merged_at property (for merged PRs).
          mergedAt = pr.merged_at;
          mergePeriod =
            Math.round((new Date(mergedAt) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)) +
            ' days';
        } else if (pr.state === 'closed') {
          mergePeriod = 'Closed';
        }

        // --- 6. Check Co-Authored PRs ---
        // Check for commits regardless of whether it's a reviewed PR or not. This detects PRs
        // where the user contributed code but wasn't the author/primary reviewer, and adds them to a separate category.
        const commitDetails = await getFirstCommitDetails(
          owner,
          repoName,
          prNumber,
          GITHUB_USERNAME,
          commitCache,
          pr.updated_at
        );

        // Process co-authored PR details only if a first commit was found
        if (commitDetails && commitDetails.firstCommitDate) {
          // Calculate first commit period
          // Add a defensive check to ensure both dates exist and are valid
          const firstCommitPeriod =
            commitDetails.firstCommitDate && pr.created_at
              ? Math.round(
                  (new Date(commitDetails.firstCommitDate) - new Date(pr.created_at)) /
                    (1000 * 60 * 60 * 24)
                ) +
                (Math.round(
                  (new Date(commitDetails.firstCommitDate) - new Date(pr.created_at)) /
                    (1000 * 60 * 60 * 24)
                ) === 0
                  ? ' day'
                  : ' days')
              : 'N/A';

          // Use first commit date as the date for consistent ordering with PR timeline
          const contributionDate = commitDetails.firstCommitDate || pr.updated_at;
          contributions.coAuthoredPrs.push({
            title: pr.title,
            url: pr.html_url,
            repo: `${owner}/${repoName}`,
            date: contributionDate,
            createdAt: pr.created_at,
            firstCommitDate: commitDetails.firstCommitDate,
            firstCommitPeriod: firstCommitPeriod,
            commitCount: commitDetails.commitCount,
            mergedAt: mergedAt,
            state: pr.state,
          });
        }

        // --- 7. Reviewed PRs Logic ---
        // Process review information independent of commit status
        const myFirstReviewDate = await getPrMyFirstReviewDate(
          owner,
          repoName,
          prNumber,
          GITHUB_USERNAME
        );

        // Add to reviewedPrs if there's a review, regardless of commit status
        if (myFirstReviewDate) {
          let myFirstReviewPeriod =
            Math.round(
              (new Date(myFirstReviewDate) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)
            ) + ' days';

          if (!uniqueReviewedPrs.has(pr.html_url)) {
            contributions.reviewedPrs.push({
              title: pr.title,
              url: pr.html_url,
              repo: `${owner}/${repoName}`,
              date: pr.updated_at,
              createdAt: pr.created_at,
              mergedAt,
              mergePeriod,
              myFirstReviewDate,
              myFirstReviewPeriod,
              state: pr.state,
            });
            uniqueReviewedPrs.add(pr.html_url);
          }
        }
      }
    }

    // --- Fetch Collaborations (PRs/Issues commented on by the user) ---
    const collaborationsPrs = await getAllPages(
      `is:pr commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -reviewed-by:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
    );
    const collaborationsIssues = await getAllPages(
      `is:issue commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
    );

    const allCollaborations = [...collaborationsPrs, ...collaborationsIssues];

    for (const item of allCollaborations) {
      // --- 1. Variable Extraction ---
      const repoParts = new URL(item.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      // Skip collaborations that have already been reviewed (covered by uniqueReviewedPrs)
      // or already processed in this loop (covered by seenUrls.collaborations) or are in your own repos.
      if (seenUrls.collaborations.has(item.html_url) || uniqueReviewedPrs.has(item.html_url)) {
        continue;
      }

      // Skip collaborations that are in the user's own repositories.
      if (owner === GITHUB_USERNAME) {
        prCache.add(item.html_url);
        continue;
      }

      // --- 2. Check for commits on PRs (Co-Authored PRs) ---
      // This is a re-check for co-authored commits on *all* collaborations (PRs only),
      // ensuring that co-authored PRs that weren't reviewed are still caught.
      if (item.pull_request) {
        // Only PRs have 'commits' endpoint
        const commitDetails = await getFirstCommitDetails(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME,
          commitCache,
          item.updated_at
        );

        if (commitDetails && commitDetails.firstCommitDate) {
          // If my commits exist, add it to the new category. Use the
          // first commit date for grouping, falling back to the PR's
          // updated_at when necessary.
          let mergedAt = null;
          if (item.pull_request && item.pull_request.merged_at) {
            mergedAt = item.pull_request.merged_at;
          }

          const contributionDate = commitDetails.firstCommitDate || item.updated_at;

          // Note: If an item is co-authored, it is added to coAuthoredPrs here.
          // It will also be added to 'collaborations' below if a comment exists,
          // resulting in an intentional overlap in categories for combined code/comment contributions.
          contributions.coAuthoredPrs.push({
            title: item.title,
            url: item.html_url,
            repo: `${owner}/${repoName}`,
            date: contributionDate,
            createdAt: item.created_at,
            firstCommitDate: commitDetails.firstCommitDate,
            commitCount: commitDetails.commitCount,
            mergedAt: mergedAt,
            state: item.state,
          });
        }
      }

      // --- 3. Collaborations Logic (Tracks first *comment* on issues/PRs not covered by reviews) ---
      const firstCommentDate = await getFirstCommentDate(item.comments_url, GITHUB_USERNAME);

      contributions.collaborations.push({
        title: item.title,
        url: item.html_url,
        repo: `${owner}/${repoName}`,
        date: firstCommentDate,
        createdAt: item.created_at,
        firstCommentedAt: firstCommentDate,
      });
      seenUrls.collaborations.add(item.html_url);
    }
  }

  return { contributions, prCache, commitCache };
}

module.exports = {
  fetchContributions,
};
