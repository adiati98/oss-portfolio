const path = require("path")
const fs = require("fs/promises")
const axios = require("axios")

// --- Configuration Variables ---
// Change these values to match your GitHub profile and history.
const GITHUB_USERNAME = "adiati98" //Change this to your GitHub username
const SINCE_YEAR = 2019 //Change this to the first year of your contribution
const BASE_URL = "https://api.github.com"

/**
 * Fetches all contribution data from the GitHub API for a given year range.
 * This includes Pull Requests, Issues, Reviewed PRs, and Collaborations.
 * It handles pagination and API rate limiting.
 * @param {number} startYear The year to begin fetching contributions from.
 * @param {Set<string>} prCache A set of PR URLs that have already been processed to avoid redundant work.
 * @returns {Promise<{contributions: object, prCache: Set<string>}>} An object containing the fetched contributions and the updated cache.
 */
async function fetchContributions(startYear, prCache) {
	// Ensure the GitHub token is available from the environment variables.
	const token = process.env.GITHUB_TOKEN
	if (!token) {
		throw new Error("GITHUB_TOKEN is not set.")
	}

	// Create an Axios instance with base URL and authentication headers.
	const axiosInstance = axios.create({
		baseURL: BASE_URL,
		headers: {
			Authorization: `token ${token}`,
			Accept: "application/vnd.github.v3+json",
		},
	})

	// Initialize objects to store the fetched data and track seen URLs to prevent duplicates.
	const contributions = {
		pullRequests: [],
		issues: [],
		reviewedPrs: [],
		collaborations: [],
	}

	const seenUrls = {
		pullRequests: new Set(),
		issues: new Set(),
		reviewedPrs: new Set(),
		collaborations: new Set(),
	}

	const currentYear = new Date().getFullYear()

	// Loop through each year from the start year to the current year.
	for (let year = startYear; year <= currentYear; year++) {
		console.log(`Fetching contributions for year: ${year}...`)
		// Define the start and end dates for the year to use in API queries.
		const yearStart = `${year}-01-01T00:00:00Z`
		const yearEnd = `${year + 1}-01-01T00:00:00Z`

		/**
		 * A helper function to fetch all pages for a given search query.
		 * GitHub's search API is paginated, so this handles fetching all results.
		 * It also includes logic to handle API rate limits by waiting for 60 seconds if a 403 error is received.
		 * @param {string} query The GitHub search query string.
		 * @returns {Promise<Array<object>>} An array of all results from the search.
		 */
		async function getAllPages(query) {
			let results = []
			let page = 1
			while (true) {
				try {
					const response = await axiosInstance.get(
						`/search/issues?q=${query}&per_page=100&page=${page}`
					)
					results.push(...response.data.items)

					// Check for a 'next' page link in the headers.
					const linkHeader = response.headers.link
					if (linkHeader && linkHeader.includes('rel="next"')) {
						page++
					} else {
						break
					}
					// Pause between requests
					await new Promise((resolve) => setTimeout(resolve, 1000))
				} catch (err) {
					// Handle rate limit errors (status code 403).
					if (err.response && err.response.status === 403) {
						console.log("Rate limit hit. Waiting for 60 seconds...")
						await new Promise((resolve) => setTimeout(resolve, 60000))
						continue // Retry the same page after waiting.
					} else {
						throw err // Re-throw other errors.
					}
				}
			}
			return results
		}

		// --- Fetch Pull Requests authored by the user and merged in the given year ---
		const prs = await getAllPages(
			`is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd}`
		)

		for (const pr of prs) {
			// 1. Check if the PR is already in the long-term cache.
			if (prCache.has(pr.html_url)) {
				console.log(`Skipping cached PR: ${pr.html_url}`)
				continue // If it's cached, skip to the next PR.
			}

			// Extract repository owner.
			const repoParts = new URL(pr.repository_url).pathname.split("/")
			const owner = repoParts[repoParts.length - 2]
			const repoName = repoParts[repoParts.length - 1]

			// 2. Check if the PR is from your own repo.
			if (owner === GITHUB_USERNAME) {
				// Log and add to the cache. We don't want to list these.
				console.log(`Caching new PR from own repo: ${pr.html_url}`)
				prCache.add(pr.html_url)
				continue
			}

			// 3. For an external PR, add it to the cache and log it.
			prCache.add(pr.html_url)
			console.log(`Caching new PR from other repo: ${pr.html_url}`)

			// 4. Check the temporary, in-run cache to avoid processing the same PR twice within this run.
			if (seenUrls.pullRequests.has(pr.html_url)) {
				continue
			}

			// 5. Process the PR and add it to the final contributions list.
			contributions.pullRequests.push({
				title: pr.title,
				url: pr.html_url,
				repo: `${owner}/${repoName}`,
				description: pr.body || "No description provided.",
				date: pr.created_at,
			})
			// Add the URL to the seen set for this run.
			seenUrls.pullRequests.add(pr.html_url)
		}

		// --- Fetch Issues authored by the user on other people's repositories ---
		const issues = await getAllPages(
			`is:issue author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME} created:>=${yearStart} created:<${yearEnd}`
		)
		for (const issue of issues) {
			if (seenUrls.issues.has(issue.html_url)) {
				continue
			}
			const repoParts = new URL(issue.repository_url).pathname.split("/")
			const owner = repoParts[repoParts.length - 2]
			const repoName = repoParts[repoParts.length - 1]
			contributions.issues.push({
				title: issue.title,
				url: issue.html_url,
				repo: `${owner}/${repoName}`,
				description: issue.body || "No description provided.",
				date: issue.created_at,
			})
			seenUrls.issues.add(issue.html_url)
		}

		// --- Fetch Reviewed PRs (PRs reviewed, merged, or closed by the user) ---
		// Note: The GitHub search API doesn't support multiple 'closed-by' or 'merged-by' filters,
		// so we combine multiple queries and deduplicate the results.
		const reviewedByPrs = await getAllPages(
			`is:pr reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
		)
		const mergedByPrs = await getAllPages(
			`is:pr merged-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
		)
		const closedByPrs = await getAllPages(
			`is:pr is:closed -author:${GITHUB_USERNAME} closed-by:${GITHUB_USERNAME} commenter:${GITHUB_USERNAME} closed:>=${yearStart} closed:<${yearEnd}`
		)

		const combinedResults = [...reviewedByPrs, ...mergedByPrs, ...closedByPrs]
		const uniqueReviewedPrs = new Set()

		for (const pr of combinedResults) {
			const prDate = new Date(pr.updated_at)
			const yearStartDate = new Date(yearStart)
			const yearEndDate = new Date(yearEnd)

			if (prDate >= yearStartDate && prDate < yearEndDate) {
				if (uniqueReviewedPrs.has(pr.html_url)) {
					continue
				}
				const repoParts = new URL(pr.repository_url).pathname.split("/")
				const owner = repoParts[repoParts.length - 2]
				const repoName = repoParts[repoParts.length - 1]
				contributions.reviewedPrs.push({
					title: pr.title,
					url: pr.html_url,
					repo: `${owner}/${repoName}`,
					description: pr.body || "No description provided.",
					date: pr.updated_at,
				})
				uniqueReviewedPrs.add(pr.html_url)
			}
		}

		// --- Fetch Collaborations (PRs/Issues commented on by the user) ---
		const collaborationsPrs = await getAllPages(
			`is:pr is:open commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -reviewed-by:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
		)
		const collaborationsIssues = await getAllPages(
			`is:issue commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
		)

		const allCollaborations = [...collaborationsPrs, ...collaborationsIssues]

		for (const item of allCollaborations) {
			// Skip collaborations that have already been reviewed or seen.
			if (
				seenUrls.collaborations.has(item.html_url) ||
				uniqueReviewedPrs.has(item.html_url)
			) {
				continue
			}
			const repoParts = new URL(item.repository_url).pathname.split("/")
			const owner = repoParts[repoParts.length - 2]
			const repoName = repoParts[repoParts.length - 1]
			contributions.collaborations.push({
				title: item.title,
				url: item.html_url,
				repo: `${owner}/${repoName}`,
				description: item.body || "No description provided.",
				date: item.updated_at,
			})
			seenUrls.collaborations.add(item.html_url)
		}
	}

	return { contributions, prCache }
}

