const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { personaCategories, DEFAULT_PERSONA } = require('../../metadata/personas');
const {
  RIGHT_ARROW_SVG,
  FAVICON_SVG_ENCODED,
  COLORS,
  PULL_REQUEST_LARGE_SVG,
  INFO_ICON_SVG,
} = require('../../config/constants');
const { getIndexStyleCss } = require('../css/style-generator');
const { getColorValue } = require('../../utils/color-helpers');

const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
const HTML_OUTPUT_PATH = path.join(htmlBaseDir, 'index.html');
const rightArrowSvg = RIGHT_ARROW_SVG;

/**
 * Determines the persona title and description based on contribution counts.
 */
function determinePersona(counts) {
  const { prCount, issueCount, reviewedPrCount, coAuthoredPrCount, collaborationCount } = counts;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + coAuthoredPrCount + collaborationCount;

  if (grandTotal === 0) {
    return DEFAULT_PERSONA;
  }

  return personaCategories.reduce((prev, curr) => {
    const currentCount = counts[curr.key] || 0;
    const prevCount = counts[prev.key] || 0;

    if (currentCount > prevCount) return curr;
    if (currentCount === prevCount && curr.priority < prev.priority) return curr;

    return prev;
  });
}

/**
 * Generates the main landing page for the portfolio.
 */
