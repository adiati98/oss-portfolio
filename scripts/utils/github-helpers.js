const { isBotLogin } = require('./bot-helpers');

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
 * Merges timeline processing with explicit fallback comment checking to guarantee review replies are caught.
 */
async function getPrActivityMeta(owner, repo, prNumber, axiosInstance, prMainUpdatedAt) {
  let fallbackActivity = {
    lastActor: null,
    isLastActorBot: false,
    hasFormalReview: false,
    reviewState: null,
    approvedBy: null,
    lastSubstantiveDate: prMainUpdatedAt,
  };

  try {
    // 1. Initial Timeline & Review Parsing
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

    fallbackActivity = {
      lastActor,
      isLastActorBot,
      hasFormalReview: reviews.length > 0,
      reviewState: latestReview ? latestReview.state : null,
      approvedBy,
      lastSubstantiveDate,
    };

    // 2. Explicit Substantive Activity Augmentation (The fix for review replies)
    const [commentsResp, reviewCommentsResp, explicitReviewsResp] = await Promise.all([
      axiosInstance.get(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`),
      axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`),
      axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=100`),
    ]);

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

    explicitReviewsResp.data.forEach((r) => {
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
        lastActor: latest.login,
        isLastActorBot: latest.isBot,
        hasFormalReview: fallbackActivity.hasFormalReview || explicitReviewsResp.data.length > 0,
        reviewState: fallbackActivity.reviewState,
        approvedBy: fallbackActivity.approvedBy,
        lastSubstantiveDate: latest.date.toISOString(),
      };
    }
  } catch (e) {
    // Fall back safely if any step fails
  }

  return fallbackActivity;
}

module.exports = {
  getLinkedIssueNumbers,
  getPrActivityMeta,
};
