require("dotenv").config()

const path = require("path")
const fs = require("fs/promises")
const axios = require("axios")

// --- Configuration Variables ---
// Change these values to match your GitHub profile and history.
const GITHUB_USERNAME = "adiati98" //Change this to your GitHub username
const SINCE_YEAR = 2019 //Change this to the first year of your contribution
const BASE_URL = "https://api.github.com"

// --- Configuration to generate README in the contributions folder ---
const BASE_DIR = "contributions"
const README_PATH = path.join(BASE_DIR, "README.md")

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

	/**
	 * Fetches the date of the user's first review on a given pull request.
	 * @param {string} owner The repository owner.
	 * @param {string} repo The repository name.
	 * @param {number} prNumber The pull request number.
	 * @param {string} username The username to filter by.
	 * @returns {Promise<string|null>} The date of the user's first review, or null if none is found.
	 */
	async function getPrMyFirstReviewDate(owner, repo, prNumber, username) {
		try {
			const response = await axiosInstance.get(
				`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
			)
			// Filter for reviews by the specified user and sort chronologically.
			const myReviews = response.data
				.filter((review) => review.user.login === username)
				.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
			// The first review in the sorted list is the user's first review.
			if (myReviews.length > 0) {
				return myReviews[0].submitted_at
			}
			return null
		} catch (err) {
			if (
				err.response &&
				(err.response.status === 403 || err.response.status === 404)
			) {
				return null
			}
			throw err
		}
	}

	/**
	 * Fetches the date of the user's first comment on an issue or PR.
	 * @param {string} url The comments URL for the issue or PR.
	 * @param {string} username The username to filter comments by.
	 * @returns {Promise<string|null>} The date of the user's first comment, or null if none is found.
	 */
	async function getFirstCommentDate(url, username) {
		try {
			let page = 1
			while (true) {
				const response = await axiosInstance.get(
					`${url}?per_page=100&page=${page}`
				)
				const myFirstComment = response.data.find(
					(comment) => comment.user.login === username
				)
				if (myFirstComment) {
					return myFirstComment.created_at
				}
				const linkHeader = response.headers.link
				if (linkHeader && linkHeader.includes('rel="next"')) {
					page++
				} else {
					return null // No more pages and no comment found.
				}
			}
		} catch (err) {
			if (
				err.response &&
				(err.response.status === 403 || err.response.status === 404)
			) {
				return null
			}
			throw err
		}
	}

	// Loop through each year from the start year to the current year.
	for (let year = startYear; year <= currentYear; year++) {
		console.log(`Fetching contributions for year: ${year}...`)
		// Define the start and end dates for the year to use in API queries.
		const yearStart = `${year}-01-01T00:00:00Z`
		const yearEnd = `${year + 1}-01-01T00:00:00Z`

		// --- Fetch Pull Requests authored by the user and merged in the given year ---
		const prs = await getAllPages(
			`is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd}`
		)

		for (const pr of prs) {
			// 1. Check if the PR is already in the long-term cache.
			if (prCache.has(pr.html_url)) {
				continue // If it's cached, skip to the next PR.
			}

			// Extract repository owner.
			const repoParts = new URL(pr.repository_url).pathname.split("/")
			const owner = repoParts[repoParts.length - 2]
			const repoName = repoParts[repoParts.length - 1]

			// 2. Check if the PR is from your own repo.
			if (owner === GITHUB_USERNAME) {
				// Log and add to the cache. We don't want to list these.
				prCache.add(pr.html_url)
				continue
			}

			// 3. For an external PR, add it to the cache and log it.
			prCache.add(pr.html_url)

			// 4. Check the temporary, in-run cache to avoid processing the same PR twice within this run.
			if (seenUrls.pullRequests.has(pr.html_url)) {
				continue
			}

			// 5. Process the PR and add it to the final contributions list.
			contributions.pullRequests.push({
				title: pr.title,
				url: pr.html_url,
				repo: `${owner}/${repoName}`,
				date: pr.created_at,
				mergedAt: pr.pull_request.merged_at,
				reviewPeriod: Math.round(
					(new Date(pr.pull_request.merged_at) - new Date(pr.created_at)) /
						(1000 * 60 * 60 * 24)
				),
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

			const closingPeriod =
				issue.state === "closed"
					? Math.round(
							(new Date(issue.closed_at) - new Date(issue.created_at)) /
								(1000 * 60 * 60 * 24)
					  )
					: "Open"

			contributions.issues.push({
				title: issue.title,
				url: issue.html_url,
				repo: `${owner}/${repoName}`,
				date: issue.created_at,
				closedAt: issue.closed_at,
				closingPeriod,
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
			// --- Check if repository is private ---
			if (pr.private) {
				console.log(`Skipping private repository PR: ${pr.html_url}`)
				prCache.add(pr.html_url)
				continue // Skip to the next PR
			}

			// Skip any PRs created by a bot.
			if (pr.user && pr.user.type === "Bot") {
				// Store the bot-authored PR in the cache to avoid future fetching.
				prCache.add(pr.html_url)
				continue
			}

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
				const prNumber = pr.number

				let mergedAt = null
				let mergePeriod = "Open"

				// Check if the PR is merged and fetch the merged_at date.
				// The search API's PR object often doesn't contain a merged_at date.
				// This is the most efficient way to get it without making an extra API call for every PR.
				if (pr.pull_request && pr.pull_request.merged_at) {
					mergedAt = pr.pull_request.merged_at
					mergePeriod =
						Math.round(
							(new Date(mergedAt) - new Date(pr.created_at)) /
								(1000 * 60 * 60 * 24)
						) + " days"
				} else if (pr.state === "closed" && pr.merged_at) {
					// Fallback if the search result itself has the merged_at property.
					mergedAt = pr.merged_at
					mergePeriod =
						Math.round(
							(new Date(mergedAt) - new Date(pr.created_at)) /
								(1000 * 60 * 60 * 24)
						) + " days"
				} else if (pr.state === "closed") {
					// If the PR is closed but not merged, we can't calculate a merge period.
					mergePeriod = "Closed"
				}

				const myFirstReviewDate = await getPrMyFirstReviewDate(
					owner,
					repoName,
					prNumber,
					GITHUB_USERNAME
				)

				let myFirstReviewPeriod = "N/A"
				if (myFirstReviewDate) {
					myFirstReviewPeriod =
						Math.round(
							(new Date(myFirstReviewDate) - new Date(pr.created_at)) /
								(1000 * 60 * 60 * 24)
						) + " days"
				}

				contributions.reviewedPrs.push({
					title: pr.title,
					url: pr.html_url,
					repo: `${owner}/${repoName}`,
					date: pr.updated_at,
					createdAt: pr.created_at,
					mergedAt,
					mergePeriod,
					myFirstReviewDate,
					myFirstReviewPeriod,
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

			// --- Fetch first comment date ---
			const firstCommentDate = await getFirstCommentDate(
				item.comments_url,
				GITHUB_USERNAME
			)

			contributions.collaborations.push({
				title: item.title,
				url: item.html_url,
				repo: `${owner}/${repoName}`,
				date: item.updated_at, // Keeping this for the date grouping logic
				createdAt: item.created_at,
				firstCommentedAt: firstCommentDate,
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
	await fs.mkdir(BASE_DIR, { recursive: true })

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
				],
				widths: ["5%", "25%", "35%", "15%", "10%", "10%"],
				keys: [
					"repo",
					"title",
					"createdAt",
					"date",
					"myFirstReviewDate",
					"myFirstReviewPeriod",
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
						const createdAt = new Date(item.date).toISOString().split("T")[0]
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
						const myFirstReviewAt = item.myFirstReviewDate
							? new Date(item.myFirstReviewDate).toISOString().split("T")[0]
							: "N/A"
						const myFirstReviewPeriod = item.myFirstReviewPeriod || "N/A"

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${myFirstReviewAt}</td>\n`
						tableContent += `      <td>${myFirstReviewPeriod}</td>\n`
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

	const grandTotal =
		prCount + issueCount + reviewedPrCount + collaborationCount

	// 2. Calculate Unique Repositories
	const allItems = [
		...finalContributions.pullRequests,
		...finalContributions.issues,
		...finalContributions.reviewedPrs,
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

These reports track my **external open-source involvement**, aggregating key community activities across **Merged PRs, Issues, Reviewed PRs, and general Collaborations**.

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
| **Collaborations** | **(Collapsible Section)** Detailed list of open Issues or PRs where I have **commented** to participate in discussion. | **First Commented At** (The date of my initial comment) |

---

## All-Time Aggregate Contribution Summary

This is a summary of all contributions fetched since the initial tracking year (**${SINCE_YEAR}**), providing a quick overview of the portfolio's scale.

### Overall Counts

| Category | Total Count |
| :--- | :--- |
| **All-Time Contributions** | 🚀 **${grandTotal}** |
| Merged PRs | ${prCount} |
| Reviewed PRs | ${reviewedPrCount} |
| Issues | ${issueCount} |
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

	try {
		const urlToLatestStatus = new Map()

		// Try to load the full contributions data from a JSON file.
		try {
			const data = await fs.readFile(dataFile, "utf8")
			const allContributions = JSON.parse(data)
			console.log("Loaded existing contributions data.")

			// First pass: collect all URLs and their latest status from the existing file
			for (const type of Object.keys(allContributions)) {
				for (const item of allContributions[type]) {
					const status = {
						type,
						date: new Date(item.date),
						item,
					}
					urlToLatestStatus.set(item.url, status)
				}
			}
			console.log("Indexed existing contributions for status updates.")
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

		let fetchStartYear
		if (!lastUpdate) {
			fetchStartYear = SINCE_YEAR
			console.log("First run - fetching all contributions")
		} else {
			const sameMonth =
				lastUpdate.getMonth() === today.getMonth() &&
				lastUpdate.getFullYear() === today.getFullYear()
			const previousMonth =
				(lastUpdate.getMonth() === today.getMonth() - 1 &&
					today.getFullYear() === lastUpdate.getFullYear()) ||
				(lastUpdate.getMonth() === 11 &&
					today.getMonth() === 0 &&
					today.getFullYear() === lastUpdate.getFullYear() + 1)

			if (sameMonth) {
				fetchStartYear = today.getFullYear()
				console.log("Recent update - fetching only current year")
			} else if (previousMonth) {
				fetchStartYear = today.getFullYear() - 1
				console.log("Last month update - fetching last two years")
			} else {
				fetchStartYear = SINCE_YEAR
				console.log("Older update - fetching all years")
			}
		}

		console.log(`Fetching contributions from year: ${fetchStartYear}`)

		// Fetch new contributions and update the cache.
		const { contributions: newContributions, prCache: updatedPrCache } =
			await fetchContributions(fetchStartYear, prCache)

		// Second pass: merge new contributions, updating status for existing ones.
		const allSources = [newContributions]
		for (const source of allSources) {
			for (const type of Object.keys(source)) {
				for (const item of source[type]) {
					const existing = urlToLatestStatus.get(item.url)
					const newItemDate = new Date(item.date)

					// Only update the existing item if the newly fetched item is more recent.
					if (!existing || newItemDate > existing.date) {
						urlToLatestStatus.set(item.url, {
							type,
							date: newItemDate,
							item,
						})
					}
				}
			}
		}

		// Rebuild collections with correct categorization based on latest status
		let finalContributions = {
			pullRequests: [],
			issues: [],
			reviewedPrs: [],
			collaborations: [],
		}

		for (const [_, status] of urlToLatestStatus) {
			finalContributions[status.type].push(status.item)
		}

		// Sort each category by date
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
