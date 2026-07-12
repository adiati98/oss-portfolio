require('dotenv').config();
const axios = require('axios');

// Import configuration
const { GITHUB_USERNAME, BASE_URL } = require('../config/config');
const { attachRateLimitLogger, withRateLimitRetry } = require('../utils/http-helpers');

/**
 * Fetches the year the user joined GitHub to set the baseline for discovery.
 */
async function getGitHubJoinYear(axiosInstance) {
  try {
    const response = await axiosInstance.get(`/users/${GITHUB_USERNAME}`);
    const joinDate = new Date(response.data.created_at);
    return joinDate.getFullYear();
  } catch (err) {
    console.error('❌ Error discovering GitHub join date, defaulting to 2020:', err.message);
    return 2020;
  }
}

/**
 * Fetches all contribution data from the GitHub API for a given year range.
 */
async function fetchContributions(
  requestedStartYear,
  prCache,
  persistentCommitCache,
  failedFetchCache
) {
  // Ensure the GitHub token is available from the environment variables.
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set.');
  }

  // Create an Axios instance with base URL and authentication headers.
  const axiosInstance = attachRateLimitLogger(
    axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
  );

  // --- AUTO-DISCOVERY LOGIC ---
  let startYear = requestedStartYear;
  if (!startYear) {
    console.log(`🔍 No start year provided. Discovering first year for ${GITHUB_USERNAME}...`);
    startYear = await getGitHubJoinYear(axiosInstance);
  }

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

  // Mutate the caller's map directly (not a clone) so that if this function
  // throws partway through the year loop, whatever commits it already
  // fetched are still visible to the caller and can be persisted instead of
  // thrown away.
  const commitCache = persistentCommitCache instanceof Map ? persistentCommitCache : new Map();
  const currentYear = new Date().getFullYear();

  // Same in-place-mutation approach as commitCache above: the caller's map,
  // not a clone, so a permanent-failure record survives even a mid-run throw
  // and persists across runs — a PR that's confirmed permanently 403 (e.g.
  // an org needing SSO authorization we don't have) gets skipped on future
  // daily runs instead of re-attempted, until the monthly full sync wipes it.
  const permanentFailures = failedFetchCache instanceof Map ? failedFetchCache : new Map();

  /**
   * Records a PR/issue as permanently un-fetchable (confirmed non-rate-limit
   * 403 — see withRateLimitRetry). In-memory only; the caller persists this
   * once for the whole run instead of writing to disk on every failure.
   */
  function logPermanent403(url, logState = { hasLogged: false }, year, title) {
    if (logState.hasLogged || permanentFailures.has(url)) return;
    console.log(`Skipping 403 (non-retryable): ${url}`);
    const timestamp = year ? `${year}-01-01T12:00:00Z` : new Date().toISOString();
    permanentFailures.set(url, {
      status: '403 Forbidden',
      timestamp,
      title: title || 'Unknown Title',
    });
    logState.hasLogged = true;
  }

  // GitHub's search API allows only 30 requests/minute — the year loop below
  // fires 7 distinct search queries per year with nothing in between, which
  // alone exceeds that after just a few years. This tracks the last search
  // call process-wide (not just between pages of one query) so every call
  // waits out a minimum gap first, instead of only pacing within a single
  // query's own pagination.
  let lastSearchCallAt = 0;
  const MIN_SEARCH_INTERVAL_MS = 2000;

  /**
   * A helper function to fetch all pages for a given search query.
   */
  async function getAllPages(query) {
    let results = [];
    let page = 1;
    while (true) {
      const wait = MIN_SEARCH_INTERVAL_MS - (Date.now() - lastSearchCallAt);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      lastSearchCallAt = Date.now();

      const response = await withRateLimitRetry(
        () => axiosInstance.get(`/search/issues?q=${query}&per_page=100&page=${page}`),
        { label: `search p${page}`, assumeRateLimit: true }
      );
      results.push(...response.data.items);

      const linkHeader = response.headers.link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        page++;
      } else {
        break;
      }
    }
    return results;
  }

  /**
   * Fetches the date of the user's first review on a given pull request.
   */
  async function getPrMyFirstReviewDate(owner, repo, prNumber, username, logState, year, title) {
    const url = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
    if (permanentFailures.has(url)) return null;
    try {
      const response = await withRateLimitRetry(
        () => axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`),
        { label: `reviews#${prNumber}` }
      );
      const myReviews = response.data
        .filter((review) => review.user?.login === username)
        .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
      if (myReviews.length > 0) {
        return myReviews[0].submitted_at;
      }
      return null;
    } catch (err) {
      if (err.isPermanent403) {
        logPermanent403(url, logState, year, title);
        return null;
      }
      if (err.response && err.response.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetches the date of the user's first comment on an issue or PR.
   */
  async function getFirstCommentDate(url, username, logState, year, title) {
    if (permanentFailures.has(url)) return null;
    try {
      let page = 1;
      while (true) {
        const response = await withRateLimitRetry(
          () => axiosInstance.get(`${url}?per_page=100&page=${page}`),
          { label: `comments p${page}` }
        );
        const myFirstComment = response.data.find((comment) => comment.user?.login === username);
        if (myFirstComment) {
          return myFirstComment.created_at;
        }
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
        } else {
          return null;
        }
      }
    } catch (err) {
      if (err.isPermanent403) {
        logPermanent403(url, logState, year, title);
        return null;
      }
      if (err.response && err.response.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetches the date of the user's first commit on a given PR.
   */
  async function getFirstCommitDetails(
    owner,
    repo,
    prNumber,
    username,
    commitCache,
    prUpdatedAt = null,
    logState,
    year,
    title,
    prCreatedAt = null
  ) {
    const prUrlKey = `/repos/${owner}/${repo}/pulls/${prNumber}`;
    const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;

    if (permanentFailures.has(prUrl)) {
      return { firstCommitDate: null, commitCount: 0, prUpdatedAt, fetchFailed: true };
    }

    if (commitCache.has(prUrlKey)) {
      const cached = commitCache.get(prUrlKey);
      if (
        cached &&
        typeof cached === 'object' &&
        cached.prUpdatedAt &&
        prUpdatedAt &&
        cached.prUpdatedAt === prUpdatedAt
      ) {
        return cached;
      }
    }

    let result = null;

    try {
      let page = 1;
      let allCommits = [];
      while (true) {
        const resp = await withRateLimitRetry(
          () => axiosInstance.get(`${prUrlKey}/commits?per_page=100&page=${page}`),
          { label: `commits#${prNumber} p${page}` }
        );
        allCommits.push(...resp.data);

        const linkHeader = resp.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
          await new Promise((r) => setTimeout(r, 200));
        } else {
          break;
        }
      }

      function isCommitByUser(c) {
        try {
          // --- Ignore stale historical commits from wrong base branches ---
          if (prCreatedAt && new Date(c.commit?.author?.date) < new Date(prCreatedAt)) {
            return false;
          }

          const lowerUsername = username.toLowerCase();
          const commitMessage = c.commit?.message || '';
          const isBranchUpdate = /^Merge branch '.+' into .+/i.test(commitMessage);
          if (isBranchUpdate) return false;
          if (c.author?.login === username) return true;
          const authorEmail = c.commit?.author?.email?.toLowerCase();
          if (authorEmail) {
            if (
              authorEmail.endsWith('@users.noreply.github.com') &&
              authorEmail.includes(`+${lowerUsername}@`)
            )
              return true;
            if (authorEmail === `${lowerUsername}@users.noreply.github.com`) return true;
            if (authorEmail.includes(lowerUsername)) return true;
          }
          if (c.commit?.author?.name && c.commit.author.name.toLowerCase().includes(lowerUsername))
            return true;
          if (
            /Co-authored-by:/i.test(commitMessage) &&
            commitMessage.toLowerCase().includes(lowerUsername)
          )
            return true;
        } catch (e) {
          return false;
        }
        return false;
      }

      const userCommits = allCommits.filter(isCommitByUser);

      if (userCommits.length > 0) {
        userCommits.sort((a, b) => new Date(a.commit.author.date) - new Date(b.commit.author.date));
        result = {
          firstCommitDate: userCommits[0].commit.author.date,
          commitCount: userCommits.length,
          prUpdatedAt,
        };
      } else {
        result = { firstCommitDate: null, commitCount: 0, prUpdatedAt };
      }
    } catch (err) {
      // A confirmed permanent 403 is worth remembering so we don't retry it
      // every day. Either way, we couldn't verify commit authorship — mark
      // it as unknown rather than a confirmed "no", so callers don't drop a
      // PR just because we couldn't check it this run.
      if (err.isPermanent403) {
        logPermanent403(prUrl, logState, year, title);
      }
      result = { firstCommitDate: null, commitCount: 0, prUpdatedAt, fetchFailed: true };
    }

    commitCache.set(prUrlKey, result);
    return result;
  }

  for (let year = startYear; year <= currentYear; year++) {
    console.log(`Fetching contributions for year: ${year}...`);

    const yearStart = `${year}-01-01T00:00:00Z`;
    const yearEnd = `${year + 1}-01-01T00:00:00Z`;

    // Pull Requests
    const prs = await getAllPages(
      `is:pr author:${GITHUB_USERNAME} is:merged merged:${yearStart}..${yearEnd}`
    );

    for (const pr of prs) {
      if (prCache.has(pr.html_url)) continue;

      const repoParts = new URL(pr.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      if (owner === GITHUB_USERNAME) {
        prCache.add(pr.html_url);
        continue;
      }

      prCache.add(pr.html_url);
      if (seenUrls.pullRequests.has(pr.html_url)) continue;

      contributions.pullRequests.push({
        title: pr.title,
        url: pr.html_url,
        repo: `${owner}/${repoName}`,
        date: pr.pull_request.merged_at,
        mergedAt: pr.pull_request.merged_at,
        createdAt: pr.created_at,
        reviewPeriod: Math.round(
          (new Date(pr.pull_request.merged_at) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)
        ),
      });
      seenUrls.pullRequests.add(pr.html_url);
    }

    // Issues
    const issues = await getAllPages(
      `is:issue author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME} created:${yearStart}..${yearEnd}`
    );
    for (const issue of issues) {
      if (seenUrls.issues.has(issue.html_url)) continue;
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

    // Reviewed PRs
    const reviewedByPrs = await getAllPages(
      `is:pr reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:${yearStart}..${yearEnd}`
    );
    const mergedByPrs = await getAllPages(
      `is:pr merged-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:${yearStart}..${yearEnd}`
    );
    const closedByPrs = await getAllPages(
      `is:pr is:closed -author:${GITHUB_USERNAME} closed-by:${GITHUB_USERNAME} commenter:${GITHUB_USERNAME} closed:${yearStart}..${yearEnd}`
    );

    const combinedResults = [...reviewedByPrs, ...mergedByPrs, ...closedByPrs];
    const uniqueReviewedPrs = new Set();

    for (const pr of combinedResults) {
      // 1. Private repo check
      if (pr.private) {
        prCache.add(pr.html_url);
        continue;
      }

      const isBot = pr.user && pr.user.type === 'Bot';
      const repoParts = new URL(pr.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      // 2. Logic for Bot PRs
      if (isBot) {
        const firstCommentDate = await getFirstCommentDate(
          pr.comments_url,
          GITHUB_USERNAME,
          { hasLogged: false },
          year,
          pr.title
        );

        if (firstCommentDate) {
          if (!seenUrls.collaborations.has(pr.html_url)) {
            contributions.collaborations.push({
              title: pr.title,
              url: pr.html_url,
              repo: `${owner}/${repoName}`,
              date: firstCommentDate,
              createdAt: pr.created_at,
              firstCommentedAt: firstCommentDate,
              state: pr.state,
              mergedAt: pr.pull_request?.merged_at || null,
              closedAt: pr.state === 'closed' ? pr.closed_at : null,
              updatedAt: pr.updated_at,
            });
            seenUrls.collaborations.add(pr.html_url);
          }
          continue;
        } else {
          prCache.add(pr.html_url);
          continue;
        }
      }

      // 3. Skip personal repos for non-bot PRs
      if (owner === GITHUB_USERNAME) {
        prCache.add(pr.html_url);
        continue;
      }

      // Logic for Human PRs (Note: redundant owner/repoName check removed)
      const prDate = new Date(pr.updated_at);
      if (prDate >= new Date(yearStart) && prDate < new Date(yearEnd)) {
        let logState = { hasLogged: false };

        let mergedAt =
          pr.pull_request?.merged_at ||
          (pr.state === 'closed' && pr.merged_at ? pr.merged_at : null);
        let mergePeriod = mergedAt
          ? Math.round((new Date(mergedAt) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)) +
            ' days'
          : pr.state === 'closed'
            ? 'Closed'
            : 'Open';

        const commitDetails = await getFirstCommitDetails(
          owner,
          repoName,
          pr.number,
          GITHUB_USERNAME,
          commitCache,
          pr.updated_at,
          logState,
          year,
          pr.title,
          pr.created_at
        );

        if (commitDetails && commitDetails.firstCommitDate) {
          const daysDiff = Math.round(
            (new Date(commitDetails.firstCommitDate) - new Date(pr.created_at)) /
              (1000 * 60 * 60 * 24)
          );
          contributions.coAuthoredPrs.push({
            title: pr.title,
            url: pr.html_url,
            repo: `${owner}/${repoName}`,
            date: commitDetails.firstCommitDate,
            createdAt: pr.created_at,
            firstCommitDate: commitDetails.firstCommitDate,
            firstCommitPeriod: daysDiff + (daysDiff === 1 ? ' day' : ' days'),
            commitCount: commitDetails.commitCount,
            mergedAt,
            state: pr.state,
          });
          seenUrls.coAuthoredPrs.add(pr.html_url);
        }

        const myFirstReviewDate = await getPrMyFirstReviewDate(
          owner,
          repoName,
          pr.number,
          GITHUB_USERNAME,
          logState,
          year,
          pr.title
        );
        if (myFirstReviewDate && !uniqueReviewedPrs.has(pr.html_url)) {
          let myFirstReviewPeriod =
            Math.round(
              (new Date(myFirstReviewDate) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)
            ) + ' days';
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

    // Collaborations
    const collaborationsPrs = await getAllPages(
      `is:pr commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -reviewed-by:${GITHUB_USERNAME} updated:${yearStart}..${yearEnd}`
    );
    const collaborationsIssues = await getAllPages(
      `is:issue commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:${yearStart}..${yearEnd}`
    );

    const allCollaborations = [...collaborationsPrs, ...collaborationsIssues];

    for (const item of allCollaborations) {
      const isBot = item.user && item.user.type === 'Bot';
      const repoParts = new URL(item.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      if (seenUrls.collaborations.has(item.html_url) || owner === GITHUB_USERNAME) continue;

      let logState = { hasLogged: false };

      if (isBot) {
        const firstCommentDate = await getFirstCommentDate(
          item.comments_url,
          GITHUB_USERNAME,
          logState,
          year,
          item.title
        );

        if (firstCommentDate) {
          contributions.collaborations.push({
            title: item.title,
            url: item.html_url,
            repo: `${owner}/${repoName}`,
            date: firstCommentDate,
            createdAt: item.created_at,
            firstCommentedAt: firstCommentDate,
            state: item.state,
            mergedAt: item.pull_request?.merged_at || null,
            closedAt: item.state === 'closed' ? item.closed_at : null,
            updatedAt: item.updated_at,
          });
          seenUrls.collaborations.add(item.html_url);
        } else {
          prCache.add(item.html_url);
        }
        continue;
      }

      let hasReview = false;
      let hasCommits = false;

      // 1. Independent Check: Is it a co-authored PR?
      if (item.pull_request) {
        let mergedAt = item.pull_request.merged_at || null;
        const commitDetails = await getFirstCommitDetails(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME,
          commitCache,
          item.updated_at,
          logState,
          year,
          item.title,
          item.created_at
        );

        if (commitDetails && commitDetails.firstCommitDate) {
          hasCommits = true;
          const daysDiff = Math.round(
            (new Date(commitDetails.firstCommitDate) - new Date(item.created_at)) /
              (1000 * 60 * 60 * 24)
          );
          contributions.coAuthoredPrs.push({
            title: item.title,
            url: item.html_url,
            repo: `${owner}/${repoName}`,
            date: commitDetails.firstCommitDate,
            createdAt: item.created_at,
            firstCommitDate: commitDetails.firstCommitDate,
            firstCommitPeriod: daysDiff + (daysDiff === 1 ? ' day' : ' days'),
            commitCount: commitDetails.commitCount,
            mergedAt,
            state: item.state,
          });
          seenUrls.coAuthoredPrs.add(item.html_url);
        }
      }

      // 2. Independent Check: Is it a reviewed PR?
      if (item.pull_request && !uniqueReviewedPrs.has(item.html_url)) {
        const myFirstReviewDate = await getPrMyFirstReviewDate(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME,
          logState,
          year,
          item.title
        );
        if (myFirstReviewDate) {
          hasReview = true;
          let mergedAt = item.pull_request.merged_at || null;
          let mergePeriod = mergedAt
            ? Math.round((new Date(mergedAt) - new Date(item.created_at)) / (1000 * 60 * 60 * 24)) +
              ' days'
            : item.state === 'closed'
              ? 'Closed'
              : 'Open';
          let myFirstReviewPeriod =
            Math.round(
              (new Date(myFirstReviewDate) - new Date(item.created_at)) / (1000 * 60 * 60 * 24)
            ) + ' days';
          contributions.reviewedPrs.push({
            title: item.title,
            url: item.html_url,
            repo: `${owner}/${repoName}`,
            date: item.updated_at,
            createdAt: item.created_at,
            mergedAt,
            mergePeriod,
            myFirstReviewDate,
            myFirstReviewPeriod,
            state: item.state,
          });
          uniqueReviewedPrs.add(item.html_url);
        }
      }

      // 3. Fallback: Only categorize as a pure collaboration if no commits AND no reviews were found
      if (!hasCommits && !hasReview) {
        const firstCommentDate = await getFirstCommentDate(
          item.comments_url,
          GITHUB_USERNAME,
          logState,
          year,
          item.title
        );
        contributions.collaborations.push({
          title: item.title,
          url: item.html_url,
          repo: `${owner}/${repoName}`,
          date: firstCommentDate,
          createdAt: item.created_at,
          firstCommentedAt: firstCommentDate,
          state: item.state,
          mergedAt: item.pull_request?.merged_at || null,
          closedAt: item.state === 'closed' ? item.closed_at : null,
          updatedAt: item.updated_at,
        });
      }
      seenUrls.collaborations.add(item.html_url);
    }
  }

  return { contributions, prCache, commitCache };
}

module.exports = {
  fetchContributions,
};
