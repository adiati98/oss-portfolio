const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import the dedent utility
const { dedent } = require('./dedent');

// Import configuration (SINCE_YEAR is needed for reporting)
const { BASE_DIR, SINCE_YEAR, GITHUB_USERNAME } = require('./config');

// Import navbar
const { navHtml } = require('./navbar');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_README_FILENAME = 'index.html';

/**
 * Calculates aggregate totals from all contribution data and writes the
 * all-time contributions HTML report file.
 * @param {object} finalContributions The object with all contributions, grouped by type.
 * to the generated quarterly files, provided by the quarterly generator.
 */
async function createStatsHtmlReadme(finalContributions = []) {
  const htmlBaseDir = path.join(BASE_DIR, HTML_OUTPUT_DIR_NAME);
  const HTML_OUTPUT_PATH = path.join(htmlBaseDir, HTML_README_FILENAME);

  // Ensure the output directory exists
  await fs.mkdir(htmlBaseDir, { recursive: true });

  // 1. Calculate Totals
  const prCount = finalContributions.pullRequests.length;
  const issueCount = finalContributions.issues.length;
  const reviewedPrCount = finalContributions.reviewedPrs.length;
  const collaborationCount = finalContributions.collaborations.length;
  // coAuthoredPrs may not exist in older data; handle defensively
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;

  // 2. Calculate Unique Repositories
  const allItems = [
    ...finalContributions.pullRequests,
    ...finalContributions.issues,
    ...finalContributions.reviewedPrs,
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...finalContributions.collaborations,
  ];
  const uniqueRepos = new Set(allItems.map((item) => item.repo));
  const totalUniqueRepos = uniqueRepos.size;

  // 3. Calculate Years Tracked
  const currentYear = new Date().getFullYear();
  const yearsTracked = currentYear - SINCE_YEAR + 1;

  // Helper function for rendering the statistics cards (Overall Counts)
  const renderStatsCard = (title, count, bgColor, countSize = 'text-3xl') => {
    return dedent`
		<div class="p-6 rounded-xl shadow-lg transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl ${bgColor}">
		  <p class="text-sm font-medium opacity-80">${title}</p>
		  <p class="${countSize} font-bold mt-1">${count}</p>
		</div>
		`;
  };

  // 5. Build HTML Content
  const htmlContent = dedent`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All-Time Contributions Report</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M5.75 21a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 19.25a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM5.75 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM18.25 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM15 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0z'/%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M5.75 16.75A.75.75 0 006.5 16V8A.75.75 0 005 8v8c0 .414.336.75.75.75z'/%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M17.5 8.75v-1H19v1a3.75 3.75 0 01-3.75 3.75h-7a1.75 1.75 0 00-1.75 1.75H5A3.25 3.25 0 018.25 11h7a2.25 2.25 0 002.25-2.25z'/%3E%3C/svg%3E">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
        }
        .report-list { list-style: none; padding: 0; }
        .report-list a { text-decoration: none; }
    </style>
</head>
<body>
${navHtml}
    <div class="mx-auto max-w-7xl bg-white p-6 sm:p-10 rounded-xl shadow-2xl mt-16">
        <header class="text-center mb-12 pb-4 border-b-2 border-indigo-100">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-indigo-700 mb-2 pt-8">
                <span class="text-5xl">📈</span> Open Source Contributions Report
            </h1>
            <p class="text-lg text-gray-600 max-w-3xl mx-auto mt-10 mb-6">
                Organized by calendar quarter, these reports track
                        <a href="https://github.com/${GITHUB_USERNAME}" class="text-xl font-extrabold text-[#4338CA] hover:text-[#5E51D9] transition duration-150">
                            ${GITHUB_USERNAME}
                        </a>'s external open source involvement, aggregating key community activities across 
                        <strong>Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations</strong>.
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
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                <!-- Grand Total Card -->
                <div class="bg-indigo-600 text-white col-span-1 p-8 rounded-xl shadow-xl flex flex-col justify-center transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl">
                    <p class="text-lg font-medium opacity-80 mb-2">All-Time Contributions</p>
                    <p class="text-6xl font-extrabold mt-1">🚀 ${grandTotal}</p>
                </div>

								<div class="col-span-1 md:col-span-2 flex flex-col gap-6">

										<div class="grid grid-cols-2 gap-6">
                				${renderStatsCard('Merged PRs', prCount, 'bg-blue-100 text-blue-800')}
                				${renderStatsCard('Issues', issueCount, 'bg-yellow-100 text-yellow-800')}
										</div>

										<div class="grid grid-cols-3 gap-6">
                				${renderStatsCard('Reviewed PRs', reviewedPrCount, 'bg-green-100 text-green-800')}
                				${renderStatsCard(
                          'Co-Authored PRs',
                          coAuthoredPrCount,
                          'bg-purple-100 text-purple-800'
                        )}
                				${renderStatsCard(
                          'Collaborations',
                          collaborationCount,
                          'bg-pink-100 text-pink-800'
                        )}
										</div>
            		</div>
						</div>
            
            <!-- Repository Summary Grid -->
            <h3 class="text-2xl font-semibold text-gray-700 mt-10 mb-4 pt-4 border-t border-gray-200">Repository Summary</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                ${renderStatsCard(
                  'Unique Repositories',
                  totalUniqueRepos,
                  'bg-gray-100 text-gray-800',
                  'text-4xl'
                )}
                ${renderStatsCard(
                  'Years Tracked',
                  yearsTracked,
                  'bg-gray-100 text-gray-800',
                  'text-4xl'
                )}
            </div>
        </section>

        <footer class="mt-16 pt-8 border-t border-gray-300 text-center text-gray-500 text-sm">
            Made with 💙 by <a href="https://github.com/adiati98" target="_blank" class="text-indigo-600 hover:text-indigo-800 font-semibold">Ayu Adiati</a>
        </footer>
    </div>
</body>
</html>
`;

  // 5. Format the content
  const formattedContent = await prettier.format(htmlContent, {
    parser: 'html', // Ensure Prettier formats it as HTML
  });

  // 6. Write the formatted file
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`);
}

module.exports = {
  createStatsHtmlReadme,
};
