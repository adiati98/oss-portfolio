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
const { RIGHT_ARROW_SVG, FAVICON_SVG_ENCODED, COLORS } = require('./constants');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_README_FILENAME = 'index.html';

const rightArrowSvg = RIGHT_ARROW_SVG;

/**
 * Calculates aggregate totals from all contribution data and writes the
 * all-time contributions HTML report file.
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
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;

  // --- HELPER: Calculate Stats for Bar Width and Display ---
  const getStats = (count) => {
    if (grandTotal === 0) return { pct: 0, pctStr: '0%' };
    const pct = (count / grandTotal) * 100;
    // pct is for the CSS width (number), pctStr is for the text label
    return { pct: pct, pctStr: pct.toFixed(1) + '%' };
  };

  // Prepare stats objects
  const stats = {
    prs: getStats(prCount),
    issues: getStats(issueCount),
    reviews: getStats(reviewedPrCount),
    coauth: getStats(coAuthoredPrCount),
    collab: getStats(collaborationCount),
  };

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
    html, body { margin: 0; padding: 0; height: 100%; }
    body { font-family: 'Inter', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
    .report-list { list-style: none; padding: 0; }
    .report-list a { text-decoration: none; }
    
    .index-report-link {
      border: 1px solid ${COLORS.border.light} !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .index-report-link:hover { border-color: ${COLORS.primary.rgb} !important; }
    .index-report-link:focus-visible {
      border-color: ${COLORS.primary.rgb};
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }
    
    /* Animation for the progress bars */
    @keyframes loadBar {
      from { width: 0; }
    }
    .progress-bar {
      animation: loadBar 1s ease-out forwards;
    }
  </style>
</head>
<body>
${navHtml}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header style="border-bottom-color: ${COLORS.primary[15]};" class="text-center mt-16 mb-12 pb-4 border-b-2">
          <h1 style="color: ${COLORS.primary.rgb};" class="text-4xl sm:text-5xl font-extrabold mb-2 pt-8">
            Open Source Portfolio
          </h1>
          <p style="color: ${COLORS.text.secondary};" class="text-lg max-w-3xl mx-auto mt-10 mb-6">
            Presenting open source portfolio for 
            <a href="https://github.com/${GITHUB_USERNAME}" style="color: ${COLORS.primary.rgb};" class="text-xl font-extrabold hover:opacity-80 transition duration-150">
              ${GITHUB_USERNAME}
            </a>. It aggregates all-time contribution activities.
          </p>
        </header>

        <section>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            <div style="background-color: ${COLORS.primary.rgb};" class="text-white col-span-1 p-8 rounded-xl shadow-xl h-full flex flex-col justify-center text-center gap-6 transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl">
              <p class="text-2xl lg:text-3xl font-bold opacity-100 py-2">🚀 All-Time Contributions</p>
              <p class="text-6xl font-extrabold pb-2">${grandTotal}</p>
              <p class="text-lg font-medium opacity-100">
                Across <strong class="text-xl">${totalUniqueRepos}</strong> repositories since <strong class="text-xl">${SINCE_YEAR}</strong>
              </p>
            </div>

            <div class="col-span-1 md:col-span-2 flex flex-col h-full bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden"> 
              
              <div class="flex-1 flex flex-col justify-center px-6 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-base sm:text-lg font-medium text-gray-700">Merged PRs</span>
                  <div class="text-right">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-2xl">${prCount}</span>
                    <span class="text-sm text-gray-400 ml-1 font-mono">${stats.prs.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div style="width: ${stats.prs.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-2 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-6 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-base sm:text-lg font-medium text-gray-700">Issues</span>
                  <div class="text-right">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-2xl">${issueCount}</span>
                    <span class="text-sm text-gray-400 ml-1 font-mono">${stats.issues.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div style="width: ${stats.issues.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-2 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-6 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-base sm:text-lg font-medium text-gray-700">Reviewed PRs</span>
                  <div class="text-right">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-2xl">${reviewedPrCount}</span>
                    <span class="text-sm text-gray-400 ml-1 font-mono">${stats.reviews.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div style="width: ${stats.reviews.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-2 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-6 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-base sm:text-lg font-medium text-gray-700">Co-Authored PRs</span>
                  <div class="text-right">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-2xl">${coAuthoredPrCount}</span>
                    <span class="text-sm text-gray-400 ml-1 font-mono">${stats.coauth.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div style="width: ${stats.coauth.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-2 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-6 py-2 hover:bg-gray-50 transition-colors duration-200">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-base sm:text-lg font-medium text-gray-700">Collaborations</span>
                  <div class="text-right">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-2xl">${collaborationCount}</span>
                    <span class="text-sm text-gray-400 ml-1 font-mono">${stats.collab.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div style="width: ${stats.collab.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-2 rounded-full"></div>
                </div>
              </div>

            </div>
          </div>
            
          <p class="text-center mt-12">
            <a href="reports.html" style="color: ${COLORS.primary.rgb};" 
                   class="index-report-link inline-flex items-center flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 px-6 py-3 bg-white border font-semibold rounded-lg shadow-md transition duration-200">
              <span class="pr-2">View Detailed Quarterly Reports</span>
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
    parser: 'html',
  });

  // 7. Write the formatted file
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`);
}

module.exports = {
  createStatsHtmlReadme,
};
