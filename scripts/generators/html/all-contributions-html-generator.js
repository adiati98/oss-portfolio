const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import the dedent utility
const { dedent } = require('../../utils/dedent');

// Import configuration
const { BASE_DIR, SINCE_YEAR } = require('../../config/config');

// Import navbar and footer
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');

// Import favicon svg and constants
const {
  RIGHT_ARROW_SVG,
  FAVICON_SVG_ENCODED,
  COLORS,
  PULL_REQUEST_LARGE_SVG,
} = require('../../config/constants');

// Import the style generator function
const { getIndexStyleCss } = require('../css/style-generator');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_README_FILENAME = 'all-contributions.html';
const rightArrowSvg = RIGHT_ARROW_SVG;

/**
 * Determines the contributor's persona title and description.
 * Uses count-based logic with a priority system for tie-breaking.
 */
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
 * Calculates aggregate totals from all contribution data and writes the
 * all-time contributions HTML report file.
 */
async function createAllTimeContributions(finalContributions = []) {
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
        <div class="flex flex-col sm:flex-row sm:items-start justify-between py-4 border-b border-slate-50 last:border-0 gap-3 sm:gap-4">
          <div class="flex flex-col min-w-0">
            ${
              owner
                ? `
              <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono leading-none mb-1">
                ${owner}
              </span>`
                : ''
            }
            
            <a href="${repoUrl}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="${nameClass} break-all hover:underline underline-offset-4" 
               style="color: ${COLORS.primary.rgb};"
               title="View ${repo} repository">
              ${name}
            </a>
          </div>
          
          <div class="flex items-center shrink-0 mt-1 sm:mt-0">
            <span class="text-xs font-bold text-slate-400 whitespace-nowrap px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
              ${count} contributions
            </span>
          </div>
        </div>`;
          })
          .join('')
      : '<p class="text-sm text-slate-400 italic">No activity recorded yet.</p>';

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
          <h1 style="color: ${COLORS.primary.rgb};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
            All-Time Contributions
          </h1>
          <p style="color: ${COLORS.text.secondary};" class="text-xl max-w-3xl mx-auto leading-relaxed">
            Aggregated lifetime metrics and high-level performance across all tracked repositories since ${SINCE_YEAR}.
          </p>
        </header>

        <section>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            <div style="background-color: ${COLORS.primary.rgb};" class="relative overflow-hidden text-white p-6 sm:p-10 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-white/20">
              <div class="absolute right-0 -top-2 opacity-10 rotate-20 w-48 h-48 pointer-events-none">${PULL_REQUEST_LARGE_SVG}</div>
              <div class="relative z-10 space-y-2">
                <p class="text-xs uppercase tracking-widest font-bold opacity-70">Total Impact</p>
                <p class="text-7xl font-black tracking-tight">${grandTotal}</p>
                <p class="text-lg opacity-90 font-medium">Lifetime Contributions</p>
              </div>
              <div class="relative z-10 h-px bg-white/20 my-8"></div>
              <div class="relative z-10 grid grid-cols-2 gap-4">
                <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <div class="h-8 flex items-end"><p class="text-2xl sm:text-3xl font-bold leading-none">${totalUniqueRepos}</p></div>
                  <p class="text-[10px] uppercase tracking-wider opacity-80 leading-tight mt-1">Repos</p>
                </div>
                <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <div class="h-8 flex items-end"><p class="text-2xl sm:text-3xl font-bold leading-none">${(grandTotal / (new Date().getFullYear() - SINCE_YEAR + 1)).toFixed(0)}</p></div>
                  <p class="text-[10px] uppercase tracking-wider opacity-80 leading-tight mt-1">Yearly Average</p>
                </div>
                <div class="bg-white/10 rounded-xl p-4 col-span-2 backdrop-blur-sm flex justify-between items-center">
                  <span class="text-[10px] uppercase tracking-wider opacity-80 font-bold">Active Since</span>
                  <span class="text-xl font-bold font-mono tracking-tighter">${SINCE_YEAR}</span>
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
                    ? 'style="color: ' + COLORS.primary.rgb + '; font-weight: 800;"'
                    : 'class="text-slate-700 font-bold"';

                  const countClass = isHighest ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl';
                  const pctClass = isHighest ? 'text-sm sm:text-base' : 'text-xs sm:text-sm';

                  return (
                    `
                <div class="flex-1 flex flex-col justify-center px-8 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0 relative">
                  <div class="flex justify-between items-end mb-2">
                    <span ` +
                    labelStyle +
                    ` class="text-lg">${label}</span>
                    <div class="flex flex-col sm:flex-row items-end sm:items-baseline">
                      <span style="color: ` +
                    COLORS.primary.rgb +
                    `;" class="font-bold ` +
                    countClass +
                    `">${count}</span>
                      <span class="` +
                    pctClass +
                    ` text-gray-400 ml-0 sm:ml-1 font-mono">${s.pctStr}</span>
                    </div>
                  </div>
                  <div class="w-full bg-slate-100/50 rounded-full h-3 overflow-hidden flex">
                    <div style="width: ${s.pct}%; max-width: ${s.pct}%; background-color: ` +
                    COLORS.primary.rgb +
                    `; ${s.pct === 0 ? 'display: none;' : ''}" 
                           class="progress-bar h-3 rounded-full ${barOpacity} transition-all duration-300">
                    </div>
                  </div>
                </div>`
                  );
                })
                .join('')}
            </div> 
          </div> 

          <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <h3 class="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4">Primary Focus Projects</h3>
              <div class="divide-y divide-slate-50 min-w-0">${topReposHtml}</div>
            </div>
            
            <div class="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <h3 class="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center">
                Collaboration Profile
                <span class="ml-2 cursor-help group relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50 hover:opacity-100"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
                  <span class="invisible group-hover:visible absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded shadow-xl normal-case font-medium z-20 text-center leading-normal">
                    Identified by analyzing the highest contribution volume across categories.
                  </span>
                </span>
              </h3>
              <div>
                <p style="color: ${COLORS.primary.rgb};" class="text-3xl font-black mb-2 tracking-tight">${personaTitle}</p>
                <p class="text-sm text-slate-500 leading-relaxed">${personaDesc}</p>
              </div>
            </div>
          </div>

          <div class="mt-20 p-6 sm:p-12 rounded-3xl text-center border-2 border-dashed border-slate-200">
            <h2 class="text-2xl font-bold mb-4 text-slate-800">Detailed Quarterly Reports</h2>
            <p class="text-slate-500 mb-8 max-w-2xl mx-auto">See specific contributions, repository breakdowns, and timeline of activities.</p>
            <p class="text-center">
              <a href="reports.html" style="color: ${COLORS.primary.rgb}; border-color: ${COLORS.primary[15]};" class="inline-flex items-center space-x-2 px-8 py-4 bg-white border font-bold rounded-xl shadow-md transition duration-200 hover:shadow-lg">
                <span>View All Reports</span> ${rightArrowSvg}
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

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
}

module.exports = { createAllTimeContributions };
