const fs = require("fs/promises")
const path = require("path")

// Import configuration
const { BASE_DIR } = require("./config")

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

module.exports = {
	writeMarkdownFiles,
}
