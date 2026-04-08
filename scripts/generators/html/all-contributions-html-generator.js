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
  INFO_ICON_SVG,
} = require('../../config/constants');
const { getIndexStyleCss } = require('../css/style-generator');
const { getColorValue } = require('../../utils/color-helpers');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_README_FILENAME = 'all-contributions.html';
const rightArrowSvg = RIGHT_ARROW_SVG;

function determinePersona(counts) {
  const { prCount, issueCount, reviewedPrCount, coAuthoredPrCount, collaborationCount } = counts;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + coAuthoredPrCount + collaborationCount;

  const personaCategories = [
    {
      title: 'Community Mentor',
      desc: 'Expert advocate for code quality and peer development. Code review and technical guidance ensure high standards across the community.',
      count: reviewedPrCount,
      priority: 1,
    },
    {
      title: 'Core Contributor',
      desc: 'Main driver of project development. Responsible for moving features from concept to production through robust code and resolving complex bugs to ensure software stability.',
      count: prCount,
      priority: 2,
    },
    {
      title: 'Project Architect',
      desc: 'Strategic problem-solver focused on technical discovery. Skilled at identifying critical system issues and defining feature planning that shapes the long-term technical roadmap.',
      count: issueCount,
      priority: 3,
    },
    {
      title: 'Collaborative Partner',
      desc: 'Focused on shared project success. Pair programming and co-authoring code delivers high-impact value through collective development effort.',
      count: coAuthoredPrCount,
      priority: 4,
    },
    {
      title: 'Ecosystem Partner',
      desc: 'Community builder focused on technical discussion and engagement. Facilitates collaboration through project discussions to ensure the open source ecosystem remains vibrant and interconnected.',
      count: collaborationCount,
      priority: 5,
    },
  ];

  if (grandTotal === 0) {
    return {
      title: 'Open Source Contributor',
      desc: 'Active member of the global open source community.',
    };
  }

  return personaCategories.reduce((prev, curr) => {
    if (curr.count > prev.count) return curr;
    if (curr.count === prev.count && curr.priority < prev.priority) return curr;
    return prev;
  });
}

/**
 * Added articles parameter to display writing impact alongside code.
 */
