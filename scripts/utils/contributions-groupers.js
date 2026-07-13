const fs = require('fs');
const path = require('path');

/**
 * Processes a list of contributions and groups them into calendar quarters (YYYY-QX).
 * @param {object} contributions The object containing all contribution lists.
 * @returns {object}
 */
function groupContributionsByQuarter(contributions) {
  const grouped = {};

  // Normalized set of every URL we could already categorize, so a 403 that is
  // ALSO present as a real row isn't shown twice (once as itself, once as a
  // ghost). Matches the normalization used for the headline count in main.js.
  const categorizedUrls = new Set();
  for (const items of Object.values(contributions)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item?.url) categorizedUrls.add(item.url.replace(/\/$/, '').toLowerCase());
    }
  }

  /**
   * Places one item into its quarter bucket.
   */
  function placeInQuarter(type, item, dateStr) {
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

      placeInQuarter(type, item, dateStr);
    }
  }

  // --- Inject 403 data as "Ghost Rows" ---
  // Built into the grouped output ONLY. We deliberately do not push these into
  // `contributions`: that object is passed by reference and reused downstream
  // (createStatsReadme / createIndexHtml) to compute the headline total, which
  // adds uncategorized 403s separately — mutating it here would double-count
  // them. See main.js for the headline math.
  const logPath = path.join(process.cwd(), 'data', 'failed-fetch.json');
  if (fs.existsSync(logPath)) {
    try {
      const failedData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      for (const [url, details] of Object.entries(failedData)) {
        const urlObj = new URL(url);
        const urlParts = urlObj.pathname.split('/').filter(Boolean); // filter removes empty strings

        let repo = 'Unknown Repo';

        if (urlObj.hostname === 'api.github.com' && urlParts[0] === 'repos') {
          // API format: /repos/owner/repo/...
          repo = `${urlParts[1]}/${urlParts[2]}`;
        } else {
          // Standard format: /owner/repo/...
          repo = `${urlParts[0]}/${urlParts[1]}`;
        }

        const ghostUrl = url
          .replace('api.github.com/repos/', 'github.com/')
          .replace('/pulls/', '/pull/');

        // Already shown as a real, categorized row — don't duplicate it.
        if (categorizedUrls.has(ghostUrl.replace(/\/$/, '').toLowerCase())) {
          continue;
        }

        if (!details.timestamp) {
          console.warn('Skipping 403 ghost row due to missing date:', details.title);
          continue;
        }

        // Add to collaborations as a "Ghost Row"
        placeInQuarter(
          'collaborations',
          {
            title: details.title || 'Unknown Title',
            url: ghostUrl,
            repo: repo,
            date: details.timestamp,
            isInaccessible: true,
            state: 'archived',
          },
          details.timestamp
        );
      }
    } catch (e) {
      console.warn('Could not process failed-fetch.json for grouping');
    }
  }

  return grouped;
}

module.exports = {
  groupContributionsByQuarter,
};
