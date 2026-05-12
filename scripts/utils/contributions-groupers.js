const fs = require('fs');
const path = require('path');

/**
 * Processes a list of contributions and groups them into calendar quarters (YYYY-QX).
 * @param {object} contributions The object containing all contribution lists.
 * @returns {object}
 */
function groupContributionsByQuarter(contributions) {
  const grouped = {};

  // --- INJECT 403 DATA ---
  const logPath = path.join(process.cwd(), 'data', 'failed-fetch.json');
  if (fs.existsSync(logPath)) {
    try {
      const failedData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      for (const [url, details] of Object.entries(failedData)) {
        // Extract repo name from URL: https://github.com/owner/repo/pull/123 -> owner/repo
        const urlParts = new URL(url).pathname.split('/');
        const repo = `${urlParts[1]}/${urlParts[2]}`;

        // Add to collaborations as a "Ghost Row"
        contributions.collaborations.push({
          title: details.title || 'Unknown Title',
          url: url,
          repo: repo,
          date: details.timestamp, // Use the time it was caught as the fallback date
          isInaccessible: true, // Flag for the UI
          state: 'archived', // Custom state for the badge
        });
      }
    } catch (e) {
      console.warn('Could not process failed-fetch.json for grouping');
    }
  }
  // --- END INJECTION ---

  for (const [type, items] of Object.entries(contributions)) {
    for (const item of items) {
      let dateStr;

      if (type === 'reviewedPrs' && item.myFirstReviewDate) {
        dateStr = item.myFirstReviewDate;
      } else if (type === 'coAuthoredPrs' && item.firstCommitDate) {
        dateStr = item.firstCommitDate;
      }

      if (!dateStr) {
        dateStr = item.date || item.createdAt || item.closedAt || item.updatedAt;
      }

      if (!dateStr) {
        console.warn(`Skipping item in ${type} due to missing date:`, item.title);
        continue;
      }

      const dateObj = new Date(dateStr);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const quarter = `Q${Math.floor((month - 1) / 3) + 1}`;
      const key = `${year}-${quarter}`;

      if (!grouped[key]) {
        grouped[key] = {
          pullRequests: [],
          issues: [],
          reviewedPrs: [],
          coAuthoredPrs: [],
          collaborations: [],
        };
      }

      if (!grouped[key][type]) {
        grouped[key][type] = [];
      }
      grouped[key][type].push(item);
    }
  }
  return grouped;
}

module.exports = {
  groupContributionsByQuarter,
};
