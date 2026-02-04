require('dotenv').config();
const axios = require('axios');
const { GITHUB_USERNAME, BASE_URL } = require('../config/config');

async function limitConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...(await Promise.all(batch.map((item) => fn(item)))));
  }
  return results;
}

async function fetchContributions(startYear, prCache, persistentCommitCache) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set.');

  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const contributions = {
    pullRequests: [],
    issues: [],
    reviewedPrs: [],
    collaborations: [],
    coAuthoredPrs: [],
  };

  const commitCache =
    persistentCommitCache instanceof Map ? new Map(persistentCommitCache) : new Map();
  const currentYear = new Date().getFullYear();

  async function getAllPages(query) {
    let results = [];
    let page = 1;
    while (true) {
      try {
        const response = await axiosInstance.get(
          `/search/issues?q=${query}&per_page=100&page=${page}`
        );
        results.push(...response.data.items);
        if (response.headers.link && response.headers.link.includes('rel="next"')) {
          page++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else break;
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('Rate limit hit. Waiting for 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        throw err;
      }
    }
    return results;
  }

  async function getPrMyFirstReviewDate(owner, repo, prNumber, username) {
    try {
      const response = await axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`);
      const myReviews = response.data
        .filter((review) => review.user?.login === username)
        .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
      return myReviews.length > 0 ? myReviews[0].submitted_at : null;
    } catch (err) {
      return null;
    }
  }

  async function getFirstCommentDate(url, username) {
    try {
      let page = 1;
      while (true) {
        const response = await axiosInstance.get(`${url}?per_page=100&page=${page}`);
        const myFirstComment = response.data.find((comment) => comment.user?.login === username);
        if (myFirstComment) return myFirstComment.created_at;
        if (response.headers.link && response.headers.link.includes('rel="next"')) {
          page++;
        } else return null;
      }
    } catch (err) {
      return null;
    }
  }

  async function getFirstCommitDetails(
    owner,
    repo,
    prNumber,
    username,
    commitCache,
    prUpdatedAt,
    forceRefresh = false
  ) {
    const prUrlKey = `/repos/${owner}/${repo}/pulls/${prNumber}`;

    // Bypass cache if it's the current year or the PR has been updated since last cache
    if (!forceRefresh && commitCache.has(prUrlKey)) {
      const cached = commitCache.get(prUrlKey);
      if (cached && typeof cached === 'object' && cached.prUpdatedAt === prUpdatedAt) {
        return cached;
      }
    }

    try {
      let page = 1,
        allCommits = [];
      while (true) {
        const resp = await axiosInstance.get(`${prUrlKey}/commits?per_page=100&page=${page}`);
        allCommits.push(...resp.data);
        if (resp.headers.link && resp.headers.link.includes('rel="next"')) {
          page++;
          await new Promise((r) => setTimeout(r, 200));
        } else break;
      }

      const lowerUsername = username.toLowerCase();
      const userCommits = allCommits.filter((c) => {
        // Exclude standard GitHub merge commits to avoid inflated counts
        const isMergeCommit = c.parents && c.parents.length > 1;
        const msg = c.commit?.message?.toLowerCase() || '';
        const isMergeMsg =
          msg.startsWith('merge branch') || msg.startsWith('merge remote-tracking branch');
        if (isMergeCommit || isMergeMsg) return false;

        try {
          if (c.author?.login === username) return true;
          const email = c.commit?.author?.email?.toLowerCase() || '';
          const name = c.commit?.author?.name?.toLowerCase() || '';

          if (email.endsWith('@users.noreply.github.com') && email.includes(`+${lowerUsername}@`))
            return true;
          if (email === `${lowerUsername}@users.noreply.github.com`) return true;
          if (email.includes(lowerUsername) || name.includes(lowerUsername)) return true;
          if (msg.includes('co-authored-by:') && msg.includes(lowerUsername)) return true;
        } catch (e) {
          return false;
        }
        return false;
      });

      let result = { firstCommitDate: null, commitCount: 0, prUpdatedAt };
      if (userCommits.length > 0) {
        userCommits.sort((a, b) => new Date(a.commit.author.date) - new Date(b.commit.author.date));
        result.firstCommitDate = userCommits[0].commit.author.date;
        result.commitCount = userCommits.length;
      }

      commitCache.set(prUrlKey, result);
      return result;
    } catch (err) {
      return null;
    }
  }

  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Fetching contributions for year: ${year} ---`);
    const yearStart = `${year}-01-01T00:00:00Z`,
      yearEnd = `${year + 1}-01-01T00:00:00Z`;
    // Toggle forceRefresh for the current year to ensure latest changes are captured
    const isCurrentYear = year === currentYear;

    // 1. Authored PRs: PRs created by the user
    const prs = await getAllPages(
      `is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd}`
    );
    for (const pr of prs) {
      if (prCache.has(pr.html_url)) continue;
      const repoParts = new URL(pr.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      if (owner === GITHUB_USERNAME) {
        prCache.add(pr.html_url);
        continue;
      }
      contributions.pullRequests.push({
        title: pr.title,
        url: pr.html_url,
        repo: `${owner}/${repoParts[repoParts.length - 1]}`,
        date: pr.pull_request.merged_at,
        mergedAt: pr.pull_request.merged_at,
        createdAt: pr.created_at,
        reviewPeriod: Math.round(
          (new Date(pr.pull_request.merged_at) - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)
        ),
      });
      prCache.add(pr.html_url);
    }

    // 2. Issues: Issues opened by the user in external repositories
    const issues = await getAllPages(
      `is:issue author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME} created:>=${yearStart} created:<${yearEnd}`
    );
    for (const issue of issues) {
      const repoParts = new URL(issue.repository_url).pathname.split('/');
      contributions.issues.push({
        title: issue.title,
        url: issue.html_url,
        repo: `${repoParts[repoParts.length - 2]}/${repoParts[repoParts.length - 1]}`,
        date: issue.created_at,
        closedAt: issue.closed_at,
        closingPeriod:
          issue.state === 'closed'
            ? Math.round(
                (new Date(issue.closed_at) - new Date(issue.created_at)) / (1000 * 60 * 60 * 24)
              )
            : 'Open',
      });
    }

    // 3. Interactions: Detects code contributions, reviews, and comments
    const q = [
      `is:pr -author:${GITHUB_USERNAME} involves:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`,
      `is:pr -author:${GITHUB_USERNAME} committer:${GITHUB_USERNAME} merged:>=${yearStart} merged:<${yearEnd}`,
      `is:issue -author:${GITHUB_USERNAME} commenter:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`,
    ];
    let allRaw = [];
    for (const query of q) {
      allRaw.push(...(await getAllPages(query)));
    }
    const uniqueItems = Array.from(new Map(allRaw.map((i) => [i.html_url, i])).values());
    const uniqueReviewedPrs = new Set();

    await limitConcurrency(uniqueItems, 5, async (item) => {
      const repoParts = new URL(item.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2],
        repoName = repoParts[repoParts.length - 1];
      if (owner === GITHUB_USERNAME || item.user?.type === 'Bot') return;

      const isPR = !!item.pull_request;
      let isCoAuthor = false;
      let isReviewer = false;

      if (isPR) {
        // Co-author check: looks deep into PR commits
        const commitDetails = await getFirstCommitDetails(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME,
          commitCache,
          item.updated_at,
          isCurrentYear
        );
        if (commitDetails && commitDetails.firstCommitDate) {
          isCoAuthor = true;
          const diffDays = Math.round(
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
            firstCommitPeriod: diffDays + (diffDays === 1 ? ' day' : ' days'),
            commitCount: commitDetails.commitCount,
            mergedAt: item.pull_request?.merged_at || item.merged_at || null,
            state: item.state,
          });
        }

        // Reviewer check: looks for formal GitHub Reviews
        const reviewDate = await getPrMyFirstReviewDate(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME
        );
        if (reviewDate && !uniqueReviewedPrs.has(item.html_url)) {
          isReviewer = true;
          const mergedAt = item.pull_request?.merged_at || item.merged_at || null;
          contributions.reviewedPrs.push({
            title: item.title,
            url: item.html_url,
            repo: `${owner}/${repoName}`,
            date: item.updated_at,
            createdAt: item.created_at,
            mergedAt,
            mergePeriod: mergedAt
              ? Math.round(
                  (new Date(mergedAt) - new Date(item.created_at)) / (1000 * 60 * 60 * 24)
                ) + ' days'
              : 'Open',
            myFirstReviewDate: reviewDate,
            myFirstReviewPeriod:
              Math.round(
                (new Date(reviewDate) - new Date(item.created_at)) / (1000 * 60 * 60 * 24)
              ) + ' days',
            state: item.state,
          });
          uniqueReviewedPrs.add(item.html_url);
        }
      }

      // Collaboration fallback: Only counts if the user did NOT co-author or review
      if (!isCoAuthor && !isReviewer) {
        const commentDate = await getFirstCommentDate(item.comments_url, GITHUB_USERNAME);
        if (commentDate) {
          contributions.collaborations.push({
            title: item.title,
            url: item.html_url,
            repo: `${owner}/${repoName}`,
            date: commentDate,
            createdAt: item.created_at,
            firstCommentedAt: commentDate,
            state: item.state,
            mergedAt: item.pull_request?.merged_at || null,
            updated_at: item.updated_at,
          });
        }
      }
    });
  }
  return { contributions, prCache, commitCache };
}

module.exports = { fetchContributions };
