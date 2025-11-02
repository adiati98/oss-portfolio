const fs = require("fs/promises")
const path = require("path")

// Import configuration (SINCE_YEAR is needed for reporting)
const { BASE_DIR, SINCE_YEAR } = require("./config")

const HTML_OUTPUT_DIR_NAME = "html-generated"
const HTML_README_FILENAME = "index.html"

/**
 * Calculates aggregate totals from all contribution data and writes the
 * all-time contributions HTML report file.
 * @param {object} finalContributions The object with all contributions, grouped by type.
 * @param {Array<string>} quarterlyFileLinks List of relative paths (e.g., ['2023/Q4-2023.html', ...])
 * to the generated quarterly files, provided by the quarterly generator.
 */
async function createStatsHtmlReadme(
	finalContributions,
	quarterlyFileLinks = []
) {
	const htmlBaseDir = path.join(BASE_DIR, HTML_OUTPUT_DIR_NAME)
	const HTML_OUTPUT_PATH = path.join(htmlBaseDir, HTML_README_FILENAME)

	// Ensure the output directory exists
	await fs.mkdir(htmlBaseDir, { recursive: true })

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

	// Helper function for rendering the statistics cards (Overall Counts)
	const renderStatsCard = (title, count, bgColor, countSize = "text-3xl") => {
		return `
		<div class="p-6 rounded-xl shadow-lg transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl ${bgColor}">
		  <p class="text-sm font-medium opacity-80">${title}</p>
		  <p class="${countSize} font-bold mt-1">${count}</p>
		</div>
		`
	}

	// Define the report structure data
	const reportStructure = [
		{
			section: "Quarterly Statistics",
			description:
				"A high-level summary showing the **Total Contributions** and **Total Repositories** involved in during the quarter.",
			metric: "Total Count, Unique Repositories",
		},
		{
			section: "Contribution Breakdown",
			description:
				"A table listing the count of contributions for each of the five core categories within that quarter.",
			metric: "Category Counts",
		},
		{
			section: "Top 3 Repositories",
			description:
				"The top three projects where contributions were made in that quarter, ranked by total count.",
			metric: "Contribution Frequency",
		},
		{
			section: "Merged PRs",
			description:
				"Detailed list of Pull Requests **authored by me** and merged into external repositories.",
			metric: "**Review Period** (Time from creation to merge)",
		},
		{
			section: "Issues",
			description:
				"Detailed list of Issues **authored by me** on external repositories.",
			metric: "**Closing Period** (Time from creation to close)",
		},
		{
			section: "Reviewed PRs",
			description:
				"Detailed list of Pull Requests **reviewed or merged by me** on external repositories.",
			metric:
				"**My First Review Period** (Time from PR creation to my first review)",
		},
		{
			section: "Co-Authored PRs",
			description:
				"Pull Requests where **I contributed commits (including co-authored commits)** to other contributor's PRs.",
			metric:
				"**My First Commit Period** (Time from PR creation to my first commit)",
		},
		{
			section: "Collaborations",
			description:
				"Detailed list of open Issues or PRs where I have **commented** to participate in discussion.",
			metric: "**First Commented At** (The date of my initial comment)",
		},
	]

	// Helper function to render table rows
	const renderStructureTableRows = () => {
		return reportStructure
			.map((item, index) => {
				// Convert Markdown formatting to HTML
				const safeDescription = item.description
					.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
					.replace(/`/g, "<code>")
				const safeMetric = item.metric.replace(
					/\*\*(.*?)\*\*/g,
					"<strong>$1</strong>"
				)

				const rowBg = index % 2 === 0 ? "bg-white" : "bg-gray-50"

				return `
            <tr class="${rowBg} border-b hover:bg-indigo-50 transition duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-700">
                ${item.section}
              </td>
              <td class="px-6 py-4 text-sm text-gray-700">
                ${safeDescription}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${safeMetric}
              </td>
            </tr>
          `
			})
			.join("")
	}

	// 4. Generate Quarterly Links HTML
	// Reverse and sort links to put newest quarter first (e.g., Q4-2024, Q3-2024, ...)
	const sortedLinks = quarterlyFileLinks.sort().reverse()
	let linkHtml = ""

	if (sortedLinks.length > 0) {
		for (const relativePath of sortedLinks) {
			// Example path: '2024/Q1-2024.html'
			const filename = path.basename(relativePath, ".html") // Q1-2024
			const [quarter, year] = filename.split("-") // Q1, 2024

			const linkText = `${quarter.replace("Q", "Quarter ")}, ${year}`

			linkHtml += `
            <li class="bg-indigo-50 hover:bg-indigo-100 transition duration-150 rounded-lg shadow-sm">
                <a href="./${relativePath}" class="p-4 block font-semibold text-indigo-700 hover:text-indigo-800">
                    ${linkText}
                </a>
            </li>
            `
		}
	} else {
		linkHtml = `<li class="p-4 text-gray-500 italic col-span-full">No quarterly reports have been generated yet.</li>`
	}

	// 5. Build HTML Content
	const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All-Time Contributions Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6; /* Light gray background */
        }
        .report-list { list-style: none; padding: 0; }
        .report-list a { text-decoration: none; }
    </style>
</head>
<body class="p-4 sm:p-8">
    <div class="mx-auto max-w-7xl bg-white p-6 sm:p-10 rounded-xl shadow-2xl">
        <header class="text-center mb-12">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-indigo-700 mb-2">
                <span class="text-5xl">📈</span> My Open Source Contributions Report
            </h1>
            <p class="text-lg text-gray-600 max-w-3xl mx-auto mt-10">
                Organized by calendar quarter, these reports track my <strong>external open-source involvement</strong>, aggregating key community activities across <strong>Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations</strong>.
            </p>
        </header>

        <!-- Aggregate Summary Section -->
        <section class="mb-14">
            <h2 class="text-3xl font-bold text-gray-800 border-b-2 border-indigo-500 pb-3 mb-8">
                All-Time Aggregate Summary
            </h2>
            <p class="text-gray-600 mb-8">
                This is a summary of all contributions fetched since the initial tracking year (<strong>${SINCE_YEAR}</strong>), providing a quick overview of the portfolio's scale.
            </p>

            <!-- Overall Counts Grid -->
            <h3 class="text-2xl font-semibold text-gray-700 mb-4">Overall Contributions</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <!-- Grand Total Card -->
                <div class="bg-indigo-600 text-white col-span-2 md:col-span-3 lg:col-span-2 p-6 rounded-xl shadow-xl transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl">
                    <p class="text-sm font-medium opacity-80">All-Time Contributions</p>
                    <p class="text-5xl font-extrabold mt-1">🚀 ${grandTotal}</p>
                </div>

                ${renderStatsCard(
									"Merged PRs",
									prCount,
									"bg-blue-100 text-blue-800"
								)}
                ${renderStatsCard(
									"Issues",
									issueCount,
									"bg-yellow-100 text-yellow-800"
								)}
                ${renderStatsCard(
									"Reviewed PRs",
									reviewedPrCount,
									"bg-green-100 text-green-800"
								)}
                ${renderStatsCard(
									"Co-Authored PRs",
									coAuthoredPrCount,
									"bg-purple-100 text-purple-800"
								)}
                ${renderStatsCard(
									"Collaborations",
									collaborationCount,
									"bg-pink-100 text-pink-800"
								)}
            </div>
            
            <!-- Repository Summary Grid -->
            <h3 class="text-2xl font-semibold text-gray-700 mt-10 mb-4 pt-4 border-t border-gray-200">Repository Summary</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                ${renderStatsCard(
									"Unique Repositories",
									totalUniqueRepos,
									"bg-gray-100 text-gray-800",
									"text-4xl"
								)}
                ${renderStatsCard(
									"Years Tracked",
									yearsTracked,
									"bg-gray-100 text-gray-800",
									"text-4xl"
								)}
            </div>
        </section>

        <!-- Report Structure Section (Now a Table) -->
        <section class="mb-14">
            <h2 class="text-3xl font-bold text-gray-800 border-b-2 border-indigo-500 pb-3 mb-8">
                Report Structure Breakdown
            </h2>
            <p class="text-gray-600 mb-8">
                Each quarterly report file (<code class="bg-gray-200 p-1 rounded font-mono">Qx-YYYY.html</code> inside the year folders) provides a detailed log and summary for that period:
            </p>
            
            <div class="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-indigo-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/4">
                                Section
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/2">
                                Content Description
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/4">
                                Key Metric / Insight
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${renderStructureTableRows()}
                    </tbody>
                </table>
            </div>

        </section>

        <!-- Quarterly Report Links Section (NEW) -->
        <section class="mt-14 pt-8 border-t border-gray-300">
            <h2 class="text-3xl font-bold text-gray-800 border-b-2 border-indigo-500 pb-3 mb-8">
                Quarterly Reports (Detail Pages)
            </h2>
            <p class="text-gray-600 mb-6">
                Click on any quarter below to view the detailed tables and statistics for that period.
            </p>
            <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 report-list">
                ${linkHtml}
            </ul>
        </section>

        <footer class="mt-16 pt-8 border-t border-gray-300 text-center text-gray-500 text-sm">
            Made with 💙 by <a href="https://github.com/adiati98" target="_blank" class="text-indigo-600 hover:text-indigo-800 font-semibold">Ayu Adiati</a>. Data tracked since ${SINCE_YEAR}.
        </footer>
    </div>
</body>
</html>
`

	// 5. Write the file
	await fs.writeFile(HTML_OUTPUT_PATH, htmlContent, "utf8")
	console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`)
}

module.exports = {
	createStatsHtmlReadme,
}
