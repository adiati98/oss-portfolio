const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const {
  COLORS,
  FAVICON_SVG_ENCODED,
  SPARKLES_SVG,
  WORKBENCH_STATUS_COLORS,
} = require('../../config/constants');
const { WORKBENCH_SUCCESS_MESSAGES } = require('../../metadata/workbench-messages');
const { getCommunityStyleCss } = require('../css/style-generator');
const { getColorValue } = require('../../utils/color-helpers');
const { sanitizeAttribute } = require('../../utils/html-helpers');

/**
 * Generates the Community & Activity HTML page.
 */
async function createCommunityHtml(
  contributions,
  rolesData,
  ongoingTasks = [],
  ongoingIssues = [],
  ongoingPRs = [],
  ongoingCoAuthoredPRs = []
) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'community-activity.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();
  const communityCss = getCommunityStyleCss();

  // --- 1. Honors & Recognition Cards ---
  const achievementCards = rolesData.achievements
    .map(
      (ach) => dedent`
        <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 transition-colors duration-200 flex flex-col items-center text-center">
          <div class="p-3 rounded-full mb-4 shrink-0" style="background-color: ${getColorValue(COLORS.primary[10]) || '#f0f7ff'}; color: ${getColorValue(COLORS.primary)};">
            ${SPARKLES_SVG}
          </div>
          <div class="flex flex-col items-center gap-3">
            <h3 class="text-lg font-black leading-tight text-center" style="color: ${getColorValue(COLORS.primary)};">
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
      const statusBg = isActive
        ? getColorValue(COLORS.status.green.bg)
        : getColorValue(COLORS.status.gray.bg);
      const statusColor = isActive
        ? getColorValue(COLORS.status.green.text)
        : getColorValue(COLORS.status.gray.text);
      const bulletColor = isActive
        ? getColorValue(COLORS.status.green.text)
        : getColorValue(COLORS.text.muted);

      const brandColor = getColorValue(COLORS.primary);

      const orgDisplay = role.orgUrl
        ? dedent`
          <a href="${role.orgUrl}" target="_blank" rel="noopener noreferrer" 
             class="hover:underline underline-offset-2 transition-colors" 
             style="color: ${brandColor}; text-decoration-color: ${brandColor};">
            ${sanitizeAttribute(role.org)}
          </a>`
        : `<span class="text-slate-700">${sanitizeAttribute(role.org)}</span>`;

      return dedent`
      <div class="table-row-hover flex flex-col xl:flex-row xl:items-center justify-between p-4 border-b border-slate-100 last:border-0 transition-colors gap-3">
        <div class="flex items-start xl:items-center space-x-3 pr-2">
          <div class="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 xl:mt-0" style="background-color: ${bulletColor};" aria-hidden="true"></div>
          <div>
            <h3 class="font-bold text-slate-900 leading-tight text-base sm:text-lg">${role.title}</h3>
            <p class="text-sm sm:text-base font-medium">${orgDisplay}</p>
          </div>
        </div>
        <div class="flex flex-col items-start xl:items-end justify-center shrink-0 mt-1 xl:mt-0 ml-6 xl:ml-0">
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

  const isBot = (t) => {
    const username = typeof t.user === 'object' ? t.user?.login : t.user;
    const userStr = String(username || '').toLowerCase();
    const titleStr = String(t.title || '').toLowerCase();
    return (
      userStr.includes('dependabot') ||
      titleStr.startsWith('[snyk]') ||
      (titleStr.startsWith('bump') && userStr.includes('dependabot'))
    );
  };

  const todoTasks = ongoingIssues;
  const submittedPRs = ongoingPRs;
  const coAuthoredPRs = ongoingCoAuthoredPRs;
  const manualRequestTasks = ongoingTasks.filter((t) => t.status === 'Request review' && !isBot(t));
  const inProgressTasks = ongoingTasks.filter((t) => t.status === 'Review in progress');
  const botRequestTasks = ongoingTasks.filter((t) => t.status === 'Request review' && isBot(t));

  function renderWorkbenchTable(tasks, label, type, index) {
    const count = tasks.length;
    const displayCount = String(count);
    const openAttribute = index === 0 ? 'open' : '';
    const statusStyle = WORKBENCH_STATUS_COLORS[type] || WORKBENCH_STATUS_COLORS.manual;
    const redText = getColorValue(WORKBENCH_STATUS_COLORS.emptyMessage.text);

    const randomMsg =
      WORKBENCH_SUCCESS_MESSAGES[Math.floor(Math.random() * WORKBENCH_SUCCESS_MESSAGES.length)];

    let sectionContent;

    if (count > 0) {
      const rows = tasks
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map((task) => {
          const repoName = task.repo.split('/')[1] || task.repo;
          const labels = (task.labels || []).map((l) => l.toLowerCase());

          const isDraft = task.isDraft === true;
          const isPendingMerge = task.isApproved && labels.includes('pending-pr-merge');
          const isBlocked =
            !isPendingMerge &&
            labels.some(
              (l) => l.includes('blocked') || l.includes('stalled') || l.includes('wait')
            );

          let rowBgStyle = '';
          let statusIndicator = '';

          // Logic for Row Backgrounds and Indicators
          if (isDraft) {
            rowBgStyle = 'background-color: #f8fafc;';
            statusIndicator = renderStatusIndicator('slate', 'Draft');
          } else if (isPendingMerge) {
            rowBgStyle = 'background-color: #f0fdf4;';
            statusIndicator = renderStatusIndicator('emerald', 'Pending Merge');
          } else if (isBlocked) {
            rowBgStyle = 'background-color: #fff1f2;';
            statusIndicator = renderStatusIndicator('rose', 'Blocked');
          }

          function renderStatusIndicator(color, text) {
            const colors = {
              slate: { dot: 'bg-slate-400', text: 'text-slate-500' },
              emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
              rose: { dot: 'bg-rose-500', text: 'text-rose-700' },
            };
            const theme = colors[color];

            return `
        <div class="flex items-center ${theme.text} mt-1">
          <span class="w-1.5 h-1.5 rounded-full ${theme.dot} mr-2"></span>
          <span class="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">${text}</span>
        </div>`;
          }

          return dedent`
      <tr class="table-row-hover border-b border-slate-100 last:border-0 transition-colors" style="${rowBgStyle}">
        <td class="px-6 py-4 vertical-align-top w-1/3">
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-500">${repoName}</span>
            ${statusIndicator}
          </div>
        </td>
        <td class="px-6 py-4 vertical-align-top">
          <div class="flex flex-col">
            <a href="${task.url}" target="_blank" class="hover:underline font-medium text-sm sm:text-base leading-snug" style="color: ${getColorValue(COLORS.primary)};">
              ${task.title}
            </a>
            ${task.commitCount ? `<span class="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-tighter">${task.commitCount} contributions</span>` : ''}
          </div>
        </td>
      </tr>
    `;
        })
        .join('');

      sectionContent = dedent`
        <div class="overflow-x-auto">
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
      `;
    } else {
      sectionContent = dedent`
        <div class="px-6 py-12 text-center">
          <p class="italic text-sm font-bold leading-relaxed break-words mx-auto max-w-xs sm:max-w-md" style="color: ${redText};">
            ${randomMsg}
          </p>
        </div>
      `;
    }

    return dedent`
      <details class="mb-6 group border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white" ${openAttribute}>
        <summary class="list-none cursor-pointer p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors focus:outline-none">
          <div class="flex items-center gap-3">
             <span class="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-sm font-black uppercase tracking-widest border" 
                  style="background-color: ${getColorValue(statusStyle.bg)}; color: ${getColorValue(statusStyle.text)}; border-color: ${getColorValue(statusStyle.border)};">
              <span class="inline-flex justify-center items-center text-xs sm:text-base border-r pr-2 sm:pr-3 mr-2 sm:mr-3 min-w-[1.2rem]" style="border-color: ${getColorValue(statusStyle.border)};">
                ${displayCount}
              </span>
              <span>${label}</span>
            </span>
            <span class="ml-auto text-slate-400 group-open:rotate-180 transition-transform duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </div>
        </summary>
        <div class="bg-white border-t border-slate-100">
          ${sectionContent}
        </div>
      </details>
    `;
  }

  const sections = [
    { tasks: submittedPRs, label: 'Ongoing PRs', type: 'ongoing' },
    { tasks: coAuthoredPRs, label: 'Moving co-authored PRs forward', type: 'ongoing' },
    { tasks: inProgressTasks, label: 'Review in progress', type: 'ongoing' },
    { tasks: todoTasks, label: 'To do issues', type: 'todo' },
    { tasks: manualRequestTasks, label: 'Request review', type: 'manual' },
    { tasks: botRequestTasks, label: 'Bot request review', type: 'bot' },
  ];

  const workbenchHtml = sections
    .map((section, index) =>
      renderWorkbenchTable(section.tasks, section.label, section.type, index)
    )
    .join('');

  const taskCount =
    ongoingTasks.length + ongoingIssues.length + ongoingPRs.length + ongoingCoAuthoredPRs.length;
  const hasTasks = taskCount > 0;

  const badgeBg = hasTasks
    ? getColorValue(COLORS.status.green.bg)
    : getColorValue(COLORS.status.red.bg);
  const badgeTextColor = hasTasks
    ? getColorValue(COLORS.status.green.text)
    : getColorValue(COLORS.status.red.text);
  const badgeBorderColor = hasTasks
    ? getColorValue(COLORS.status.green.text)
    : getColorValue(COLORS.status.red.text);

  const fullHtml = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Community & Activity | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>
        ${communityCss}
        details summary::-webkit-details-marker { display:none; }
      </style>
    </head>
    <body class="bg-white antialiased flex flex-col h-full min-h-full">
      ${navHtml}
      <main class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-7xl mx-auto">
            <header style="border-bottom-color: ${getColorValue(COLORS.primary[15]) || '#e2e8f0'};" class="text-center mt-16 mb-16 pb-12 border-b-2">
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
                <div class="w-16 h-1.5 rounded-full" style="background-color: ${getColorValue(COLORS.primary)};" aria-hidden="true"></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                ${achievementCards}
              </div>
            </section>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <section class="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="p-6 border-b border-slate-100" style="background-color: ${getColorValue(COLORS.primary[10]) || '#eef2ff'};">
                  <h2 class="text-xl font-bold" style="color: ${getColorValue(COLORS.primary)};">Ecosystem Advocacy & Roles</h2>
                </div>
                <div class="divide-y divide-slate-100">
                  ${rolesItems}
                </div>
              </section>

              <section class="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 mb-6" style="background-color: ${getColorValue(COLORS.primary[10]) || '#eef2ff'};">
                  <h2 class="text-xl font-bold text-center sm:text-left" style="color: ${getColorValue(COLORS.primary)};">
                    Active Workbench
                  </h2>
                  <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border text-center transition-all shadow-sm"
                        style="background-color: ${badgeBg}; color: ${badgeTextColor}; border-color: ${badgeBorderColor};">
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
