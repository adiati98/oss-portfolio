/**
 * Processes a list of contributions and groups them into calendar quarters (YYYY-QX).
 * @param {object} contributions The object containing all contribution lists (pullRequests, issues, etc.).
 * @returns {object} An object where keys are "YYYY-QX" and values are objects containing contribution lists for that quarter.
 */
function groupContributionsByQuarter(contributions) {
  const grouped = {};

  for (const [type, items] of Object.entries(contributions)) {
    // Iterate over each item within the type.
    for (const item of items) {
      const dateStr = item.date;
      if (!dateStr) continue;

      const dateObj = new Date(dateStr);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;

      // Calculate the quarter (1-4) based on the month
      const quarter = `Q${Math.floor((month - 1) / 3) + 1}`;
      const key = `${year}-${quarter}`;

      // Initialize the quarter group structure if the key doesn't exist
      if (!grouped[key]) {
        grouped[key] = {
          pullRequests: [],
          issues: [],
          reviewedPrs: [],
          coAuthoredPrs: [],
          collaborations: [],
        };
      }
      // Ensure the target array exists and push the item
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
