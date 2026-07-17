require('dotenv').config();
const axios = require('axios');
const { GITHUB_USERNAME, BASE_URL } = require('../config/config');
const { getLinkedIssueNumbers, getPrActivityMeta } = require('../utils/github-helpers');
const {
  attachRateLimitLogger,
  withRateLimitRetry,
  mapWithConcurrency,
  keepAliveAgent,
} = require('../utils/http-helpers');
const { isCommitByUser } = require('../utils/commit-helpers');

/**
 * SHARED AXIOS CONFIGURATION
 */
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is not set.');

const axiosInstance = attachRateLimitLogger(
  axios.create({
    baseURL: BASE_URL,
    httpsAgent: keepAliveAgent,
    timeout: 30000,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
);

// How many PRs to process concurrently per fetcher. Bounded (rather than
// unlimited Promise.all) so we don't fire hundreds of simultaneous requests
// at GitHub's secondary rate limiter when a user has thousands of open PRs
// to track. Each PR's activity fetch already fans out to 4 parallel calls, so
// the real peak is PR_CONCURRENCY * 4 sockets — kept at 3 (=> ~12 in flight,
// further capped by the agent's maxSockets) to stay under GitHub's
// abuse-detection threshold. Going higher (6 => ~24) reliably tripped
// secondary rate limits and ECONNRESET storms that cost far more in backoff
// than the extra parallelism saved.
const PR_CONCURRENCY = 3;

/**
 * SHARED UTILITY: searchAll
 * Handles paginated search results for all functions.
 */
async function searchAll(query) {
  let results = [];
  let page = 1;
  while (true) {
    const response = await withRateLimitRetry(
      () => axiosInstance.get(`/search/issues?q=${query}&per_page=100&page=${page}`),
      { label: `search p${page}`, assumeRateLimit: true }
    );
    results.push(...response.data.items);
    const link = response.headers.link;
    if (link && link.includes('rel="next"')) {
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      break;
    }
  }
  return results;
}

/**
 * LOCAL HELPER: getFirstCommitDetails (Ongoing Workbench Version)
 */
async function getFirstCommitDetails(
  owner,
  repo,
  prNumber,
  username,
  commitCache,
  prUpdatedAt = null,
  failedFetchCache = null,
  prTitle = null
) {
  const prUrlKey = `/repos/${owner}/${repo}/pulls/${prNumber}`;
  const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;

  // Already confirmed permanently 403 — don't re-attempt until the next full sync.
  if (failedFetchCache?.has(prUrl)) {
    return { firstCommitDate: null, commitCount: 0, prUpdatedAt, fetchFailed: true };
  }

  if (commitCache.has(prUrlKey)) {
    const cached = commitCache.get(prUrlKey);
    if (cached?.prUpdatedAt && prUpdatedAt && cached.prUpdatedAt === prUpdatedAt) return cached;
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

    // The Active Workbench is about current authoring tasks, so applying a
    // reviewer's suggestion (a web-flow commit) is treated as reviewing, not
    // authoring — excludeWebFlow keeps those off the co-authoring list.
    const userCommits = allCommits.filter((c) =>
      isCommitByUser(c, username, { excludeWebFlow: true })
    );

    // Separately, evaluate the same commits under the HISTORICAL rule (which
    // does count web-flow work, e.g. a suggestion of yours the author committed
    // — GitHub credits that with a real Co-authored-by trailer). The historical
    // reports are pruned against this verdict, never against the workbench's
    // stricter one; conflating them deletes genuinely co-authored PRs.
    const historicalMatch = allCommits.some((c) => isCommitByUser(c, username));

    if (userCommits.length > 0) {
      userCommits.sort((a, b) => new Date(a.commit.author.date) - new Date(b.commit.author.date));
      result = {
        firstCommitDate: userCommits[0].commit.author.date,
        commitCount: userCommits.length,
        prUpdatedAt,
        historicalMatch,
      };
    } else {
      result = { firstCommitDate: null, commitCount: 0, prUpdatedAt, historicalMatch };
    }
  } catch (err) {
    // A confirmed permanent 403 (not a rate limit) is worth remembering so
    // we don't retry it every day. Either way, we couldn't verify commit
    // authorship — mark it as unknown rather than a confirmed "no", so
    // callers don't drop a PR just because we couldn't check it this run.
    if (err.isPermanent403 && failedFetchCache) {
      // Stamp with the PR's own updated_at, not the run time. This 403 will be
      // rendered as a ghost row in the historical reports, and it belongs in
      // the quarter it was actually active in (e.g. a 2023 PR), not in
      // whatever quarter this daily run happens to fall in.
      failedFetchCache.set(prUrl, {
        status: '403 Forbidden',
        timestamp: prUpdatedAt || new Date().toISOString(),
        title: prTitle || 'Unknown Title',
      });
    }
    result = { firstCommitDate: null, commitCount: 0, prUpdatedAt, fetchFailed: true };
  }
  commitCache.set(prUrlKey, result);
  return result;
}

/**
 * SHARED HELPER: getCachedActivity
 * Wraps getPrActivityMeta with a persistent, updatedAt-gated cache so a PR
 * that hasn't changed since the last run costs zero API calls instead of 4.
 * This is the main lever keeping daily runs fast as the number of tracked
 * open PRs grows into the thousands — most of them are untouched day to day.
 */
async function getCachedActivity(owner, repo, pr, activityCache, failedFetchCache) {
  const cacheKey = pr.html_url;
  if (activityCache) {
    const cached = activityCache.get(cacheKey);
    if (cached && cached.updatedAt === pr.updated_at) {
      return cached.activity;
    }
  }

  const activity = await getPrActivityMeta(
    owner,
    repo,
    pr.number,
    axiosInstance,
    pr.updated_at,
    pr.user.login,
    failedFetchCache,
    pr.html_url,
    pr.title
  );

  if (activityCache) {
    activityCache.set(cacheKey, { updatedAt: pr.updated_at, activity });
  }
  return activity;
}

/**
 * SHARED FORMATTER: formatTask
 */
const formatTask = async (pr, status, activityCache, failedFetchCache) => {
  const repoParts = new URL(pr.repository_url).pathname.split('/');
  const owner = repoParts[repoParts.length - 2];
  const repo = repoParts[repoParts.length - 1];

  const activity = await getCachedActivity(owner, repo, pr, activityCache, failedFetchCache);

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
    approvedBy: activity.approvedBy,
    lastSubstantiveDate: activity.lastSubstantiveDate,
    author: pr.user.login,
  };
};

/**
 * FETCH ONGOING REVIEWS
 */
async function fetchOngoingReviews(activityCache, failedFetchCache) {
  const requestedQuery = `is:pr is:open review-requested:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;
  const underReviewQuery = `is:pr is:open reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;

  const [requestedPrs, underReviewPrs] = await Promise.all([
    searchAll(requestedQuery),
    searchAll(underReviewQuery),
  ]);

  const seenUrls = new Set();

  const uniqueUnderReview = underReviewPrs.filter((pr) => {
    if (seenUrls.has(pr.html_url)) return false;
    seenUrls.add(pr.html_url);
    return true;
  });

  const uniqueRequested = requestedPrs.filter((pr) => {
    if (seenUrls.has(pr.html_url)) return false;
    seenUrls.add(pr.html_url);
    return true;
  });

  const underReviewTasks = await mapWithConcurrency(uniqueUnderReview, PR_CONCURRENCY, (pr) =>
    formatTask(pr, 'Review in progress', activityCache, failedFetchCache)
  );

  // The reviews (+ issue comments) needed to decide "already engaged" vs.
  // "still just requested" are the same ones getPrActivityMeta fetches for
  // the task itself — reuse that single fetch instead of a third, separate
  // reviews/comments call per PR.
  const requestedTasks = await mapWithConcurrency(uniqueRequested, PR_CONCURRENCY, async (pr) => {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    const repo = repoParts[repoParts.length - 1];
    const activity = await getCachedActivity(owner, repo, pr, activityCache, failedFetchCache);
    const status = activity.hasHumanEngagement ? 'Review in progress' : 'Request review';
    return formatTask(pr, status, activityCache, failedFetchCache);
  });

  return [...underReviewTasks, ...requestedTasks];
}

/**
 * FETCH ONGOING ISSUES
 */
async function fetchOngoingIssues(ongoingPrs = []) {
  const linkedIssueNumbers = new Set();
  ongoingPrs.forEach((pr) => {
    const numbers = getLinkedIssueNumbers(pr.body);
    numbers.forEach((num) => linkedIssueNumbers.add(num));
  });

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
async function fetchOngoingAuthoredPrs(activityCache, failedFetchCache) {
  let allAuthoredItems = [];
  let page = 1;

  try {
    while (true) {
      const response = await withRateLimitRetry(
        () =>
          axiosInstance.get(`/issues`, {
            params: {
              filter: 'created',
              state: 'open',
              per_page: 100,
              page: page,
            },
          }),
        { label: `authored-issues p${page}`, assumeRateLimit: true }
      );

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

  const candidates = allAuthoredItems.filter((item) => {
    const isPr = !!item.pull_request;
    const isExternal = !item.repository_url.includes(`repos/${GITHUB_USERNAME}/`);
    return isPr && isExternal;
  });

  return mapWithConcurrency(candidates, PR_CONCURRENCY, async (item) => {
    const formatted = await formatTask(item, 'Authored', activityCache, failedFetchCache);
    formatted.isDraft = item.draft === true || !!(item.pull_request && item.pull_request.draft);
    formatted.author = GITHUB_USERNAME;
    formatted.body = item.body;
    return formatted;
  });
}

/**
 * FETCH ONGOING CO-AUTHORED PRS
 */
async function fetchOngoingCoAuthoredPrs(commitCache, activityCache, failedFetchCache) {
  const query = `is:pr is:open commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME}`;
  const rawPrs = await searchAll(query);

  const candidates = rawPrs.filter((pr) => {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    return owner !== GITHUB_USERNAME;
  });

  // Open PRs we fetched commits for and confirmed hold NO commit by the user
  // *under the historical rule* (a clean verdict, not a fetch we couldn't
  // complete). This is the authoritative "not co-authored" signal for open PRs,
  // and the caller uses it to self-heal stale historical co-authored entries —
  // e.g. a PR that was co-authored, then force-pushed so the commit vanished.
  //
  // It deliberately does NOT key off this function's own workbench verdict:
  // that rule is stricter (it ignores web-flow commits), so reusing it here
  // would prune history by a definition history never used and silently delete
  // real co-authored work, such as a review suggestion the PR author committed.
  const examinedRejectedUrls = new Set();

  const results = await mapWithConcurrency(candidates, PR_CONCURRENCY, async (pr) => {
    const repoParts = new URL(pr.repository_url).pathname.split('/');
    const owner = repoParts[repoParts.length - 2];
    const repoName = repoParts[repoParts.length - 1];

    const commitDetails = await getFirstCommitDetails(
      owner,
      repoName,
      pr.number,
      GITHUB_USERNAME,
      commitCache,
      pr.updated_at,
      failedFetchCache,
      pr.title
    );

    // Record the historical-rule verdict for the caller's self-healing pass.
    // Only a clean "no" counts: a fetch we couldn't complete (fetchFailed) is
    // "unknown", and must never demote a real entry.
    if (!commitDetails?.fetchFailed && !commitDetails?.historicalMatch) {
      examinedRejectedUrls.add(pr.html_url);
    }

    // Only a confirmed commit by the user keeps a PR on the Active Workbench.
    // A fetch we couldn't complete (fetchFailed, e.g. a permanently-403ing
    // repo) is NOT kept here: those are almost always old, dormant PRs we
    // can't verify, and the Active Workbench is for current tasks only. The
    // 403 is still recorded (getFirstCommitDetails wrote it to the
    // failed-fetch cache), so it still surfaces in the historical reports as
    // a ghost row — just not as an active task.
    if (commitDetails?.firstCommitDate) {
      const formatted = await formatTask(pr, 'Co-authoring', activityCache, failedFetchCache);
      formatted.body = pr.body;
      return formatted;
    }

    return null;
  });

  return { prs: results.filter(Boolean), examinedRejectedUrls };
}

module.exports = {
  fetchOngoingReviews,
  fetchOngoingIssues,
  fetchOngoingAuthoredPrs,
  fetchOngoingCoAuthoredPrs,
};
