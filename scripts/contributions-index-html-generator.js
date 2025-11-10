const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import the dedent utility
const { dedent } = require('./dedent');

// Import configuration (SINCE_YEAR is needed for reporting)
const { BASE_DIR, SINCE_YEAR, GITHUB_USERNAME } = require('./config');

// Import navbar and footer
const { navHtml } = require('./navbar');
const { createFooterHtml } = require('./footer');

// Import right arrow and favicon svgs
const { RIGHT_ARROW_SVG, FAVICON_SVG_ENCODED } = require('./constants');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_README_FILENAME = 'index.html';

const rightArrowSvg = RIGHT_ARROW_SVG;

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

  // 4. Generate the footer
  const footerHtml = createFooterHtml();

  // 5. Build HTML Content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Open Source Portfolio</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh; 
      display: flex;
      flex-direction: column;
    }
    .report-list { list-style: none; padding: 0; }
    .report-list a { text-decoration: none; }
  </style>
</head>
<body>
${navHtml}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header class="text-center mt-16 mb-12 pb-4 border-b-2 border-indigo-100">
          <h1 class="text-4xl sm:text-5xl font-extrabold text-indigo-700 mb-2 pt-8">
            Open Source Portfolio
          </h1>
          <p class="text-lg text-gray-600 max-w-3xl mx-auto mt-10 mb-6">
            Presenting open source portfolio for 
            <a href="https://github.com/${GITHUB_USERNAME}" class="text-xl font-extrabold text-[#4338CA] hover:text-[#5E51D9] transition duration-150">
              ${GITHUB_USERNAME}
            </a>. It aggregates all-time contribution activities, including <strong>Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations</strong> across various repositories.
          </p>
        </header>

        <section>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            <div class="bg-indigo-600 text-white col-span-1 p-8 rounded-xl shadow-xl h-full flex flex-col justify-center text-center gap-6 transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl">
              <p class="text-3xl font-bold opacity-100 py-2 px-1">🚀 All-Time Contributions</p>
              <p class="text-6xl font-extrabold pb-2">${grandTotal}</p>
              <p class="text-lg font-medium opacity-100">
                Across <strong class="text-xl">${totalUniqueRepos}</strong> repositories since <strong class="text-xl">${SINCE_YEAR}</strong>
            	</p>
          	</div>

            <div class="col-span-1 md:col-span-2 flex flex-col gap-0 md:h-full"> 
              <div class="flex flex-col h-full justify-between text-gray-700 border-t border-gray-100">
                <div class="flex justify-between items-center bg-indigo-50 border-b border-gray-100 px-4 py-3 rounded-t-xl">
                  <span class="text-xl font-medium">Merged PRs</span>
                  <span class="text-3xl font-extrabold text-indigo-700">${prCount}</span>
                </div>

                <div class="flex justify-between items-center bg-white border-b border-gray-100 px-4 py-3">
                  <span class="text-xl font-medium">Issues</span>
                  <span class="text-3xl font-extrabold text-indigo-700">${issueCount}</span>
                </div>

                <div class="flex justify-between items-center bg-indigo-50 border-b border-gray-100 px-4 py-3">
                  <span class="text-xl font-medium">Reviewed PRs</span>
                  <span class="text-3xl font-extrabold text-indigo-700">${reviewedPrCount}</span>
              	</div>

              	<div class="flex justify-between items-center bg-white border-b border-gray-100 px-4 py-3">
                	<span class="text-xl font-medium">Co-Authored PRs</span>
                	<span class="text-3xl font-extrabold text-indigo-700">${coAuthoredPrCount}</span>
              	</div>

              	<div class="flex justify-between items-center bg-indigo-50 px-4 py-3 rounded-b-xl">
                	<span class="text-xl font-medium">Collaborations</span>
                	<span class="text-3xl font-extrabold text-indigo-700">${collaborationCount}</span>
              	</div>
            	</div>
          	</div>
        	</div>
            
        	<p class="text-center mt-12">
          	<a href="reports.html" class="inline-flex items-center flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 px-6 py-3 bg-white border border-gray-200 text-indigo-700 font-semibold rounded-lg shadow-md hover:border-indigo-600 transition duration-200">
            	<span class="pr-2">
              	View Detailed Quarterly Reports
            	</span>
              ${rightArrowSvg}
          	</a>
        	</p>
      	</section>
    	</div>
  	</div>
	</main>
	${footerHtml}
</body>
</html>
`;

  // 6. Format the content
  const formattedContent = await prettier.format(htmlContent, {
    parser: 'html', // Ensure Prettier formats it as HTML
  });

  // 7. Write the formatted file
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`);
}

module.exports = {
  createStatsHtmlReadme,
};
