const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

const { dedent } = require('../../utils/dedent');
const { BASE_DIR, SINCE_YEAR } = require('../../config/config');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const {
  RIGHT_ARROW_SVG,
  FAVICON_SVG_ENCODED,
  COLORS,
  PULL_REQUEST_LARGE_SVG,
} = require('../../config/constants');
const { getIndexStyleCss } = require('../css/style-generator');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_README_FILENAME = 'all-contributions.html';
const rightArrowSvg = RIGHT_ARROW_SVG;

async function createAllTimeContributions(finalContributions = []) {
  const htmlBaseDir = path.join(BASE_DIR, HTML_OUTPUT_DIR_NAME);
  const HTML_OUTPUT_PATH = path.join(htmlBaseDir, HTML_README_FILENAME);

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const prCount = finalContributions.pullRequests.length;
  const issueCount = finalContributions.issues.length;
  const reviewedPrCount = finalContributions.reviewedPrs.length;
  const collaborationCount = finalContributions.collaborations.length;
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;

  const getStats = (count) => {
    if (grandTotal === 0) return { pct: 0, pctStr: '0%' };
    const pct = (count / grandTotal) * 100;
    return { pct: pct, pctStr: pct.toFixed(1) + '%' };
  };

  const stats = {
    prs: getStats(prCount),
    issues: getStats(issueCount),
    reviews: getStats(reviewedPrCount),
    coauth: getStats(coAuthoredPrCount),
    collab: getStats(collaborationCount),
  };

  const allItems = [
    ...finalContributions.pullRequests,
    ...finalContributions.issues,
    ...finalContributions.reviewedPrs,
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...finalContributions.collaborations,
  ];
  const uniqueRepos = new Set(allItems.map((item) => item.repo));
  const totalUniqueRepos = uniqueRepos.size;

  const footerHtml = createFooterHtml();
  const indexCss = getIndexStyleCss();
  const navHtml = createNavHtml('./');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All-Time Impact | Open Source Portfolio</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    ${indexCss}
  </style>
</head>
<body class="bg-white antialiased">
${navHtml}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header style="border-bottom-color: ${COLORS.primary[15]};" class="text-center mt-16 mb-16 pb-12 border-b-2">
          <h1 style="color: ${COLORS.primary.rgb};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
            All-Time Contributions
          </h1>
          <p style="color: ${COLORS.text.secondary};" class="text-xl max-w-3xl mx-auto leading-relaxed">
            Aggregated lifetime metrics and high-level performance across all tracked repositories since ${SINCE_YEAR}.
          </p>
        </header>

        <section>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            <div style="background-color: ${COLORS.primary.rgb};" class="relative overflow-hidden text-white p-10 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-white/20">
              
              <div class="absolute -right-4 -top-2 opacity-10 rotate-20 w-48 h-48">
                ${PULL_REQUEST_LARGE_SVG}
              </div>

              <div class="relative z-10 space-y-2">
                <p class="text-xs uppercase tracking-widest font-bold opacity-70">Total Impact</p>
                <p class="text-7xl font-black tracking-tight">${grandTotal}</p>
                <p class="text-lg opacity-90 font-medium">Lifetime Contributions</p>
              </div>

              <div class="relative z-10 h-px bg-white/20 my-8"></div>

              <div class="relative z-10 grid grid-cols-2 gap-4">
                <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <p class="text-2xl font-bold">${totalUniqueRepos}</p>
                  <p class="text-[10px] uppercase tracking-wider opacity-80">Repos</p>
                </div>
                <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <p class="text-2xl font-bold">${(grandTotal / (new Date().getFullYear() - SINCE_YEAR + 1)).toFixed(0)}</p>
                  <p class="text-[10px] uppercase tracking-wider opacity-80 text-nowrap">Yearly Average</p>
                </div>
                <div class="bg-white/10 rounded-xl p-4 col-span-2 backdrop-blur-sm flex justify-between items-center">
                  <span class="text-[10px] uppercase tracking-wider opacity-80 font-bold">Active Since</span>
                  <span class="text-xl font-bold font-mono tracking-tighter">${SINCE_YEAR}</span>
                </div>
              </div>
            </div>

            <div class="lg:col-span-2 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"> 
              
              <div class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-lg font-bold text-slate-700">Merged PRs</span>
                  <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-xl sm:text-2xl">${prCount}</span>
                    <span class="text-xs sm:text-sm text-gray-400 ml-0 sm:ml-1 font-mono">${stats.prs.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div style="width: ${stats.prs.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-3 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-lg font-bold text-slate-700">Issues</span>
                  <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-xl sm:text-2xl">${issueCount}</span>
                    <span class="text-xs sm:text-sm text-gray-400 ml-0 sm:ml-1 font-mono">${stats.issues.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div style="width: ${stats.issues.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-3 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-lg font-bold text-slate-700">Reviewed PRs</span>
                  <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-xl sm:text-2xl">${reviewedPrCount}</span>
                    <span class="text-xs sm:text-sm text-gray-400 ml-0 sm:ml-1 font-mono">${stats.reviews.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div style="width: ${stats.reviews.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-3 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-lg font-bold text-slate-700">Co-Authored PRs</span>
                  <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-xl sm:text-2xl">${coAuthoredPrCount}</span>
                    <span class="text-xs sm:text-sm text-gray-400 ml-0 sm:ml-1 font-mono">${stats.coauth.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div style="width: ${stats.coauth.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-3 rounded-full"></div>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center px-8 py-4 hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-end mb-2">
                  <span class="text-lg font-bold text-slate-700">Collaborations</span>
                  <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                    <span style="color: ${COLORS.primary.rgb};" class="font-bold text-xl sm:text-2xl">${collaborationCount}</span>
                    <span class="text-xs sm:text-sm text-gray-400 ml-0 sm:ml-1 font-mono">${stats.collab.pctStr}</span>
                  </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div style="width: ${stats.collab.pct}%; background-color: ${COLORS.primary.rgb};" class="progress-bar h-3 rounded-full"></div>
                </div>
              </div>
            </div> 
          </div> 

          <div class="mt-20 p-12 rounded-3xl text-center border-2 border-dashed border-slate-200">
            <h2 class="text-2xl font-bold mb-4 text-slate-800">Detailed Quarterly Reports</h2>
            <p class="text-slate-500 mb-8 max-w-2xl mx-auto">
              See the specific contributions, repository breakdowns, and timeline of activities through the chronological reports.
            </p>
            
            <p class="text-center">
              <a href="reports.html" 
                  style="color: ${COLORS.primary.rgb}; border-color: ${COLORS.primary[15]};" 
                  class="index-report-link inline-flex items-center flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 px-8 py-4 bg-white border font-bold rounded-xl shadow-md transition duration-200 hover:shadow-lg">
                <span class="pr-2">View All Reports</span>
                ${rightArrowSvg}
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  </main>
  ${footerHtml}
</body>
</html>
`;

  const formattedContent = await prettier.format(htmlContent, {
    parser: 'html',
  });

  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`);
}

module.exports = { createAllTimeContributions };
