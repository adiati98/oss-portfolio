const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { BASE_DIR } = require('../../config/config');
const { COLORS, FAVICON_SVG_ENCODED, SPARKLES_SVG } = require('../../config/constants');
const { getReportsListStyleCss } = require('../css/style-generator');
const { getColorValue } = require('../../utils/color-helpers');
const { sanitizeAttribute } = require('../../utils/html-helpers');

/**
 * Generates the Community & Activity HTML page.
 */
async function createCommunityHtml(contributions, rolesData, ongoingTasks = []) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'community-activity.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();
  const communityCss = getReportsListStyleCss();

  const indigoColor = '#4338ca';
  const softIndigoBg = '#eef2ff';

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
              ${sanitizeAttribute(ach.org)} <span class="mx-2 opacity-40" aria-hidden="true">|</span> ${ach.year}
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
        <div class="table-row-hover flex flex-col xl:flex-row xl:items-center justify-between p-4 border-b border-slate-100 last:border-0 transition-colors gap-3">
          <div class="flex items-start xl:items-center space-x-3 pr-2">
            <div class="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 xl:mt-0" style="background-color: ${bulletColor};" aria-hidden="true"></div>
            <div>
              <h3 class="font-bold text-slate-900 leading-tight text-base">${role.title}</h3>
              <p class="text-sm text-slate-700 font-medium">${role.org}</p>
            </div>
          </div>
          <div class="flex flex-col items-start xl:items-end justify-center shrink-0 mt-1 xl:mt-0">
            <span class="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-widest mb-1" 
                  style="background-color: ${statusBg}; color: ${statusColor};">
              ${isActive ? 'Active' : 'Past'}
            </span>
            <span class="text-sm font-mono text-slate-500 leading-tight">${role.period}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // --- 3. Active Workbench Dashboard Logic ---
  const requestedTasks = ongoingTasks.filter((t) => t.status === 'Request review');
  const underReviewTasks = ongoingTasks.filter((t) => t.status === 'Under review');

  /**
   * Helper function to render specific status tables inside details/summary
   */
  function renderWorkbenchTable(tasks, statusLabel, index) {
    const count = tasks.length;
    const isRequest = statusLabel === 'Request review';
    const displayLabel = isRequest ? 'Request review' : 'Ongoing review';

    // Logic: Only the first table (index 0) is open by default
    const isOpen = index === 0 ? 'open' : '';

    const labelText = isRequest ? '#92400e' : '#1e40af';
    const labelBorder = isRequest ? '#fde68a' : '#bfdbfe';

    const rows =
      count > 0
        ? tasks
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .map((task) => {
              const repoName = task.repo.split('/')[1];
              return dedent`
              <tr class="table-row-hover border-b border-slate-100 last:border-0 transition-colors">
                <td class="px-6 py-4 text-sm font-semibold text-slate-500 w-1/3">${repoName}</td>
                <td class="px-6 py-4">
                  <a href="${task.url}" target="_blank" class="hover:underline font-medium text-sm sm:text-base inline-flex items-center leading-snug" style="color: ${indigoColor};">
                    <span>${task.title}</span>
                  </a>
                </td>
              </tr>
            `;
            })
            .join('')
        : dedent`
          <tr>
            <td colspan="2" class="px-6 py-10 text-center italic text-slate-400 text-sm">
              No tasks currently in this stage.
            </td>
          </tr>
        `;

    return dedent`
      <details class="mb-6 group border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white" ${isOpen}>
        <summary class="list-none cursor-pointer p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors focus:outline-none">
          <div class="flex items-center gap-3">
             <span class="inline-flex items-center gap-3 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest border bg-white" 
                  style="color: ${labelText}; border-color: ${labelBorder};">
              <span class="text-base border-r pr-3" style="border-color: ${labelBorder};">${count}</span>
              <span>${displayLabel}</span>
            </span>
            <span class="ml-auto text-slate-400 group-open:rotate-180 transition-transform duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </div>
        </summary>
        <div class="overflow-x-auto bg-white border-t border-slate-100">
          <div class="min-w-[600px]">
            <table class="min-w-full">
              <thead class="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-black text-slate-700 uppercase tracking-widest">Repository</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-black text-slate-700 uppercase tracking-widest">Task</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    `;
  }

  const workbenchHtml = [
    renderWorkbenchTable(requestedTasks, 'Request review', 0),
    renderWorkbenchTable(underReviewTasks, 'Under review', 1),
  ].join('');

  const taskCount = ongoingTasks.length;
  const hasTasks = taskCount > 0;
  const badgeBg = hasTasks ? COLORS.status.green.bg : COLORS.status.red.bg;
  const badgeTextColor = hasTasks ? COLORS.status.green.text : '#b91c1c';

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
        details summary::-webkit-details-marker { display:none; }
      </style>
    </head>
    <body class="bg-white antialiased">
      ${navHtml}
      <main class="grow w-full">
        <div class="min-h-full px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-7xl mx-auto">
            <header style="border-bottom-color: ${COLORS.primary[15] || '#e2e8f0'};" class="text-center mt-16 mb-16 pb-12 border-b-2">
              <h1 style="color: ${getColorValue(COLORS.primary)};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
                Community & Activity
              </h1>
              <p class="text-xl max-w-3xl mx-auto leading-relaxed text-slate-600">
                A showcase of ecosystem honors, dedicated stewardship roles, and real-time maintenance efforts.
              </p>
            </header>

            <section class="mb-20" aria-labelledby="milestones-heading">
              <div class="flex flex-col items-center mb-10">
                <h2 id="milestones-heading" class="text-sm font-black uppercase tracking-[0.4em] text-slate-600 mb-3 text-center">Milestones and Awards</h2>
                <div class="w-16 h-1.5 bg-indigo-500 rounded-full" aria-hidden="true"></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                ${achievementCards}
              </div>
            </section>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <section class="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="p-6 border-b border-slate-100" style="background-color: ${softIndigoBg};">
                  <h2 class="text-xl font-bold" style="color: ${indigoColor};">Ecosystem Advocacy & Roles</h2>
                </div>
                <div class="divide-y divide-slate-100">
                  ${rolesItems}
                </div>
              </section>

              <section class="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 mb-6" style="background-color: ${softIndigoBg};">
                  <h2 class="text-xl font-bold text-center sm:text-left" style="color: ${indigoColor};">
                    Active Workbench
                  </h2>
                  <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-slate-200 text-center transition-all shadow-sm bg-white"
                        style="color: ${badgeTextColor};">
                    ${taskCount} Ongoing Tasks
                  </span>
                </div>

                <div class="px-6 pb-8">
                  ${workbenchHtml}
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