async function createAllTimeContributions(finalContributions = [], articles = []) {
  const htmlBaseDir = path.join(BASE_DIR, HTML_OUTPUT_DIR_NAME);
  const HTML_OUTPUT_PATH = path.join(htmlBaseDir, HTML_README_FILENAME);

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const prCount = finalContributions.pullRequests?.length || 0;
  const issueCount = finalContributions.issues?.length || 0;
  const reviewedPrCount = finalContributions.reviewedPrs?.length || 0;
  const collaborationCount = finalContributions.collaborations?.length || 0;
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  // Article count for the summary card
  const articleCount = articles.length || 0;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;
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

  const allItems = [
    ...(finalContributions.pullRequests || []),
    ...(finalContributions.issues || []),
    ...(finalContributions.reviewedPrs || []),
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...(finalContributions.collaborations || []),
  ];

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
          <div class="flex items-center shrink-0 mt-1 sm:mt-0">
            <span class="text-xs font-black text-slate-600 whitespace-nowrap px-2 py-1 bg-slate-50 rounded-md border border-slate-200">
              ${count} contributions
            </span>
          </div>
        </div>`;
          })
          .join('')
      : '<p class="text-sm text-slate-500 font-medium italic">No activity recorded yet.</p>';

  const { title: personaTitle, desc: personaDesc } = determinePersona({
    prCount,
    issueCount,
    reviewedPrCount,
    coAuthoredPrCount,
    collaborationCount,
  });

  const footerHtml = createFooterHtml();
  const indexCss = getIndexStyleCss();
  const navHtml = createNavHtml('./');

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>All-Time Impact | Open Source Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>${indexCss}</style>
    </head>
    <body class="bg-white antialiased">
      ${navHtml}
      <main class="grow w-full">
        <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
          <div class="max-w-[120ch] mx-auto">
            <header style="border-bottom-color: ${COLORS.primary[15]};" class="text-center mt-16 mb-16 pb-12 border-b-2">
              <h1 style="color: ${getColorValue(COLORS.primary)};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
                All-Time Impact
              </h1>
              <p style="color: ${COLORS.text.secondary};" class="text-xl max-w-3xl mx-auto leading-relaxed">
                Aggregated lifetime metrics and high-level performance across all tracked repositories since ${SINCE_YEAR}.
              </p>
            </header>

            <section>
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div style="background-color: ${getColorValue(COLORS.primary)};" class="relative overflow-hidden text-white p-6 sm:p-10 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-white/20">
                  <div class="absolute right-0 -top-2 opacity-10 rotate-20 w-48 h-48 pointer-events-none">${PULL_REQUEST_LARGE_SVG}</div>
                  <div class="relative z-10 space-y-2">
                    <p class="text-xs uppercase tracking-widest font-black opacity-100">Total Impact</p>
                    <p class="text-7xl font-black tracking-tight">${grandTotal}</p>
                    <p class="text-lg opacity-100 font-bold">Lifetime Contributions on GitHub</p>
                  </div>
                  <div class="relative z-10 h-px bg-white/20 my-8"></div>
                  <div class="relative z-10 grid grid-cols-2 gap-4">
                    <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <div class="h-8 flex items-end"><p class="text-2xl sm:text-3xl font-black leading-none">${totalUniqueRepos}</p></div>
                      <p class="text-sm uppercase tracking-widest text-white leading-tight mt-1">Impacted Repos</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <div class="h-8 flex items-end"><p class="text-2xl sm:text-3xl font-black leading-none">${articleCount}</p></div>
                      <p class="text-sm uppercase tracking-widest text-white leading-tight mt-1">Articles</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-4 col-span-2 backdrop-blur-sm flex justify-between items-center">
                      <span class="text-sm uppercase tracking-widest text-white">Active Since</span>
                      <span class="text-xl font-black font-mono tracking-tighter">${SINCE_YEAR}</span>
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
                      const barOpacity = isHighest ? 'opacity-100' : 'opacity-60';

                      const labelStyle = isHighest
                        ? `style="color: ${getColorValue(COLORS.primary)}; font-weight: 900;"`
                        : 'class="text-slate-800 font-bold"';

                      return `
                    <div class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0 relative">
                      <div class="flex justify-between items-end mb-2">
                        <span ${labelStyle} class="text-lg">${label}</span>
                        <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                          <span style="color: ${getColorValue(COLORS.primary)};" class="font-bold ${isHighest ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}">${count}</span>
                          <span class="text-xs sm:text-sm text-slate-600 ml-0 sm:ml-1 font-mono font-bold">${s.pctStr}</span>
                        </div>
                      </div>
                      <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                        <div style="width: ${s.pct}%; max-width: ${s.pct}%; background-color: ${getColorValue(COLORS.primary)}; ${s.pct === 0 ? 'display: none;' : ''}" 
                             class="progress-bar h-3 rounded-full ${barOpacity} transition-all duration-300">
                        </div>
                      </div>
                    </div>`;
                    })
                    .join('')}
                </div> 
              </div> 

              <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <h3 class="text-xs uppercase tracking-widest font-black text-slate-500 mb-4">Primary Focus Projects</h3>
                  <div class="divide-y divide-slate-100 min-w-0">${topReposHtml}</div>
                </div>
                
                <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                  <h3 class="text-xs uppercase tracking-widest font-black text-slate-500 mb-4 flex items-center">
                    Collaboration Profile
                    <span class="ml-2 cursor-help group relative">
                      ${INFO_ICON_SVG}
                      <span class="invisible group-hover:visible absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded shadow-xl font-bold z-20 text-center leading-normal">
                        Identified by analyzing the highest contribution volume across categories.
                      </span>
                    </span>
                  </h3>
                  <div>
                    <p style="color: ${getColorValue(COLORS.primary)};" class="text-3xl font-black mb-2 tracking-tight">${personaTitle}</p>
                    <p class="text-sm text-slate-600 font-bold leading-relaxed">${personaDesc}</p>
                  </div>
                </div>
              </div>

              <section class="mt-16 pt-12 border-t border-slate-100">
                <h2 class="text-xs uppercase tracking-[0.2em] font-black text-slate-500 mb-8 text-center">Explore Detailed Metrics & Activities</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <a href="reports.html" class="group p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between shadow-sm">
                    <div class="flex items-center space-x-4 mb-4">
                      <div class="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform text-xl">
                        📊
                      </div>
                      <div>
                        <h4 class="font-black text-slate-900">Reports</h4>
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
                        <h4 class="font-black text-slate-900">Community</h4>
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
                        <h4 class="font-black text-slate-900">Articles</h4>
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
}

module.exports = { createAllTimeContributions };