async function createIndexHtml(finalContributions = {}, articles = []) {
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const prCount = finalContributions.pullRequests?.length || 0;
  const issueCount = finalContributions.issues?.length || 0;
  const reviewedPrCount = finalContributions.reviewedPrs?.length || 0;
  const collaborationCount = finalContributions.collaborations?.length || 0;
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const articleCount = articles.length || 0;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;

  const countsDict = {
    prCount,
    issueCount,
    reviewedPrCount,
    coAuthoredPrCount,
    collaborationCount,
  };

  const allItems = [
    ...(finalContributions.pullRequests || []),
    ...(finalContributions.issues || []),
    ...(finalContributions.reviewedPrs || []),
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...(finalContributions.collaborations || []),
  ];

  const yearsActive = allItems
    .map((item) => new Date(item.date).getFullYear())
    .filter((year) => !isNaN(year) && year >= 2008);

  const currentYear = new Date().getFullYear();
  const earliestYear = yearsActive.length > 0 ? Math.min(...yearsActive) : currentYear;

  const maxCount = Math.max(
    prCount,
    issueCount,
    reviewedPrCount,
    coAuthoredPrCount,
    collaborationCount
  );

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

  const uniqueRepos = new Set(allItems.map((item) => item.repo));
  const totalUniqueRepos = uniqueRepos.size;

  const repoActivity = allItems.reduce((acc, item) => {
    acc[item.repo] = (acc[item.repo] || 0) + 1;
    return acc;
  }, {});

  const topThreeRepos = Object.entries(repoActivity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const topReposHtml =
    topThreeRepos.length > 0
      ? topThreeRepos
          .map(([repo, count], idx) => {
            const isTop = idx === 0;
            const nameClass = isTop ? 'text-base font-black' : 'text-sm font-bold';
            const [owner, name] = repo.includes('/') ? repo.split('/') : ['', repo];
            const repoUrl = `https://github.com/${repo}`;

            return `
        <div class="flex flex-col sm:flex-row sm:items-start justify-between py-4 border-b border-slate-100 last:border-0 gap-3 sm:gap-4">
          <div class="flex flex-col min-w-0">
            ${owner ? `<span class="text-xs uppercase tracking-[0.15em] text-slate-500 font-black leading-none mb-1.5 block">${owner}</span>` : ''}
            <a href="${repoUrl}" target="_blank" rel="noopener noreferrer" class="${nameClass} break-all hover:underline underline-offset-4" style="color: ${getColorValue(COLORS.primary)};">
              ${name}
            </a>
          </div>
          <div class="shrink-0 mt-1 sm:mt-0 sm:self-center">
            <span class="text-xs font-black text-slate-600 whitespace-nowrap px-2 py-1 bg-slate-50 rounded-md border border-slate-200">
              ${count} contributions
            </span>
          </div>
        </div>`;
          })
          .join('')
      : '<p class="text-sm text-slate-500 font-medium italic">No activity recorded yet.</p>';

  const { title: personaTitle, desc: personaDesc } = determinePersona(countsDict);

  const footerHtml = createFooterHtml();
  const indexCss = getIndexStyleCss();
  const navHtml = createNavHtml('./');

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Open Source Portfolio | ${GITHUB_USERNAME}</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>${indexCss}</style>
    </head>
    <body class="bg-white antialiased flex flex-col h-full min-h-full">
      ${navHtml}
      <main class="grow w-full">
        <header class="pt-24 pb-20 px-6 border-b" style="border-color: ${getColorValue(COLORS.border.light)};">
          <div class="max-w-4xl mx-auto text-center">
            <h1 class="text-5xl md:text-7xl font-extrabold mb-8 mt-12" style="color: ${getColorValue(COLORS.primary)};">
              Open Source Portfolio
            </h1>
            <h2 class="block text-4xl md:text-5xl font-bold opacity-80 mb-8" style="color: ${getColorValue(COLORS.primary[75])}";>@${GITHUB_USERNAME}</h2>
            <p class="text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto" style="color: ${getColorValue(COLORS.text.secondary)};">
              A comprehensive visualization of open source contributions, from high-level impact to granular quarterly details.
            </p>
          </div>
        </header>

        <div class="px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-10 sm:py-14">
          <div class="max-w-[120ch] mx-auto">

            <section>
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div style="background-color: ${getColorValue(COLORS.primary)};" class="relative overflow-hidden text-white p-6 sm:p-10 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-white/20">
                  <div class="absolute right-0 -top-2 opacity-10 rotate-20 w-48 h-48 pointer-events-none">${PULL_REQUEST_LARGE_SVG}</div>
                  <div class="relative z-10 space-y-2">
                    <p class="text-sm uppercase tracking-widest opacity-80">Total Impact</p>
                    <p class="text-7xl font-black tracking-tight">${grandTotal}</p>
                    <p class="text-lg opacity-90 font-semibold">Lifetime Contributions on GitHub</p>
                  </div>
                  <div class="relative z-10 h-px bg-white/20 my-8"></div>
                  <div class="relative z-10 grid grid-cols-2 gap-4">
                    <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <div class="h-8 flex items-end"><p class="text-3xl sm:text-4xl font-black leading-none tracking-tighter">${totalUniqueRepos}</p></div>
                      <p class="text-xs uppercase tracking-widest text-white opacity-80 leading-tight mt-2">Impacted Repos</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <div class="h-8 flex items-end"><p class="text-3xl sm:text-4xl font-black leading-none tracking-tighter">${articleCount}</p></div>
                      <p class="text-xs uppercase tracking-widest text-white opacity-80 leading-tight mt-2">Articles</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-4 col-span-2 backdrop-blur-sm flex justify-between items-center">
                      <span class="text-xs uppercase tracking-widest text-white">Active Since</span>
                      <span class="text-2xl font-black font-mono tracking-tighter">${earliestYear}</span>
                    </div>
                  </div>
                </div>

                <div class="lg:col-span-2 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"> 
                  ${['Merged PRs', 'Issues', 'Reviewed PRs', 'Co-Authored PRs', 'Collaborations']
                    .map((label, idx) => {
                      const key = ['prs', 'issues', 'reviews', 'coauth', 'collab'][idx];
                      const count = [
                        prCount,
                        issueCount,
                        reviewedPrCount,
                        coAuthoredPrCount,
                        collaborationCount,
                      ][idx];
                      const s = stats[key];
                      const isHighest = grandTotal > 0 && count === maxCount;

                      const rowStyle = isHighest
                        ? `style="background-color: ${getColorValue(COLORS.primary[10] || '#f5f3ff')};"`
                        : '';

                      const labelClass = isHighest
                        ? 'text-lg sm:text-xl font-black self-start tracking-tighter'
                        : 'text-slate-800 font-bold text-md-lg sm:text-lg self-start tracking-tighter';

                      const labelInlineStyle = isHighest
                        ? `style="color: ${getColorValue(COLORS.primary)};"`
                        : '';

                      const trackClass = isHighest ? 'bg-white' : 'bg-slate-100';

                      return `
                    <div ${rowStyle} class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:opacity-95 transition-all last:border-0 relative">
                      <div class="flex justify-between items-center mb-2">
                        <span class="${labelClass}" ${labelInlineStyle}>${label}</span>
                        <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                          <span style="color: ${getColorValue(COLORS.primary)};" class="tracking-tighter ${
                            isHighest
                              ? 'font-black text-3xl sm:text-4xl'
                              : 'font-bold text-2xl sm:text-3xl'
                          } leading-none">${count}</span>
                          <span class="text-xs sm:text-sm text-slate-600 mt-1 sm:mt-0 ml-0 sm:ml-2 font-mono font-semibold">${s.pctStr}</span>
                        </div>
                      </div>
                      <div class="w-full ${trackClass} rounded-full h-3 overflow-hidden flex">
                        <div style="width: ${s.pct}%; max-width: ${s.pct}%; background-color: ${getColorValue(COLORS.primary)}; ${s.pct === 0 ? 'display: none;' : ''}" 
                             class="progress-bar h-3 rounded-full ${isHighest ? 'opacity-100' : 'opacity-60'} transition-all duration-300">
                        </div>
                      </div>
                    </div>`;
                    })
                    .join('')}
                </div> 
              </div> 

              <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <h2 class="text-sm uppercase tracking-widest font-black text-slate-800 mb-4">Primary Focus Projects</h2>
                  <div class="divide-y divide-slate-100 min-w-0">${topReposHtml}</div>
                </div>
                
                <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h2 class="text-sm uppercase tracking-widest font-black text-slate-800 mb-4">
                      Collaboration Profile
                    </h2>
                    <div>
                      <p style="color: ${getColorValue(COLORS.primary)};" class="text-3xl font-black mb-2 tracking-tight">${personaTitle}</p>
                      <p class="text-md text-slate-500 leading-relaxed">${personaDesc}</p>
                    </div>
                  </div>
                  
                  <div class="mt-6 pt-4 border-t border-slate-100 flex items-start">
                    <span style="color: ${getColorValue(COLORS.primary)};" class="mr-3 mt-0.5 shrink-0">
                      ${INFO_ICON_SVG}
                    </span>
                    <p class="text-xs text-slate-500 leading-snug">
                      This profile is an assigned category based on contribution activity. 
                      <a href="glossary.html" class="font-bold underline decoration-slate-300 hover:decoration-current transition-colors" style="color: ${getColorValue(COLORS.primary)};">
                        Learn more in the Glossary.
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <section class="mt-16 pt-12 border-t border-slate-100">
                <h2 class="text-sm uppercase tracking-[0.2em] font-black text-slate-800 mb-8 text-center">Explore Detailed Metrics & Activities</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <a href="reports.html" class="group p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between shadow-sm">
                    <div class="flex items-center space-x-4 mb-4">
                      <div class="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform text-xl">
                        📊
                      </div>
                      <div>
                        <h3 class="font-black text-slate-900">Reports</h3>
                        <p class="text-xs text-slate-600 font-bold">Seasonal breakdown</p>
                      </div>
                    </div>
                    <div style="color: ${getColorValue(COLORS.primary)};" class="flex items-center text-xs font-black uppercase tracking-wider opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>View Reports</span>
                      <span class="ml-2 group-hover:translate-x-1 transition-transform">${rightArrowSvg}</span>
                    </div>
                  </a>

                  <a href="community-activity.html" class="group p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between shadow-sm">
                    <div class="flex items-center space-x-4 mb-4">
                      <div class="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform text-xl">
                        🤝
                      </div>
                      <div>
                        <h3 class="font-black text-slate-900">Community</h3>
                        <p class="text-xs text-slate-600 font-bold">Roles & Active Tasks</p>
                      </div>
                    </div>
                    <div style="color: ${getColorValue(COLORS.primary)};" class="flex items-center text-xs font-black uppercase tracking-wider opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>View Activity</span>
                      <span class="ml-2 group-hover:translate-x-1 transition-transform">${rightArrowSvg}</span>
                    </div>
                  </a>

                  <a href="blog.html" class="group p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between shadow-sm">
                    <div class="flex items-center space-x-4 mb-4">
                      <div class="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform text-xl">
                        ✍️
                      </div>
                      <div>
                        <h3 class="font-black text-slate-900">Articles</h3>
                        <p class="text-xs text-slate-600 font-bold">${articleCount} Tutorials & Posts</p>
                      </div>
                    </div>
                    <div style="color: ${getColorValue(COLORS.primary)};" class="flex items-center text-xs font-black uppercase tracking-wider opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>Read Articles</span>
                      <span class="ml-2 group-hover:translate-x-1 transition-transform">${rightArrowSvg}</span>
                    </div>
                  </a>

                </div>
              </section>
            </section>
          </div>
        </div>
      </main>
      ${footerHtml}
    </body>
    </html>
  `;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');

  console.log('Generated landing page successfully at: ' + HTML_OUTPUT_PATH);
}

module.exports = { createIndexHtml, determinePersona };
