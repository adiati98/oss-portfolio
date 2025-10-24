/**
 * Utility functions for formatting dates, calculating periods, and generating status strings.
 */

// Function to format a date string into YYYY-MM-DD
function formatDate(dateString) {
	if (!dateString) return "N/A"
	try {
		return new Date(dateString).toISOString().split("T")[0]
	} catch (e) {
		console.error("Error formatting date:", dateString, e)
		return "N/A"
	}
}

/**
 * Calculates the difference between two dates in days.
 * @param {string} startDateString ISO 8601 date string for the start date.
 * @param {string} endDateString ISO 8601 date string for the end date.
 * @param {string | null} status Optional status, e.g., "Open", to return if dates are missing.
 * @returns {string} The period formatted as "X days", "1 day", "Open", or "N/A".
 */
function calculatePeriodInDays(startDateString, endDateString, status = null) {
	if (!startDateString || !endDateString) {
		if (status && status.toLowerCase() === "open") {
			return "Open"
		}
		return "N/A"
	}

	const startDate = new Date(startDateString)
	const endDate = new Date(endDateString)

	// Calculate difference in milliseconds
	const diffTime = endDate.getTime() - startDate.getTime()

	// Calculate difference in days (round to nearest whole day)
	const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

	// Ensure result is not negative (safety net)
	const finalDiff = Math.max(0, diffDays)

	// Use 'day' for 1, and 'days' for 0 and > 1 (standard pluralization)
	const unit = finalDiff === 1 ? "day" : "days"

	return `${finalDiff} ${unit}`
}

/**
 * Generates the content string for the 'Last Update / Status' column for PRs.
 * @param {object} item The contribution item (Pull Request).
 * @returns {string} HTML content containing the date and bold status (e.g., "2023-10-24<br><strong>MERGED</strong>").
 */
function getPrStatusContent(item) {
	const lastUpdateDate = formatDate(item.date)

	if (item.mergedAt) {
		const mergedAtDate = formatDate(item.mergedAt)
		return `${mergedAtDate}<br><strong>MERGED</strong>`
	}

	const rawPrState = item.state ? item.state.toUpperCase() : "N/A"
	// For non-merged PRs, use the date of the last update/closure
	return `${lastUpdateDate}<br><strong>${rawPrState}</strong>`
}

module.exports = {
	formatDate,
	calculatePeriodInDays,
	getPrStatusContent,
}
