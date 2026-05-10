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

module.exports = {
  getLinkedIssueNumbers,
  getPrActivityMeta,
};
