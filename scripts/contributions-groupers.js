/**
 * Groups all contributions by calendar quarter (YYYY-QX).
 * The grouping date for an item is determined by the 'date' property on the item.
 * @param {object} contributions The object containing all contribution lists (pullRequests, issues, etc.).
 * @returns {object} An object where keys are "YYYY-QX" and values are objects containing contribution lists for that quarter.
 */
function groupContributionsByQuarter(contributions) {
	const grouped = {}
	// Iterate over each contribution type (pullRequests, issues, etc.).
	for (const [type, items] of Object.entries(contributions)) {
		// Iterate over each item within the type.
		for (const item of items) {
			const dateStr = item.date
			if (!dateStr) continue

			const dateObj = new Date(dateStr)
			const year = dateObj.getFullYear()
			const month = dateObj.getMonth() + 1
			// Calculate the quarter (1-4).
			const quarter = `Q${Math.floor((month - 1) / 3) + 1}`
			const key = `${year}-${quarter}`

			// Initialize the quarter group if it doesn't exist.
			if (!grouped[key]) {
				grouped[key] = {
					pullRequests: [],
					issues: [],
					reviewedPrs: [],
					coAuthoredPrs: [],
					collaborations: [],
				}
			}
			// Defensive: ensure the target array exists on the grouped object
			if (!grouped[key][type]) {
				grouped[key][type] = []
			}
			// Push the item into the correct quarterly group.
			grouped[key][type].push(item)
		}
	}
	return grouped
}

module.exports = {
	groupContributionsByQuarter,
}
