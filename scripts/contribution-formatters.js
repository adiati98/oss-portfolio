/**
 * Utility functions for formatting dates, calculating periods, and generating status strings.
 */

/**
 * Formats an ISO 8601 date string to YYYY-MM-DD format.
 * @param {string} dateString ISO 8601 date string.
 * @returns {string} Formatted date or "N/A" if parsing fails.
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (e) {
    console.error('Error formatting date:', dateString, e);
    return 'N/A';
  }
}

/**
 * Calculates the number of days between two dates.
 * @param {string} startDateString ISO 8601 start date.
 * @param {string} endDateString ISO 8601 end date.
 * @param {string | null} status Optional fallback status if dates are missing.
 * @returns {string} Period formatted as "X days" or "1 day", or fallback status/N/A.
 */
function calculatePeriodInDays(startDateString, endDateString, status = null) {
  if (!startDateString || !endDateString) {
    if (status && status.toLowerCase() === 'open') {
      return '<strong>OPEN</strong>';
    }
    return 'N/A';
  }

  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const finalDiff = Math.max(0, diffDays);
  const unit = finalDiff === 1 ? 'day' : 'days';

  return `${finalDiff} ${unit}`;
}

/**
 * Generates Last Update / Status content for reviewed and co-authored PRs.
 * @param {object} item PR item with date, mergedAt, and state fields.
 * @returns {string} Formatted date with status badge.
 */
function getPrStatusContent(item) {
  const lastUpdateDate = formatDate(item.date);

  if (item.mergedAt) {
    return `${formatDate(item.mergedAt)}<br><strong>MERGED</strong>`;
  }

  const status = item.state ? item.state.toUpperCase() : 'N/A';
  return `${lastUpdateDate}<br><strong>${status}</strong>`;
}

/**
 * Generates Last Update / Status content for collaborations (issues and PRs).
 * @param {object} item Collaboration item with updatedAt, mergedAt, closedAt, and state fields.
 * @returns {string} Formatted date with status badge.
 */
function getCollaborationStatusContent(item) {
  const lastUpdateDate = formatDate(item.updatedAt || item.firstCommentedAt || item.date);

  let status = 'OPEN';
  if (item.mergedAt) {
    status = 'MERGED';
  } else if (item.closedAt || item.state === 'closed') {
    status = 'CLOSED';
  }

  return `${lastUpdateDate}<br><strong>${status}</strong>`;
}

module.exports = {
  formatDate,
  calculatePeriodInDays,
  getPrStatusContent,
  getCollaborationStatusContent,
};
