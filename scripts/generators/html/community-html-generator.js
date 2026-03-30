const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { BASE_DIR } = require('../../config/config');
const { COLORS, FAVICON_SVG_ENCODED, SPARKLES_SVG } = require('../../config/constants');
const { getCommunityStyleCss } = require('../css/style-generator');
const leadershipData = require('../../../metadata/leadership');

/**
 * Generates the Community & Activity HTML page.
 */
async function createCommunityHtml(contributions, rolesData) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'community-activity.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();
  const communityCss = getCommunityStyleCss();

  const getColorValue = (colorObj, fallback = '#000000') => {
    if (typeof colorObj === 'string') return colorObj;
    return colorObj?.rgb || colorObj || fallback;
  };

  const { pullRequests } = contributions;
  const openPRs = pullRequests
    .filter((pr) => pr.status === 'open' || pr.status === 'draft')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const indigoColor = '#4338ca';
  const softIndigoBg = '#eef2ff';

  // High-contrast accessibility overrides
  const highContrastRed = '#b91c1c'; // Red-700 for AA contrast

  // --- 1. Honors & Recognition Cards ---
  const achievementCards = rolesData.achievements
    .map(
      (ach) => dedent`
        <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 transition-colors duration-200 flex flex-col items-center text-center">
          <div class="p-3 rounded-full mb-4 shrink-0" style="background-color: ${COLORS.primary[10] || '#f0f7ff'}; color: ${indigoColor};">
            ${SPARKLES_SVG}
          </div>
          <div class="flex flex-col items-center gap-3">
            <h3 class="text-lg font-black leading-tight text-center" style="color: ${indigoColor};">
              ${ach.title}
            </h3>
            <div class="inline-flex items-center justify-center h-auto min-h-7 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200 text-center">
              ${ach.org} <span class="mx-2 opacity-40" aria-hidden="true">|</span> ${ach.year}
            </div>
          </div>
        </div>
      `
    )
    .join('');

  // --- 2. Ecosystem Advocacy & Roles ---
  const rolesItems = rolesData.roles
    .map((role) => {
      const isActive = role.active;
      const statusBg = isActive ? COLORS.status.green.bg : COLORS.status.gray.bg;
      const statusColor = isActive ? COLORS.status.green.text : COLORS.status.gray.text;
      const bulletColor = isActive ? '#10b981' : '#94a3b8';

      return dedent`
        <div class="table-row-hover flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 last:border-0 transition-colors">
          <div class="flex items-center space-x-4">
            <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${bulletColor};" aria-hidden="true"></div>
            <div>
              <h3 class="font-bold text-slate-900">${role.title}</h3>
              <p class="text-sm text-slate-500">${role.org}</p>
            </div>
          </div>
          <div class="text-right shrink-0 ml-4">
            <span class="px-2 py-1 rounded text-xs font-bold uppercase tracking-widest mb-1 block" 
                  style="background-color: ${statusBg}; color: ${statusColor};">
              ${isActive ? 'Active' : 'Past'}
            </span>
            <span class="text-xs font-mono text-slate-500 block leading-tight">${role.period}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // --- 3. Active Workbench Rows ---
  const workbenchRows = openPRs
    .map((pr) => {
      const repoName = pr.repo.split('/')[1];
      return dedent`
        <tr class="table-row-hover border-b border-slate-100 last:border-0 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">${new Date(pr.date).getFullYear()}</td>
          <td class="px-6 py-4 text-sm font-bold text-slate-700">${repoName}</td>
          <td class="px-6 py-4 text-sm min-w-[200px] break-words">
            <a href="${pr.url}" target="_blank" class="hover:underline font-medium inline-flex items-center group" style="color: ${indigoColor};">
              ${pr.status === 'draft' ? `<span class="mr-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200 uppercase font-bold shrink-0">Draft</span>` : ''}
              <span>${pr.title}</span>
              <svg class="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          </td>
        </tr>
      `;
    })
    .join('');

  // --- Logic for Task-specific Colors ---
  const hasTasks = openPRs.length > 0;
  const badgeBg = hasTasks ? COLORS.status.green.bg : COLORS.status.red.bg;
  const badgeTextColor = hasTasks ? COLORS.status.green.text : highContrastRed;
  const badgeBorderColor = hasTasks ? 'border-green-200' : 'border-red-200';

  const fullHtml = dedent`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Community & Activity | Open Source Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>
        ${communityCss}
      </style>
    </head>
    <body class="bg-white antialiased">
      ${navHtml}
      <main class="grow w-full">
        <div class="min-h-full px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-7xl mx-auto">
            <header style="border-bottom-color: ${COLORS.primary[15] || '#e2e8f0'};" class="text-center mt-12 mb-16 pb-12 border-b-2">
              <h1 style="color: ${getColorValue(COLORS.primary)};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
                Community & Activity
              </h1>
              <p style="color: ${COLORS.text?.secondary || '#374151'};" class="text-xl max-w-3xl mx-auto leading-relaxed">
                A showcase of ecosystem honors, dedicated stewardship roles, and real-time maintenance efforts.
              </p>
            </header>

            <section class="mb-24" aria-labelledby="milestones-heading">
              <div class="flex flex-col items-center mb-10">
                <h2 id="milestones-heading" class="text-sm font-black uppercase tracking-[0.4em] text-slate-500 mb-3 text-center">Milestones and Awards</h2>
                <div class="w-16 h-1.5 bg-indigo-500 rounded-full" aria-hidden="true"></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                ${achievementCards}
              </div>
            </section>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <section class="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" aria-labelledby="roles-heading">
                <div class="p-6 border-b border-slate-100" style="background-color: ${softIndigoBg};">
                  <h2 id="roles-heading" class="text-xl font-bold" style="color: ${indigoColor};">Ecosystem Advocacy & Roles</h2>
                </div>
                <div class="divide-y divide-slate-100">
                  ${rolesItems}
                </div>
              </section>

              <section class="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" aria-labelledby="workbench-heading">
                <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4" style="background-color: ${softIndigoBg};">
                  <h2 id="workbench-heading" class="text-xl font-bold text-center sm:text-left" style="color: ${indigoColor};">
                    Active Workbench
                  </h2>
                  <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${badgeBorderColor} text-center transition-all"
                        style="background-color: ${badgeBg}; color: ${badgeTextColor};">
                    ${openPRs.length} Ongoing Tasks
                  </span>
                </div>

                <div class="overflow-x-auto">
                  <table class="min-w-full">
                    <caption class="sr-only">List of active maintenance tasks and pull requests</caption>
                    <thead class="bg-slate-50/80">
                      <tr>
                        <th scope="col" class="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Year</th>
                        <th scope="col" class="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Repo</th>
                        <th scope="col" class="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Pull Request</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      ${
                        workbenchRows ||
                        `<tr>
                          <td colspan="3" class="px-6 py-16 text-center italic font-medium" style="color: ${highContrastRed};">
                            No active maintenance tasks.
                          </td>
                        </tr>`
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      ${footerHtml}
    </body>
    </html>
  `;

  const formattedContent = await prettier.format(fullHtml, { parser: 'html' });
  await fs.writeFile(outputPath, formattedContent, 'utf8');
}

module.exports = { createCommunityHtml };
