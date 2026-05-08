require('dotenv').config();
const axios = require('axios');
const { GITHUB_USERNAME, BASE_URL } = require('../config/config');
const {
  getLinkedIssueNumbers,
  getPrActivityMeta,
  getFirstCommitDetails,
} = require('../utils/github-helpers');

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
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        throw err;
      }
    }
    return results;
  }

  async function checkHumanActivity(pr) {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    const repo = repoParts[repoParts.length - 1];
    const author = pr.user.login;

    try {
      const reviewsResp = await axiosInstance.get(
        `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`
      );
      const hasHumanReview = reviewsResp.data.some(
        (review) => review.user.type === 'User' && review.user.login !== author
      );
      if (hasHumanReview) return true;

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

  for (const pr of underReviewPrs) {
    if (!seenUrls.has(pr.html_url)) {
      ongoingTasks.push(await formatTask(pr, 'Review in progress'));
      seenUrls.add(pr.html_url);
    }
  }

  for (const pr of requestedPrs) {
    if (seenUrls.has(pr.html_url)) continue;
    const isEngaged = await checkHumanActivity(pr);
    ongoingTasks.push(await formatTask(pr, isEngaged ? 'Review in progress' : 'Request review'));
    seenUrls.add(pr.html_url);
  }

  return ongoingTasks;
}

/**
 * FETCH ONGOING ISSUES
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
  fetchOngoingReviews,
  fetchOngoingIssues,
  fetchOngoingAuthoredPrs,
  fetchOngoingCoAuthoredPrs,
};
