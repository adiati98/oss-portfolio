require('dotenv').config();
const axios = require('axios');

// Import configuration
const { GITHUB_USERNAME, BASE_URL } = require('../config/config');

/**
 * HELPER: Extracts linked issue numbers from PR descriptions.
 */
function getLinkedIssueNumbers(prBody) {
  if (!prBody) return [];
  const regex = /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(prBody)) !== null) {
    matches.push(parseInt(match[1], 10));
  }
  return matches;
}

/**
 * HELPER: Determines if a commit was physically authored by the user.
 * This is the gatekeeper for the "Co-authored" category.
 */
function isCommitByUser(c, username) {
  try {
    const commitMessage = c.commit?.message || '';

    // 1. GATEKEEPER: If the committer is web-flow, it's a GitHub UI action (like a suggestion)
    // We return false because this is NOT a physical local commit by the user.
    if (c.committer?.login === 'web-flow') return false;

    // 2. EXCLUSION: Explicitly catch "suggestion" or "merge" strings
    if (/suggestion|Merge branch|Merge remote-tracking/i.test(commitMessage)) return false;

    // 3. LOCAL AUTHOR CHECK: Verify it's actually you via CLI
    const authorLogin = c.author?.login || '';
    const authorEmail = c.commit?.author?.email?.toLowerCase() || '';
    const authorName = c.commit?.author?.name?.toLowerCase() || '';
    const lowerUsername = username.toLowerCase();

    const isAuthorMatch =
      authorLogin === username ||
      authorEmail === `${lowerUsername}@users.noreply.github.com` ||
      (authorEmail.endsWith('@users.noreply.github.com') &&
        authorEmail.includes(`+${lowerUsername}@`));

    if (isAuthorMatch) return true;

    // 4. CO-AUTHORED TRAILER: Handle Git "Co-authored-by" trailers
    if (
      /Co-authored-by:/i.test(commitMessage) &&
      commitMessage.toLowerCase().includes(lowerUsername)
    ) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Fetches the very first commit of a PR to check the original author.
 */
async function getFirstCommitDetails(
  owner,
  repo,
  prNumber,
  username,
  commitCache,
  axiosInstance,
  prUpdatedAt = null
) {
  const prUrlKey = `/repos/${owner}/${repo}/pulls/${prNumber}`;

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
      const resp = await axiosInstance.get(`${prUrlKey}/commits?per_page=100&page=${page}`);
      allCommits.push(...resp.data);
      const linkHeader = resp.headers.link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        page++;
        await new Promise((r) => setTimeout(r, 200));
      } else {
        break;
      }
    }

    // Filter commits using the helper logic
    const userCommits = allCommits.filter((c) => isCommitByUser(c, username));

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
    result = { firstCommitDate: null, commitCount: 0, prUpdatedAt };
  }

  commitCache.set(prUrlKey, result);
  return result;
}

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
 * Fetches all contribution data from the GitHub API.
 */
