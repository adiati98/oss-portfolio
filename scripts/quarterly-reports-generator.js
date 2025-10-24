const fs = require("fs/promises")
const path = require("path")

// Import configuration
const { BASE_DIR } = require("./config")

// Import new formatters
const {
  formatDate,
  calculatePeriodInDays,
  getPrStatusContent,
} = require("./contribution-formatters")

/**
 * Generates and writes a separate Markdown file for each quarter's contributions.
 * @param {object} groupedContributions An object where keys are "YYYY-QX" and values are the contributions for that quarter.
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
						const createdAt = formatDate(item.createdAt)
						const mergedAt = formatDate(item.mergedAt)
						// Use stored period or recalculate if missing/stale
						const reviewPeriod = calculatePeriodInDays(
							item.createdAt,
							item.mergedAt
						)

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${mergedAt}</td>\n`
						tableContent += `      <td>${reviewPeriod}</td>\n`
					} else if (section === "issues") {
						const createdAt = formatDate(item.date)
						const closedAt = formatDate(item.closedAt)
						// Use stored period, checking if it's "Open" or needs calculation
						const closingPeriod = calculatePeriodInDays(
							item.date,
							item.closedAt,
							item.state
						)

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${closedAt}</td>\n`
						tableContent += `      <td>${closingPeriod}</td>\n`
					} else if (section === "reviewedPrs") {
						const createdAt = formatDate(item.createdAt)
						const myFirstReviewAt = formatDate(item.myFirstReviewDate)
						const myFirstReviewPeriod = calculatePeriodInDays(
							item.createdAt,
							item.myFirstReviewDate
						)
						const lastUpdateContent = getPrStatusContent(item)

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${myFirstReviewAt}</td>\n`
						tableContent += `      <td>${myFirstReviewPeriod}</td>\n`
						tableContent += `      <td>${lastUpdateContent}</td>\n`
					} else if (section === "coAuthoredPrs") {
						const createdAt = formatDate(item.createdAt)
						const firstCommitAt = formatDate(item.firstCommitDate)
						const firstCommitPeriod = calculatePeriodInDays(
							item.createdAt,
							item.firstCommitDate
						)
						const lastUpdateContent = getPrStatusContent(item)

						tableContent += `      <td>${createdAt}</td>\n`
						tableContent += `      <td>${firstCommitAt}</td>\n`
						tableContent += `      <td>${firstCommitPeriod}</td>\n`
						tableContent += `      <td>${lastUpdateContent}</td>\n`
					} else if (section === "collaborations") {
						const createdAt = formatDate(item.createdAt)
						const commentedAt = formatDate(item.firstCommentedAt)

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

module.exports = {
	writeMarkdownFiles,
}
