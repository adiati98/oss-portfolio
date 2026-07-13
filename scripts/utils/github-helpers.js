const { isBotLogin } = require('./bot-helpers');
const { withRateLimitRetry } = require('./http-helpers');

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
 * HELPER: Fetches specific activity metadata for a PR to determine "Who has the ball".
 * Merges timeline processing with explicit fallback comment checking to guarantee review replies are caught,
 * and derives whether a human (other than the PR author) has engaged at all — so callers don't need a
 * separate reviews/comments fetch just to answer that question.
 *
 * All 4 endpoints below are independent of one another, so they're fetched in a single batch rather than
 * two sequential "waves" — this halves the wall-clock cost per PR on top of not re-fetching reviews twice.
 */
async function getPrActivityMeta(
  owner,
  repo,
  prNumber,
  axiosInstance,
  prMainUpdatedAt,
  authorLogin = null,
  failedFetchCache = null,
  prUrl = null,
  prTitle = null
) {
  const resolvedPrUrl = prUrl || `https://github.com/${owner}/${repo}/pull/${prNumber}`;

  const fallbackActivity = {
    lastActor: null,
    isLastActorBot: false,
    hasFormalReview: false,
    reviewState: null,
    approvedBy: null,
    lastSubstantiveDate: prMainUpdatedAt,
    hasHumanEngagement: false,
  };

  // Already confirmed permanently 403 (e.g. an org we don't have SSO
  // authorization for) — don't re-attempt until the next full sync clears it.
  if (failedFetchCache?.has(resolvedPrUrl)) {
    return fallbackActivity;
  }

  try {
    const [timelineResp, reviewsResp, commentsResp, reviewCommentsResp] = await Promise.all([
      withRateLimitRetry(
        () => axiosInstance.get(`/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=100`),
        { label: `timeline#${prNumber}` }
      ),
      withRateLimitRetry(
        () => axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=100`),
        { label: `reviews#${prNumber}` }
      ),
      withRateLimitRetry(
        () => axiosInstance.get(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`),
        { label: `comments#${prNumber}` }
      ),
      withRateLimitRetry(
        () => axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`),
        { label: `review-comments#${prNumber}` }
      ),
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
    const isLastActorBot = isBotLogin(lastActor, lastEvent?.actor?.type);

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

    const approvedBy =
      latestReview && latestReview.state === 'APPROVED' ? latestReview.user?.login || null : null;

    // A human (not the PR author) left a review or an issue comment — reused by
    // callers that previously ran their own extra reviews/comments fetch for this.
    const hasHumanEngagement = authorLogin
      ? reviews.some((r) => r.user?.type === 'User' && r.user.login !== authorLogin) ||
        commentsResp.data.some((c) => c.user?.type === 'User' && c.user.login !== authorLogin)
      : false;

    const baseActivity = {
      lastActor,
      isLastActorBot,
      hasFormalReview: reviews.length > 0,
      reviewState: latestReview ? latestReview.state : null,
      approvedBy,
      lastSubstantiveDate,
      hasHumanEngagement,
    };

    // Explicit Substantive Activity Augmentation (the fix for review replies)
    let timelineItems = [];

    commentsResp.data.forEach((c) => {
      if (c.user) {
        timelineItems.push({
          date: new Date(c.created_at),
          login: c.user.login,
          isBot: isBotLogin(c.user.login, c.user.type),
        });
      }
    });

    reviewCommentsResp.data.forEach((c) => {
      if (c.user) {
        timelineItems.push({
          date: new Date(c.created_at),
          login: c.user.login,
          isBot: isBotLogin(c.user.login, c.user.type),
        });
      }
    });

    reviews.forEach((r) => {
      if (r.user && r.submitted_at) {
        timelineItems.push({
          date: new Date(r.submitted_at),
          login: r.user.login,
          isBot: isBotLogin(r.user.login, r.user.type),
        });
      }
    });

    timelineItems.sort((a, b) => b.date - a.date);

    if (timelineItems.length > 0) {
      const latest = timelineItems[0];
      return {
        ...baseActivity,
        lastActor: latest.login,
        isLastActorBot: latest.isBot,
        lastSubstantiveDate: latest.date.toISOString(),
      };
    }

    return baseActivity;
  } catch (e) {
    // Fall back safely if any step fails. A confirmed permanent 403 (not a
    // rate limit — see withRateLimitRetry) is worth remembering so we don't
    // re-attempt this PR on every future daily run.
    if (e.isPermanent403 && failedFetchCache) {
      // Stamp with the PR's own updated_at, not the run time, so its ghost row
      // in the historical reports lands in the quarter it was actually active.
      failedFetchCache.set(resolvedPrUrl, {
        status: '403 Forbidden',
        timestamp: prMainUpdatedAt || new Date().toISOString(),
        title: prTitle || 'Unknown Title',
      });
    }
  }

  return fallbackActivity;
}

module.exports = {
  getLinkedIssueNumbers,
  getPrActivityMeta,
};