async function fetchContributions(requestedStartYear, prCache, persistentCommitCache) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set.');

  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

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
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
        } else {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('Rate limit hit. Waiting for 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        } else {
          throw err;
        }
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
      if (myReviews.length > 0) return myReviews[0].submitted_at;
      return null;
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 404)) return null;
      throw err;
    }
  }

  async function getFirstCommentDate(url, username) {
    try {
      let page = 1;
      while (true) {
        const response = await axiosInstance.get(`${url}?per_page=100&page=${page}`);
        const myFirstComment = response.data.find((comment) => comment.user?.login === username);
        if (myFirstComment) return myFirstComment.created_at;
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          page++;
        } else {
          return null;
        }
      }
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 404)) return null;
      throw err;
    }
  }

  for (let year = startYear; year <= currentYear; year++) {
    console.log(`Fetching contributions for year: ${year}...`);
    const yearStart = `${year}-01-01T00:00:00Z`;
    const yearEnd = `${year + 1}-01-01T00:00:00Z`;

    const prs = await getAllPages(
      `is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd}`
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

    const issues = await getAllPages(
      `is:issue author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME} created:>=${yearStart} created:<${yearEnd}`
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
      if (pr.private || (pr.user && pr.user.type === 'Bot')) {
        prCache.add(pr.html_url);
        continue;
      }

      let owner, repoName;
      try {
        const repoParts = new URL(pr.repository_url).pathname.split('/');
        owner = repoParts[repoParts.length - 2];
        repoName = repoParts[repoParts.length - 1];
        if (owner === GITHUB_USERNAME) {
          prCache.add(pr.html_url);
          continue;
        }
      } catch (e) {
        prCache.add(pr.html_url);
        continue;
      }

      const prDate = new Date(pr.updated_at);
      if (prDate >= new Date(yearStart) && prDate < new Date(yearEnd)) {
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
          axiosInstance,
          pr.updated_at
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
            date: commitDetails.firstCommitDate || pr.updated_at,
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
          GITHUB_USERNAME
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

    const collaborationsPrs = await getAllPages(
      `is:pr commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -reviewed-by:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
    );
    const collaborationsIssues = await getAllPages(
      `is:issue commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
    );
    const allCollaborations = [...collaborationsPrs, ...collaborationsIssues];

    for (const item of allCollaborations) {
      const repoParts = new URL(item.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      if (seenUrls.collaborations.has(item.html_url) || owner === GITHUB_USERNAME) continue;

      let hasCommits = false;
      if (item.pull_request) {
        const commitDetails = await getFirstCommitDetails(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME,
          commitCache,
          axiosInstance,
          item.updated_at
        );
        if (commitDetails && commitDetails.firstCommitDate) {
          hasCommits = true;
          if (!seenUrls.coAuthoredPrs.has(item.html_url)) {
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
              mergedAt: item.pull_request.merged_at || null,
              state: item.state,
            });
            seenUrls.coAuthoredPrs.add(item.html_url);
          }
        }
      }

      let hasReview = false;
      if (item.pull_request && !uniqueReviewedPrs.has(item.html_url)) {
        const myFirstReviewDate = await getPrMyFirstReviewDate(
          owner,
          repoName,
          item.number,
          GITHUB_USERNAME
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

      if (!hasCommits && !hasReview) {
        const firstCommentDate = await getFirstCommentDate(item.comments_url, GITHUB_USERNAME);
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

/**
 * HELPER: Fetches specific activity metadata for a PR to determine "Who has the ball".
 */
async function getPrActivityMeta(owner, repo, prNumber, axiosInstance, prMainUpdatedAt) {
  try {
    const [timelineResp, reviewsResp] = await Promise.all([
      axiosInstance.get(`/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=100`),
      axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`),
    ]);

    const timeline = timelineResp.data;
    const reviews = reviewsResp.data;

    const substantiveEvents = timeline.filter((e) => {
      const type = e.event;

      // 1. ALWAYS IGNORE: review requests, assignments, and locking
      if (
        [
          'review_requested',
          'review_request_removed',
          'assigned',
          'unassigned',
          'labeled',
          'unlabeled',
        ].includes(type)
      ) {
        return false;
      }

      // 2. INCLUDE: Real comments or reviews
      if (type === 'commented' || type === 'reviewed') return true;

      // 3. INCLUDE: Commits (but ignore base-branch merges)
      if (type === 'committed') {
        return !/Merge (branch|remote-tracking|pull request)|#\d+ from/i.test(e.message || '');
      }

      return false;
    });

    const lastEvent = substantiveEvents[substantiveEvents.length - 1];
    const lastActor = lastEvent?.actor?.login || lastEvent?.user?.login || lastEvent?.author?.login;
    const isLastActorBot =
      lastEvent?.actor?.type === 'Bot' || /\[bot\]$|dependabot|snyk/i.test(lastActor || '');

    // --- Calculate the TRUE last activity date ---

    let timestamps = [];

    substantiveEvents.forEach((e) => {
      const d = e.created_at || e.submitted_at || e.author?.date;
      if (d) timestamps.push(new Date(d));
    });

    reviews.forEach((r) => {
      if (r.submitted_at) timestamps.push(new Date(r.submitted_at));
    });

    // FALLBACK: If no substantive actions yet, use creation date, not updatedAt
    // This prevents "Updated at" from counting meta-actions as activity.
    let lastSubstantiveDate;
    if (timestamps.length > 0) {
      lastSubstantiveDate = new Date(Math.max(...timestamps)).toISOString();
    } else {
      // If nothing has happened yet, we'll use the current PR's updated_at
      // but only as a last resort.
      lastSubstantiveDate = prMainUpdatedAt;
    }

    const latestReview = reviews
      .filter((r) => r.state !== 'COMMENTED')
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];

    return {
      lastActor,
      isLastActorBot,
      hasFormalReview: reviews.length > 0,
      reviewState: latestReview ? latestReview.state : null,
      lastSubstantiveDate,
    };
  } catch (e) {
    return {
      lastActor: null,
      isLastActorBot: false,
      hasFormalReview: false,
      reviewState: null,
      lastSubstantiveDate: prMainUpdatedAt,
    };
  }
}

/**
 * FETCH ONGOING REVIEWS
 */
async function fetchOngoingReviews() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set.');

  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  async function searchAll(query) {
    let results = [];
    let page = 1;
    while (true) {
      try {
        const response = await axiosInstance.get(
          `/search/issues?q=${query}&per_page=100&page=${page}`
        );
        results.push(...response.data.items);
        const link = response.headers.link;
        if (link && link.includes('rel="next"')) {
          page++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          break;
        }
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('Rate limit hit. Waiting...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        throw err;
      }
    }
    return results;
  }

  // Helper to check if a PR has human activity from someone other than the author
  async function checkHumanActivity(pr) {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    const repo = repoParts[repoParts.length - 1];
    const author = pr.user.login;

    try {
      // 1. Fetch Reviews
      const reviewsResp = await axiosInstance.get(
        `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`
      );
      const hasHumanReview = reviewsResp.data.some(
        (review) => review.user.type === 'User' && review.user.login !== author
      );
      if (hasHumanReview) return true;

      // 2. Fetch Comments (Issue comments/Top-level)
      const commentsResp = await axiosInstance.get(
        `/repos/${owner}/${repo}/issues/${pr.number}/comments`
      );
      const hasHumanComment = commentsResp.data.some(
        (comment) => comment.user.type === 'User' && comment.user.login !== author
      );
      if (hasHumanComment) return true;

      return false;
    } catch (e) {
      return false;
    }
  }

  const requestedQuery = `is:pr is:open review-requested:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;
  const underReviewQuery = `is:pr is:open reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;

  const [requestedPrs, underReviewPrs] = await Promise.all([
    searchAll(requestedQuery),
    searchAll(underReviewQuery),
  ]);

  const ongoingTasks = [];
  const seenUrls = new Set();

  const formatTask = async (pr, status) => {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    const repo = repoParts[repoParts.length - 1];

    const activity = await getPrActivityMeta(owner, repo, pr.number, axiosInstance, pr.updated_at);

    return {
      title: pr.title,
      url: pr.html_url,
      repo: `${owner}/${repo}`,
      status: status,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      number: pr.number,
      user: pr.user,
      isDraft: pr.draft,
      labels: pr.labels ? pr.labels.map((l) => l.name) : [],
      lastActor: activity.lastActor,
      isLastActorBot: activity.isLastActorBot,
      hasFormalReview: activity.hasFormalReview,
      reviewState: activity.reviewState,
      lastSubstantiveDate: activity.lastSubstantiveDate,
      author: pr.user.login,
    };
  };

  // 1. "Review in progress": already explicitly reviewed by you
  for (const pr of underReviewPrs) {
    if (!seenUrls.has(pr.html_url)) {
      ongoingTasks.push(await formatTask(pr, 'Review in progress'));
      seenUrls.add(pr.html_url);
    }
  }

  // 2. "Request review" vs "Review in progress" for the remaining requested PRs
  for (const pr of requestedPrs) {
    if (seenUrls.has(pr.html_url)) continue;

    const isEngaged = await checkHumanActivity(pr);

    if (isEngaged) {
      ongoingTasks.push(await formatTask(pr, 'Review in progress'));
    } else {
      ongoingTasks.push(await formatTask(pr, 'Request review'));
    }
    seenUrls.add(pr.html_url);
  }

  return ongoingTasks;
}

/**
 * Fetches all open issues assigned to the user.
 */
async function fetchOngoingIssues(ongoingPrs = []) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set.');

  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const linkedIssueNumbers = new Set();
  ongoingPrs.forEach((pr) => {
    const numbers = getLinkedIssueNumbers(pr.body);
    numbers.forEach((num) => linkedIssueNumbers.add(num));
  });

  async function searchAll(query) {
    let results = [];
    let page = 1;
    while (true) {
      try {
        const response = await axiosInstance.get(
          `/search/issues?q=${query}&per_page=100&page=${page}`
        );
        results.push(...response.data.items);
        const link = response.headers.link;
        if (link && link.includes('rel="next"')) {
          page++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          break;
        }
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('Rate limit hit in fetchOngoingIssues. Waiting for 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        throw err;
      }
    }
    return results;
  }

  const query = `is:issue is:open assignee:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;
  const rawIssues = await searchAll(query);

  return rawIssues
    .filter((issue) => !linkedIssueNumbers.has(issue.number))
    .map((issue) => {
      const repoParts = new URL(issue.repository_url).pathname.split('/');
      return {
        title: issue.title,
        url: issue.html_url,
        repo: `${repoParts[repoParts.length - 2]}/${repoParts[repoParts.length - 1]}`,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: issue.labels.map((l) => l.name),
        number: issue.number,
      };
    });
}

/**
 * FETCH ONGOING AUTHORED PRS
 */
async function fetchOngoingAuthoredPrs() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set.');

  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  let allAuthoredItems = [];
  let page = 1;

  try {
    while (true) {
      const response = await axiosInstance.get(`/issues`, {
        params: {
          filter: 'created',
          state: 'open',
          per_page: 100,
          page: page,
        },
      });

      if (response.data.length === 0) break;
      allAuthoredItems.push(...response.data);

      const link = response.headers.link;
      if (link && link.includes('rel="next"')) {
        page++;
      } else {
        break;
      }
    }
  } catch (err) {
    console.error('❌ Error fetching from Issues API:', err.message);
    return [];
  }

  const results = [];
  for (const item of allAuthoredItems) {
    const isPr = !!item.pull_request;
    const isExternal = !item.repository_url.includes(`repos/${GITHUB_USERNAME}/`);

    if (isPr && isExternal) {
      const repoParts = new URL(item.repository_url).pathname.split('/');
      const owner = repoParts[repoParts.length - 2];
      const repo = repoParts[repoParts.length - 1];

      const activity = await getPrActivityMeta(
        owner,
        repo,
        item.number,
        axiosInstance,
        item.updated_at
      );

      results.push({
        title: item.title,
        url: item.html_url,
        repo: `${owner}/${repo}`,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        number: item.number,
        isDraft: item.draft === true || !!(item.pull_request && item.pull_request.draft),
        labels: item.labels ? item.labels.map((l) => l.name) : [],
        body: item.body,
        lastActor: activity.lastActor,
        isLastActorBot: activity.isLastActorBot,
        hasFormalReview: activity.hasFormalReview,
        reviewState: activity.reviewState,
        lastSubstantiveDate: activity.lastSubstantiveDate,
        author: GITHUB_USERNAME,
      });
    }
  }
  return results;
}

/**
 * FETCH ONGOING CO-AUTHORED PRS
 */
async function fetchOngoingCoAuthoredPrs(commitCache) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set.');

  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  async function searchAll(query) {
    let results = [];
    let page = 1;
    while (true) {
      try {
        const response = await axiosInstance.get(
          `/search/issues?q=${query}&per_page=100&page=${page}`
        );
        results.push(...response.data.items);
        const link = response.headers.link;
        if (link && link.includes('rel="next"')) {
          page++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          break;
        }
      } catch (err) {
        if (err.response && err.response.status === 403) {
          console.log('Rate limit hit in fetchOngoingCoAuthoredPrs. Waiting...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        throw err;
      }
    }
    return results;
  }

  const query = `is:pr is:open commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;
  const rawPrs = await searchAll(query);

  const coAuthoredResults = [];

  for (const pr of rawPrs) {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    const repoName = repoParts[repoParts.length - 1];

    if (owner === GITHUB_USERNAME) continue;

    const commitDetails = await getFirstCommitDetails(
      owner,
      repoName,
      pr.number,
      GITHUB_USERNAME,
      commitCache,
      axiosInstance,
      pr.updated_at
    );

    if (commitDetails && commitDetails.firstCommitDate) {
      const activity = await getPrActivityMeta(
        owner,
        repoName,
        pr.number,
        axiosInstance,
        pr.updated_at
      );

      coAuthoredResults.push({
        title: pr.title,
        url: pr.html_url,
        repo: `${owner}/${repoName}`,
        number: pr.number,
        status: 'Co-authoring',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        labels: pr.labels ? pr.labels.map((l) => l.name) : [],
        isDraft: pr.draft,
        body: pr.body,
        lastActor: activity.lastActor,
        isLastActorBot: activity.isLastActorBot,
        hasFormalReview: activity.hasFormalReview,
        reviewState: activity.reviewState,
        lastSubstantiveDate: activity.lastSubstantiveDate,
        author: pr.user.login,
      });
    }
  }

  return coAuthoredResults;
}

module.exports = {
  fetchContributions,
  fetchOngoingReviews,
  fetchOngoingIssues,
  fetchOngoingAuthoredPrs,
  fetchOngoingCoAuthoredPrs,
};
