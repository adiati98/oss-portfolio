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

    // 1. GATEKEEPER: If the committer is web-flow, it's a GitHub UI action.
    if (c.committer?.login === 'web-flow') return false;

    // 2. EXCLUSION: Explicitly catch "suggestion" or "merge" strings
    if (/suggestion|Merge branch|Merge remote-tracking/i.test(commitMessage)) return false;

    // 3. LOCAL AUTHOR CHECK: Verify it's actually you via CLI
    const authorLogin = c.author?.login || '';
    const authorEmail = c.commit?.author?.email?.toLowerCase() || '';
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

      if (type === 'commented' || type === 'reviewed') return true;

      if (type === 'committed') {
        return !/Merge (branch|remote-tracking|pull request)|#\d+ from/i.test(e.message || '');
      }

      return false;
    });

    const lastEvent = substantiveEvents[substantiveEvents.length - 1];
    const lastActor = lastEvent?.actor?.login || lastEvent?.user?.login || lastEvent?.author?.login;
    const isLastActorBot =
      lastEvent?.actor?.type === 'Bot' || /\[bot\]$|dependabot|snyk/i.test(lastActor || '');

    let timestamps = [];
    substantiveEvents.forEach((e) => {
      const d = e.created_at || e.submitted_at || e.author?.date;
      if (d) timestamps.push(new Date(d));
    });

    reviews.forEach((r) => {
      if (r.submitted_at) timestamps.push(new Date(r.submitted_at));
    });

    let lastSubstantiveDate;
    if (timestamps.length > 0) {
      lastSubstantiveDate = new Date(Math.max(...timestamps)).toISOString();
    } else {
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

module.exports = {
  getLinkedIssueNumbers,
  isCommitByUser,
  getPrActivityMeta,
  getFirstCommitDetails,
};
