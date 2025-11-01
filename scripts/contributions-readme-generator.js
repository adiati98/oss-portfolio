const fs = require("fs/promises")
const path = require("path")

// Import configuration
const { BASE_DIR, README_PATH, SINCE_YEAR } = require("./config")

/**
 * Calculates aggregate totals from all contribution data and writes the
 * contributions/README.md file.
 * @param {object} finalContributions The object with all contributions, grouped by type.
 */
async function createStatsReadme(finalContributions) {
	await fs.mkdir(BASE_DIR, { recursive: true })

	// 1. Calculate Totals
	const prCount = finalContributions.pullRequests.length
	const issueCount = finalContributions.issues.length
	const reviewedPrCount = finalContributions.reviewedPrs.length
	const collaborationCount = finalContributions.collaborations.length
	// coAuthoredPrs may not exist in older data; handle defensively
	const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
		? finalContributions.coAuthoredPrs.length
		: 0

	const grandTotal =
		prCount +
		issueCount +
		reviewedPrCount +
		collaborationCount +
		coAuthoredPrCount

	// 2. Calculate Unique Repositories
	const allItems = [
		...finalContributions.pullRequests,
		...finalContributions.issues,
		...finalContributions.reviewedPrs,
		...(Array.isArray(finalContributions.coAuthoredPrs)
			? finalContributions.coAuthoredPrs
			: []),
		...finalContributions.collaborations,
	]
	const uniqueRepos = new Set(allItems.map((item) => item.repo))
	const totalUniqueRepos = uniqueRepos.size

	// 3. Calculate Years Tracked
	const currentYear = new Date().getFullYear()
	const yearsTracked = currentYear - SINCE_YEAR + 1

	// 4. Build Markdown Content
	let markdownContent = `# 📈 My Open Source Contributions Report

Organized by calendar quarter, these reports track my **external open-source involvement**, aggregating key community activities across **Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations**.

---

## Report Structure Breakdown

Each quarterly report file (\`Qx-YYYY.md\` inside the year folders) provides a detailed log and summary for that period:

| Section | Description | Key Metric Tracked |
| :--- | :--- | :--- |
| **Quarterly Statistics** | A high-level summary showing the **Total Contributions** and **Total Repositories** involved in during the quarter. | Total Count, Unique Repositories |
| **Contribution Breakdown** | A table listing the count of contributions for each of the five core categories within that quarter. | Category Counts |
| **Top 3 Repositories** | The top three projects where contributions were made in that quarter, ranked by total count. | Contribution Frequency |
| **Merged PRs** | **(Collapsible Section)** Detailed list of Pull Requests **authored by me** and merged into external repositories. | **Review Period** (Time from creation to merge) |
| **Issues** | **(Collapsible Section)** Detailed list of Issues **authored by me** on external repositories. | **Closing Period** (Time from creation to close) |
| **Reviewed PRs** | **(Collapsible Section)** Detailed list of Pull Requests **reviewed or merged by me** on external repositories. | **My First Review Period** (Time from PR creation to my first review) |
| **Co-Authored PRs** | **(Collapsible Section)** Pull Requests where **I contributed commits (including co-authored commits)** to other contributor's PRs. | **My First Commit Period** (Time from PR creation to my first commit) |
| **Collaborations** | **(Collapsible Section)** Detailed list of open Issues or PRs where I have **commented** to participate in discussion. | **First Commented At** (The date of my initial comment) |

---

## All-Time Aggregate Contribution Summary

This is a summary of all contributions fetched since the initial tracking year (**${SINCE_YEAR}**), providing a quick overview of the portfolio's scale.

### Overall Counts

| Category | Total Count |
| :--- | :--- |
| **All-Time Contributions** | 🚀 **${grandTotal}** |
| Merged PRs | ${prCount} |
| Issues | ${issueCount} |
| Reviewed PRs | ${reviewedPrCount} |
| Co-Authored PRs | ${coAuthoredPrCount} |
| Collaborations | ${collaborationCount} |

### Repository Summary

| Category | Total |
| :--- | :--- |
| **Unique Repositories** | ${totalUniqueRepos} |
| **Years Tracked** | ${yearsTracked} |
`

	// 5. Write the file
	await fs.writeFile(README_PATH, markdownContent, "utf8")
	console.log(`Written aggregate README: ${README_PATH}`)
}

module.exports = {
	createStatsReadme,
}