/**
 * Groups the fetched contributions by calendar quarter.
 * @param {object} contributions The object containing all contribution data.
 * @returns {object} A new object with contributions grouped by 'YYYY-Qq' keys.
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
					collaborations: [],
				}
			}
			// Push the item into the correct quarterly group.
			grouped[key][type].push(item)
		}
	}
	return grouped
}

/**
 * Writes the grouped contribution data to Markdown files, one for each quarter.
 * @param {object} groupedContributions The object with contributions grouped by quarter.
 */
async function writeMarkdownFiles(groupedContributions) {
	const baseDir = "contributions"
	// Create the base contributions directory if it's doesn't exist.
	await fs.mkdir(baseDir, { recursive: true })

	// Iterate over each quarter's worth of data.
	for (const [key, data] of Object.entries(groupedContributions)) {
		const [year, quarter] = key.split("-")
		const yearDir = path.join(baseDir, year)
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
			pullRequests: "Merged PRs",
			issues: "Issues",
			reviewedPrs: "Reviewed PRs",
			collaborations: "Collaborations",
		}

		// Loop through each contribution type to create a collapsible section.
		for (const [section, title] of Object.entries(sections)) {
			const items = data[section]

			markdownContent += `<details>\n`
			markdownContent += `  <summary><h2>${title}</h2></summary>\n`

			// Check if there are any contributions for this section.
			if (!items || items.length === 0) {
				markdownContent += `No contribution in this quarter.\n`
			} else {
				// If there are items, build an HTML table.
				markdownContent += `<table style='width:100%; table-layout:fixed;'>\n`
				markdownContent += `  <thead>\n`
				markdownContent += `    <tr>\n`
				markdownContent += `      <th style='width:5%;'>No.</th>\n`
				markdownContent += `      <th style='width:20%;'>Project Name</th>\n`
				markdownContent += `      <th style='width:20%;'>Title</th>\n`
				markdownContent += `      <th style='width:35%;'>Description</th>\n`
				markdownContent += `      <th style='width:20%;'>Date</th>\n`
				markdownContent += `    </tr>\n`
				markdownContent += `  </thead>\n`
				markdownContent += `  <tbody>\n`

				let counter = 1
				// Loop through each item to create a table row.
				for (const item of items) {
					const dateObj = new Date(item.date)
					const formattedDate = dateObj.toISOString().split("T")[0]

					// Sanitize the description to escape HTML characters that could break the table layout.
					const sanitizedDescription = item.description
						? item.description
								.replace(/\r/g, "")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;")
								.replace(/"/g, "&quot;")
								.replace(/'/g, "&#39;")
								.replace(/\n/g, "<br>")
						: "No description provided."

					markdownContent += `    <tr>\n`
					markdownContent += `      <td>${counter++}.</td>\n`
					markdownContent += `      <td>${item.repo}</td>\n`
					markdownContent += `      <td><a href='${item.url}'>${item.title}</a></td>\n`
					markdownContent += `      <td>${sanitizedDescription}</td>\n`
					markdownContent += `      <td>${formattedDate}</td>\n`
					markdownContent += `    </tr>\n`
				}

				markdownContent += `  </tbody>\n`
				markdownContent += `</table>\n`
			}

			markdownContent += `</details>\n\n`
		}

		// Write the final Markdown content to the file.
		await fs.writeFile(filePath, markdownContent, "utf8")
		console.log(`Written file: ${filePath}`)
	}
}

/**
 * The main function to run the entire process.
 * It handles loading and saving the cache, determining the sync start year,
 * and orchestrating the data fetching, grouping, and file writing.
 */
async function main() {
	const cacheFile = "pr_cache.json"
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

	try {
		const baseDir = "contributions"
		const currentYear = new Date().getFullYear()
		let startYearToFetch = SINCE_YEAR

		// Check if the 'contributions' directory exists.
		try {
			await fs.access(baseDir)
			console.log("Contributions folder found.")

			const currentYearDir = path.join(baseDir, currentYear.toString())
			let isPreviousQuartersComplete = true

			// Check if the current year's directory exists.
			try {
				await fs.access(currentYearDir)
				const currentMonth = new Date().getMonth()
				const currentQuarter = Math.floor(currentMonth / 3) + 1

				// Check for existing files for previous quarters of the current year.
				// This helps to determine if a full re-sync is needed for the current year.
				for (let q = 1; q < currentQuarter; q++) {
					const quarterFile = path.join(
						currentYearDir,
						`Q${q}-${currentYear}.md`
					)
					try {
						const stats = await fs.stat(quarterFile)
						if (stats.size === 0) {
							isPreviousQuartersComplete = false
							break
						}
					} catch (e) {
						if (e.code === "ENOENT") {
							isPreviousQuartersComplete = false
							break
						}
					}
				}
			} catch (e) {
				if (e.code === "ENOENT") {
					isPreviousQuartersComplete = false
				} else {
					throw e
				}
			}

			// Set the start year for the fetch based on whether previous data is complete.
			if (isPreviousQuartersComplete) {
				console.log(
					`Previous quarters' data is up to date. Starting sync for ${currentYear}.`
				)
				startYearToFetch = currentYear
			} else {
				console.log(
					`Current year data is incomplete. Starting sync for ${currentYear}.`
				)
				startYearToFetch = currentYear
			}
		} catch (e) {
			// If the base directory doesn't exist, run a full sync from the configured SINCE_YEAR.
			if (e.code === "ENOENT") {
				console.log(
					`Contributions folder not found. Running full sync from ${SINCE_YEAR}.`
				)
			} else {
				throw e
			}
		}

		console.log(`Starting data fetch from year: ${startYearToFetch}`)
		// Call the main functions to fetch, group, and write the data.
		const { contributions, prCache: updatedPrCache } = await fetchContributions(
			startYearToFetch,
			prCache
		)
		const grouped = groupContributionsByQuarter(contributions)
		await writeMarkdownFiles(grouped)

		// Save the updated cache to a file for future runs.
		await fs.writeFile(
			cacheFile,
			JSON.stringify(Array.from(updatedPrCache)),
			"utf8"
		)
		console.log("Updated PR cache saved to file.")

		console.log("Contributions update completed successfully.")
	} catch (e) {
		// Handle any top-level errors that occur during the process.
		console.error(`Failed to update contributions: ${e.message}`)
		process.exit(1)
	}
}
// Start the main execution.
main()
