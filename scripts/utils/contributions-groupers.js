/**
 * Processes a list of contributions and groups them into calendar quarters (YYYY-QX).
 * For reviewedPrs and coAuthoredPrs, uses the original engagement date (myFirstReviewDate / firstCommitDate)
 * to determine the quarter assignment, ensuring they stay in the quarter where they were first reviewed/committed.
 * @param {object} contributions The object containing all contribution lists (pullRequests, issues, etc.).
 * @returns {object} An object where keys are "YYYY-QX" and values are objects containing contribution lists for that quarter.
 */
function groupContributionsByQuarter(contributions) {
  const grouped = {};

  for (const [type, items] of Object.entries(contributions)) {
    for (const item of items) {
      let dateStr;

      // 1. Prioritize domain-specific engagement dates
      if (type === 'reviewedPrs' && item.myFirstReviewDate) {
        dateStr = item.myFirstReviewDate;
      } else if (type === 'coAuthoredPrs' && item.firstCommitDate) {
        dateStr = item.firstCommitDate;
      }

      // 2. Universal Fallback: If dateStr is still empty (or for other types),
      // check these in order of reliability.
      if (!dateStr) {
        dateStr = item.date || item.createdAt || item.closedAt || item.updatedAt;
      }

      // 3. Final safety check
      if (!dateStr) {
        console.warn(`Skipping item in ${type} due to missing date:`, item.title);
        continue;
      }

      const dateObj = new Date(dateStr);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;

      // Calculate the quarter (1-4) based on the month
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
