const path = require("path")
const fs = require("fs/promises")

// Import configuration (SINCE_YEAR is needed here)
const { SINCE_YEAR, BASE_DIR, README_PATH } = require("./config")

// Import core fetching logic
const { fetchContributions } = require("./github-api-fetchers")

// Import grouping
const { groupContributionsByQuarter } = require("./contributions-groupers")

/**
 * Writes the grouped contribution data to Markdown files, one for each quarter.
 * @param {object} groupedContributions The object with contributions grouped by quarter.
 */
async function writeMarkdownFiles(groupedContributions) {
	// Create the base contributions directory if it's doesn't exist.
	await fs.mkdir(BASE_DIR, { recursive: true })

	// Iterate over each quarter's worth of data.
	for (const [key, data] of Object.entries(groupedContributions)) {
		const [year, quarter] = key.split("-")
		const yearDir = path.join(BASE_DIR, year)
		await fs.mkdir(yearDir, { recursive: true })

		const filePath = path.join(yearDir, `${quarter}-${year}.md`)
		// Calculate the total number of contributions for the quarter.
		const totalContributions = Object.values(data).reduce(
			(sum, arr) => sum + arr.length,
			0
		)

		// Skip writing the file if there are no contributions for this quarter.
		if (totalContributions === 0) {
			console.log(`Skipping empty quarter: ${key}`)
			continue
		}

		// --- Calculate additional statistics ---
		const allItems = [
			...data.pullRequests,
			...data.issues,
			...data.reviewedPrs,
			...data.coAuthoredPrs,
			...data.collaborations,
		]
		const uniqueRepos = new Set(allItems.map((item) => item.repo))
		const totalRepos = uniqueRepos.size

		const repoCounts = allItems.reduce((acc, item) => {
			acc[item.repo] = (acc[item.repo] || 0) + 1
			return acc
		}, {})

		const sortedRepos = Object.entries(repoCounts).sort(([, a], [, b]) => b - a)
		const top3Repos = sortedRepos.slice(0, 3)

		// --- Start building the Markdown content with a main header ---
		let markdownContent = `# ${quarter} ${year}\n`

		markdownContent += `
## 📊 Quarterly Statistics

* **Total Contributions:** ${totalContributions}
* **Total Repositories:** ${totalRepos}

### Contribution Breakdown

| Type | Count |
| :--- | :--- |
| Merged PRs | ${data.pullRequests.length} |
| Issues | ${data.issues.length} |
| Reviewed PRs | ${data.reviewedPrs.length} |
| Co-Authored PRs | ${data.coAuthoredPrs.length} |
| Collaborations | ${data.collaborations.length} |

### Top 3 Repositories
`

		if (top3Repos.length > 0) {
			top3Repos.forEach((item, index) => {
				// Add the repository URL to the Markdown output
				const repoUrl = `https://github.com/${item[0]}`
				markdownContent += `
${index + 1}. [**${item[0]}**](${repoUrl}) (${item[1]} contributions)`
			})
			markdownContent += `\n`
		}

		// --- ADD HORIZONTAL BREAK ---
		markdownContent += `
---

`

		const sections = {
			pullRequests: {
				title: "Merged PRs",
				headers: [
					"No.",
					"Project Name",
					"Title",
					"Created At",
					"Merged At",
					"Review Period",
				],
				widths: ["5%", "20%", "30%", "15%", "15%", "15%"],
				keys: ["repo", "title", "date", "mergedAt", "reviewPeriod"],
			},
			issues: {
				title: "Issues",
				headers: [
					"No.",
					"Project Name",
					"Title",
					"Created At",
					"Closed At",
					"Closing Period",
				],
				widths: ["5%", "25%", "35%", "15%", "15%", "10%"],
				keys: ["repo", "title", "date", "closedAt", "closingPeriod"],
			},
			reviewedPrs: {
				title: "Reviewed PRs",
				headers: [
					"No.",
					"Project Name",
					"Title",
					"Created At",
					"My First Review",
					"My First Review Period",
					"Last Update / Status",
				],
				widths: ["5%", "20%", "28%", "10%", "15%", "10%", "14%"],
				keys: [
					"repo",
					"title",
					"createdAt",
					"myFirstReviewDate",
					"myFirstReviewPeriod",
					"date",
				],
			},
			coAuthoredPrs: {
				title: "Co-Authored PRs",
				headers: [
					"No.",
					"Project Name",
					"Title",
					"Created At",
					"My First Commit",
					"My First Commit Period",
					"Last Update / Status",
				],
				widths: ["5%", "15%", "25%", "10%", "12%", "13%", "20%"],
				keys: [
					"repo",
					"title",
					"createdAt",
					"firstCommitDate",
					"firstCommitPeriod",
					"date",
				],
			},
			collaborations: {
				title: "Collaborations",
				headers: ["No.", "Project Name", "Title", "Created At", "Commented At"],
				widths: ["5%", "30%", "35%", "15%", "15%"],
				keys: ["repo", "title", "createdAt", "date"],
			},
		}

		// Loop through each contribution type to create a collapsible section.
		for (const [section, sectionInfo] of Object.entries(sections)) {
			const items = data[section]

			markdownContent += `<details>\n`
			markdownContent += ` <summary><h2>${sectionInfo.title}</h2></summary>\n`

			if (!items || items.length === 0) {
				markdownContent += `No contribution in this quarter.\n`
			} else {
				// Build the HTML table as a single string
				let tableContent = `<table style='width:100%; table-layout:fixed;'>\n`
				tableContent += `  <thead>\n`
				tableContent += `    <tr>\n`
				for (let i = 0; i < sectionInfo.headers.length; i++) {
					tableContent += `      <th style='width:${sectionInfo.widths[i]};'>${sectionInfo.headers[i]}</th>\n`
				}
				tableContent += `    </tr>\n`
				tableContent += `  </thead>\n`
				tableContent += `  <tbody>\n`

				let counter = 1
				for (const item of items) {
					tableContent += `    <tr>\n`
					tableContent += `      <td>${counter++}.</td>\n`
					tableContent += `      <td>${item.repo}</td>\n`
					tableContent += `      <td><a href='${item.url}'>${item.title}</a></td>\n`

					if (section === "pullRequests") {
						const createdAt = new Date(item.createdAt)
							.toISOString()
							.split("T")[0]
						const mergedAt = item.mergedAt
							? new Date(item.mergedAt).toISOString().split("T")[0]
							: "N/A"
						const reviewPeriod = item.mergedAt
							? `${item.reviewPeriod} days`
							: "N/A"
						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${mergedAt}</td>\n`
						tableContent += `      <td>${reviewPeriod}</td>\n`
					} else if (section === "issues") {
						const createdAt = new Date(item.date).toISOString().split("T")[0]
						const closedAt = item.closedAt
							? new Date(item.closedAt).toISOString().split("T")[0]
							: "N/A"
						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${closedAt}</td>\n`
						tableContent += `      <td>${
							item.closingPeriod === "Open"
								? "Open"
								: `${item.closingPeriod} days`
						}</td>\n`
					} else if (section === "reviewedPrs") {
						const createdAt = new Date(item.createdAt)
							.toISOString()
							.split("T")[0]

						const lastUpdateDate = new Date(item.date)
							.toISOString()
							.split("T")[0]

						const rawPrState = item.state ? item.state.toUpperCase() : "N/A"
						const displayState = item.mergedAt ? "MERGED" : rawPrState
						const lastUpdateContent = `${lastUpdateDate}<br><strong>${displayState}</strong>`

						const myFirstReviewAt = item.myFirstReviewDate
							? new Date(item.myFirstReviewDate).toISOString().split("T")[0]
							: "N/A"
						const myFirstReviewPeriod = item.myFirstReviewPeriod || "N/A"

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${myFirstReviewAt}</td>\n`
						tableContent += `      <td>${myFirstReviewPeriod}</td>\n`
						tableContent += `      <td>${lastUpdateContent}</td>\n`
					} else if (section === "coAuthoredPrs") {
						const createdAt = new Date(item.createdAt)
							.toISOString()
							.split("T")[0]
						const firstCommitAt = item.firstCommitDate
							? new Date(item.firstCommitDate).toISOString().split("T")[0]
							: "N/A"

						// First commit period (from created to first commit)
						// Calculate the period if it's not already stored
						const firstCommitPeriod =
							item.firstCommitPeriod ||
							(item.firstCommitDate && item.createdAt
								? Math.round(
										(new Date(item.firstCommitDate) -
											new Date(item.createdAt)) /
											(1000 * 60 * 60 * 24)
								  ) +
								  (Math.round(
										(new Date(item.firstCommitDate) -
											new Date(item.createdAt)) /
											(1000 * 60 * 60 * 24)
								  ) === 0
										? " day"
										: " days")
								: "N/A")

						// Status with dates
						let lastUpdateContent = ""
						const lastUpdateDate = new Date(item.date)
							.toISOString()
							.split("T")[0]

						if (item.mergedAt) {
							const mergedAtDate = new Date(item.mergedAt)
								.toISOString()
								.split("T")[0]
							lastUpdateContent = `${mergedAtDate}<br><strong>MERGED</strong>`
						} else if (item.state === "closed") {
							lastUpdateContent = `${lastUpdateDate}<br><strong>CLOSED</strong>`
						} else {
							const stateUpper = item.state ? item.state.toUpperCase() : "N/A"
							lastUpdateContent = `${lastUpdateDate}<br><strong>${stateUpper}</strong>`
						}

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${firstCommitAt}</td>\n`
						tableContent += `      <td>${firstCommitPeriod}</td>\n`
						tableContent += `      <td>${lastUpdateContent}</td>\n`
					} else if (section === "collaborations") {
						const createdAt = new Date(item.createdAt)
							.toISOString()
							.split("T")[0]
						const commentedAt = item.firstCommentedAt
							? new Date(item.firstCommentedAt).toISOString().split("T")[0]
							: "N/A"
						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${commentedAt}</td>\n`
					}

					tableContent += `    </tr>\n`
				}

				tableContent += `  </tbody>\n`
				tableContent += `</table>\n`

				// Add the finished table string to the markdown content
				markdownContent += tableContent
			}

			markdownContent += `</details>\n\n`
		}

		// Write the final Markdown content to the file.
		await fs.writeFile(filePath, markdownContent, "utf8")
		console.log(`Written file: ${filePath}`)
	}
}

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

This folder contains automatically generated reports of my external open-source contributions, organized by calendar quarter.

These reports track my **external open-source involvement**, aggregating key community activities across **Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations**.

---

## Report Structure Breakdown

Each quarterly report file (\`Qx-YYYY.md\` inside the year folders) provides a detailed log and summary for that period:

| Section | Description | Key Metric Tracked |
| :--- | :--- | :--- |
| **Quarterly Statistics** | A high-level summary showing the **Total Contributions** and **Total Repositories** involved in during the quarter. | Total Count, Unique Repositories |
| **Contribution Breakdown** | A table listing the count of contributions for each of the four core categories within that quarter. | Category Counts |
| **Top 3 Repositories** | The top three projects where contributions were made in that quarter, ranked by total count. | Contribution Frequency |
| **Merged PRs** | **(Collapsible Section)** Detailed list of Pull Requests **authored by me** and merged into external repositories. | **Review Period** (Time from creation to merge) |
| **Issues** | **(Collapsible Section)** Detailed list of Issues **authored by me** on external repositories. | **Closing Period** (Time from creation to close) |
| **Reviewed PRs** | **(Collapsible Section)** Detailed list of Pull Requests **reviewed or merged by me** on external repositories. | **My First Review Period** (Time from PR creation to my first review) |
| **Co-Authored PRs** | **(Collapsible Section)** Pull Requests where I contributed commits (including co-authored commits) to other people's PRs. | **My First Commit Period** (Time from PR creation to my first commit) |
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

/**
 * The main function to run the entire process.
 * It handles loading and saving the cache, determining the sync start year,
 * and orchestrating the data fetching, grouping, and file writing.
 */
async function main() {
	// Define the data directory path.
	const dataDir = "data"
	// Ensure the data directory exists before trying to read from or write to it.
	await fs.mkdir(dataDir, { recursive: true })

	// Use the path module to correctly build the file paths.
	const cacheFile = path.join(dataDir, "pr-cache.json")
	const dataFile = path.join(dataDir, "all-contributions.json")

	let prCache = new Set()

	// Try to load the cache from a JSON file.
	try {
		const cacheData = await fs.readFile(cacheFile, "utf8")
		prCache = new Set(JSON.parse(cacheData))
		console.log("Loaded PR cache from file.")
	} catch (e) {
		// If the file doesn't exist, we'll start with an empty cache.
		if (e.code !== "ENOENT") {
			console.error("Failed to load PR cache:", e)
		}
	}

	// Load persistent commit cache (if present) so we don't re-query PR commits repeatedly
	const commitCacheFile = path.join(dataDir, "commit-cache.json")
	let commitCacheFromDisk = new Map()
	try {
		const commitCacheData = await fs.readFile(commitCacheFile, "utf8")
		const parsed = JSON.parse(commitCacheData)
		// parsed expected to be an object mapping prUrlKey -> { firstCommitDate, commitCount } or null
		for (const [k, v] of Object.entries(parsed)) {
			commitCacheFromDisk.set(k, v)
		}
		console.log("Loaded commit cache from file.")
	} catch (e) {
		if (e.code !== "ENOENT") {
			console.error("Failed to load commit cache:", e)
		} else {
			console.log("No persistent commit cache found, starting fresh.")
		}
	}

	try {
		let allContributions = {}

		// Try to load the full contributions data from a JSON file.
		try {
			const data = await fs.readFile(dataFile, "utf8")
			allContributions = JSON.parse(data)
			console.log("Loaded existing contributions data.")

		} catch (e) {
			if (e.code !== "ENOENT") {
				console.error("Failed to load contributions data:", e)
			} else {
				console.log("No existing data file found. Starting fresh.")
			}
		}

		// Determine optimal fetch strategy based on last update time
		const cacheStats = await fs.stat(dataFile).catch(() => null)
		const lastUpdate = cacheStats ? new Date(cacheStats.mtime) : null
		const today = new Date()

		let fetchStartYear =
			typeof SINCE_YEAR !== "undefined" ? SINCE_YEAR : today.getFullYear() - 1 // Default to last year if SINCE_YEAR is not available

		if (!lastUpdate) {
			fetchStartYear =
				typeof SINCE_YEAR !== "undefined" ? SINCE_YEAR : fetchStartYear
			console.log("First run - fetching all contributions")
		} else {
			const lastUpdateYear = lastUpdate.getFullYear()
			const lastUpdateMonth = lastUpdate.getMonth()
			const currentYear = today.getFullYear()
			const currentMonth = today.getMonth()

			const sameMonth =
				lastUpdateMonth === currentMonth && lastUpdateYear === currentYear
			// Check if last update was exactly the previous month
			const previousMonth =
				lastUpdateMonth === (currentMonth - 1 + 12) % 12 &&
				(lastUpdateYear === currentYear ||
					(lastUpdateYear === currentYear - 1 && currentMonth === 0))

			if (sameMonth) {
				fetchStartYear = currentYear
				console.log("Recent update - fetching only current year")
			} else if (previousMonth) {
				fetchStartYear = currentYear - 1
				console.log("Last month update - fetching last two years")
			} else {
				fetchStartYear =
					typeof SINCE_YEAR !== "undefined" ? SINCE_YEAR : fetchStartYear
				console.log("Older update - fetching all years")
			}
		}

		console.log(`Fetching contributions from year: ${fetchStartYear}`)

		// Fetch new contributions and update the cache.
		// Merge the persistent commit cache into an in-memory Map and pass it into the fetcher
		const mergedCommitCache = new Map()
		for (const [k, v] of commitCacheFromDisk) mergedCommitCache.set(k, v)

		const {
			contributions: newContributions,
			prCache: updatedPrCache,
			commitCache: usedCommitCache,
		} = await fetchContributions(fetchStartYear, prCache, mergedCommitCache)

		// Second pass: merge new contributions and existing ones, preserving all contribution types
		let finalContributions = {
			pullRequests: [],
			issues: [],
			reviewedPrs: [],
			coAuthoredPrs: [],
			collaborations: [],
		}

		// Keep track of URLs for each category separately for in-memory deduplication
		const categorySeenUrls = {
			pullRequests: new Set(),
			issues: new Set(),
			reviewedPrs: new Set(),
			coAuthoredPrs: new Set(),
			collaborations: new Set(),
		}

		// Helper to add/update an item in its correct final category,
		// respecting the independence of categories.
		const addOrUpdateItem = (item, type) => {
			// Only proceed if the type is one we track
			if (!finalContributions[type]) return

			// Check if the item already exists in this specific category array
			const existingIndex = finalContributions[type].findIndex(
				(i) => i.url === item.url
			)

			if (existingIndex !== -1) {
				// If it exists, update the existing entry (e.g., status changed on re-fetch)
				finalContributions[type][existingIndex] = item
			} else {
				// If it's a new URL for this category, add it and mark as seen
				finalContributions[type].push(item)
				categorySeenUrls[type].add(item.url)
			}
		}

		// --- 1. Load Existing Contributions (Preserve all categories) ---
		console.log("Preserving existing contributions by category.")

		for (const type of Object.keys(finalContributions)) {
			if (Array.isArray(allContributions[type])) {
				for (const item of allContributions[type]) {
					// We only add existing items here; updates will happen from newContributions later.
					if (!categorySeenUrls[type].has(item.url)) {
						finalContributions[type].push(item)
						categorySeenUrls[type].add(item.url)
					}
				}
			}
		}

		// --- 2. Add/Update Newly Fetched Contributions ---
		console.log("Merging newly fetched contributions.")

		for (const type of Object.keys(newContributions)) {
			if (Array.isArray(newContributions[type])) {
				for (const item of newContributions[type]) {
					// New items must be added or updated, ensuring the latest data is used.
					addOrUpdateItem(item, type)
				}
			}
		}

		// --- 3. Sort each category by date (The original sort logic remains) ---
		for (const type of Object.keys(finalContributions)) {
			finalContributions[type].sort(
				(a, b) => new Date(b.date) - new Date(a.date)
			)
		}

		console.log(
			"Merged and categorized all contributions based on latest status."
		)

		// Save the updated, full contributions data to a new JSON file
		await fs.writeFile(
			dataFile,
			JSON.stringify(finalContributions, null, 2),
			"utf8"
		)
		console.log("Updated contributions data saved to file.")

		const grouped = groupContributionsByQuarter(finalContributions)
		await writeMarkdownFiles(grouped)
		await createStatsReadme(finalContributions)

		// Save the updated PR cache to a file for future runs.
		await fs.writeFile(
			cacheFile,
			JSON.stringify(Array.from(updatedPrCache)),
			"utf8"
		)
		console.log("Updated PR cache saved to file.")

		// Persist the commit cache to disk so future runs reuse it and save API calls.
		try {
			const obj = {}
			for (const [k, v] of usedCommitCache || mergedCommitCache) {
				obj[k] = v
			}
			await fs.writeFile(commitCacheFile, JSON.stringify(obj, null, 2), "utf8")
			console.log("Persisted commit cache to file.")
		} catch (e) {
			console.error("Failed to persist commit cache:", e)
		}

		console.log("Contributions update completed successfully.")
	} catch (e) {
		// Handle any top-level errors that occur during the process.
		console.error(`Failed to update contributions: ${e.message}`)
		process.exit(1)
	}
}
// Start the main execution.
main()
