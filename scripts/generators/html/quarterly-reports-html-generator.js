const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { BASE_DIR } = require('../../config/config');
const {
  formatDate,
  calculatePeriodInDays,
  getPrStatusContent,
  getCollaborationStatusContent,
} = require('../../utils/contribution-formatters');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { getReportStyleCss } = require('../css/style-generator');
const {
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  SEARCH_SVG,
  LANDING_PAGE_ICONS,
  FAVICON_SVG_ENCODED,
  COLORS,
} = require('../../config/constants');
const { getColorValue } = require('../../utils/color-helpers');

/**
 * Sanitizes a string for safe use in HTML attributes.
 */
function sanitizeAttribute(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generates and writes individual HTML report files for each quarter's contributions.
 */
async function writeHtmlFiles(groupedContributions) {
  const filtersScriptPath = path.join(__dirname, '../../utils/table-filters.js');
  let tableFiltersScript = '';
  try {
    tableFiltersScript = await fs.readFile(filtersScriptPath, 'utf8');
  } catch (err) {
    console.warn(
      'Warning: utils/table-filters.js not found. Interactive features will be disabled.'
    );
  }

  const allReports = Object.entries(groupedContributions)
    .map(([key, data]) => {
      const [year, quarterPrefix] = key.split('-');
      const fullQuarterName = `${quarterPrefix} ${year}`;

      return {
        key,
        year,
        quarterPrefix,
        fullQuarterName,
        data,
        totalContributions: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  function getStatusBadgeHtml(status) {
    const cleanedStatus = status.toUpperCase().trim();
    let bgColor = COLORS.status?.gray?.bg || '#f1f5f9';
    let textColor = COLORS.status?.gray?.text || '#475569';
    let fontWeight = 'font-medium';

    switch (cleanedStatus) {
      case 'OPEN':
        bgColor = COLORS.status?.green?.bg || '#dcfce7';
        textColor = COLORS.status?.green?.text || '#166534';
        fontWeight = 'font-semibold';
        break;
      case 'MERGED':
        bgColor = COLORS.status?.purple?.bg || '#f3e8ff';
        textColor = COLORS.status?.purple?.text || '#6b21a8';
        fontWeight = 'font-semibold';
        break;
      case 'CLOSED':
        bgColor = COLORS.status?.red?.bg || '#fee2e2';
        textColor = COLORS.status?.red?.text || '#991b1b';
        fontWeight = 'font-semibold';
        break;
    }

    const style = `background-color: ${bgColor}; color: ${textColor};`;
    return `<span class="inline-block px-2 py-0.5 text-xs rounded-full ${fontWeight}" style="${style}">${cleanedStatus}</span>`;
  }

  function formatPrStatusWithBadge(content) {
    const parts = content.split('<br>');
    if (parts.length < 2) return { html: content, statusText: 'N/A' };

    const date = parts[0];
    const rawStatusTag = parts[1];
    const statusMatch = rawStatusTag.match(/<strong>(.*?)<\/strong>/i);
    const statusWord = statusMatch && statusMatch[1] ? statusMatch[1] : 'N/A';

    const statusBadge = getStatusBadgeHtml(statusWord);
    return {
      html: `${date}<br>${statusBadge}`,
      statusText: statusWord,
    };
  }

  function generateReportNavButton(index) {
    const reports = allReports;
    const previousReport = index > 0 ? reports[index - 1] : null;
    const nextReport = index < reports.length - 1 ? reports[index + 1] : null;

    let previousButton = '';
    let nextButton = '';

    const getReportPath = (report) => {
      const fileName = `${report.quarterPrefix}-${report.year}.html`;
      return `../${report.year}/${fileName}`;
    };

    const baseClasses =
      'w-40 xs:w-44 sm:w-52 h-20 p-2 sm:p-4 flex flex-col justify-center rounded-lg shadow-md transition duration-200 border border-gray-200';

    if (previousReport) {
      const prevPath = getReportPath(previousReport);
      previousButton = dedent`
        <a href="${prevPath}" class="${baseClasses} bg-white nav-report-button text-left" style="color: ${getColorValue(COLORS.primary)};">
          <span class="text-[10px] sm:text-xs font-medium text-gray-500">Previous</span>
          <span class="flex items-center space-x-1 font-bold text-sm sm:text-lg break-words whitespace-normal" style="color: ${getColorValue(COLORS.primary)};">
            ${LEFT_ARROW_SVG}
            <span class="whitespace-normal min-w-0">${previousReport.fullQuarterName}</span>
          </span>
        </a>
      `;
    } else {
      previousButton = '<div class="w-52 h-20"></div>';
    }

    if (nextReport) {
      const nextPath = getReportPath(nextReport);
      nextButton = dedent`
        <a href="${nextPath}" class="${baseClasses} bg-white nav-report-button text-right" style="color: ${getColorValue(COLORS.primary)};">
          <span class="text-[10px] sm:text-xs font-medium text-gray-500">Next</span>
          <span class="flex items-center space-x-1 justify-end font-bold text-sm sm:text-lg break-words whitespace-normal" style="color: ${getColorValue(COLORS.primary)};">
            <span class="whitespace-normal min-w-0">${nextReport.fullQuarterName}</span>
            ${RIGHT_ARROW_SVG}
          </span>
        </a>
      `;
    } else {
      nextButton = '<div class="w-52 h-20"></div>';
    }

    return dedent`
      <div class="mt-12 mb-8 w-full flex justify-center">
        <div class="max-w-[120ch] mx-auto w-full flex justify-between items-center gap-4 px-2 sm:px-8 lg:px-12 xl:px-16 2xl:px-24">
          ${previousButton}
          ${nextButton}
        </div>
      </div>
    `;
  }

  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const quarterlyFileLinks = [];
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const dynamicCss = getReportStyleCss();

  for (let index = 0; index < allReports.length; index++) {
    const report = allReports[index];
    const { key, year, quarterPrefix: quarter, data, totalContributions } = report;
    const footerHtml = createFooterHtml().trim();
    const navHtmlForReports = createNavHtml('../');

    const yearDir = path.join(htmlBaseDir, year);
    await fs.mkdir(yearDir, { recursive: true });

    const filename = `${quarter}-${year}.html`;
    const relativePath = path.join(year, filename);
    const filePath = path.join(yearDir, filename);

    if (totalContributions === 0) continue;

    const allItems = [
      ...data.pullRequests,
      ...data.issues,
      ...data.reviewedPrs,
      ...data.coAuthoredPrs,
      ...data.collaborations,
    ];
    const totalRepos = new Set(allItems.map((item) => item.repo)).size;

    const repoCounts = allItems.reduce((acc, item) => {
      acc[item.repo] = (acc[item.repo] || 0) + 1;
      return acc;
    }, {});

    const top3Repos = Object.entries(repoCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(
        (item) => dedent`
          <li class="pl-2"><a href='https://github.com/${item[0]}' target='_blank' class="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm">${item[0]}</a> (${item[1]} contributions)</li>
        `
      )
      .join('');

    const sections = {
      pullRequests: {
        title: 'Merged PRs',
        icon: LANDING_PAGE_ICONS.merged,
        id: 'merged-prs',
        headers: ['No.', 'Project', 'Title', 'Created', 'Merged', 'Review Period'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number'],
      },
      issues: {
        title: 'Issues',
        icon: LANDING_PAGE_ICONS.issues,
        id: 'issues',
        headers: ['No.', 'Project', 'Title', 'Created', 'Closed', 'Closing Period'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number'],
      },
      reviewedPrs: {
        title: 'Reviewed PRs',
        icon: LANDING_PAGE_ICONS.reviewed,
        id: 'reviewed-prs',
        headers: [
          'No.',
          'Project',
          'Title',
          'Created At',
          'First Review',
          'Review Period',
          'Status',
        ],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number', 'status'],
      },
      coAuthoredPrs: {
        title: 'Co-Authored PRs',
        icon: LANDING_PAGE_ICONS.coAuthored,
        id: 'co-authored-prs',
        headers: [
          'No.',
          'Project',
          'Title',
          'Created At',
          'First Commit',
          'Commit Period',
          'Status',
        ],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number', 'status'],
      },
      collaborations: {
        title: 'Collaborations',
        icon: LANDING_PAGE_ICONS.collaborations,
        id: 'collaborations',
        headers: ['No.', 'Project', 'Title', 'Created At', 'First Comment', 'Status'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'status'],
      },
    };

    let htmlContent = dedent`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${quarter} ${year} Contributions Report</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    ${dynamicCss}
  </style>
</head>
<body>
${navHtmlForReports}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header style="border-bottom-color: ${COLORS.primary[15] || '#e2e8f0'};" class="text-center mt-16 mb-12 pb-4 border-b-2">
          <h1 style="color: ${getColorValue(COLORS.primary)};" class="text-4xl sm:text-5xl font-extrabold mb-2 pt-8">${quarter} ${year}</h1>
          <p class="text-lg text-gray-500 mt-2">Open Source Contributions Report</p>
        </header>

        <section class="mb-8">
          <h2 style="border-left-color: ${getColorValue(COLORS.primary)};" class="text-3xl font-semibold text-gray-800 mb-12 border-l-4 pl-3">📊 Quarterly Statistics</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div style="background-color: ${getColorValue(COLORS.primary)};" class="text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <p class="text-4xl font-extrabold">${totalContributions}</p>
            <p class="text-lg mt-2 font-medium">Total Contributions</p>
          </div>
          <div style="background-color: ${getColorValue(COLORS.primary)};" class="text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <p class="text-4xl font-extrabold">${totalRepos}</p>
            <p class="text-lg mt-2 font-medium">Total Repositories</p>
          </div>
          </div>
        </section>

        <section class="mb-8">
          <h3 class="text-2xl font-semibold text-gray-800 mt-16 mb-4 border-l-4 border-green-500 pl-3">Contribution Breakdown</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            ${Object.keys(sections)
              .map((key) => {
                const sec = sections[key];
                const count = data[key]?.length || 0;
                return `
              <a href="#${sec.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${getColorValue(COLORS.primary)};">
                <span class="text-2xl font-bold" style="color: ${getColorValue(COLORS.primary)};">${count}</span>
                <div class="flex items-center justify-center gap-1.5 text-gray-500 mt-1">
                  <span class="breakdown-icon-wrapper opacity-70">${sec.icon}</span>
                  <span class="breakdown-label">${sec.title}</span>
                </div>
              </a>`;
              })
              .join('')}
          </div>
        </section>

        <section class="mb-8">
          <h3 class="text-2xl font-semibold text-gray-800 mb-4 border-l-4 border-yellow-500 pl-3">Top 3 Repositories</h3>
          <div class="p-4 bg-gray-50 rounded-lg shadow-sm">
            <ol class="list-decimal list-inside pl-4 text-gray-600 space-y-1">${top3Repos}</ol>
          </div>
        </section>

        <hr class="my-8 border-gray-200">
        <section class="space-y-6">
    `;

    for (const [section, sectionInfo] of Object.entries(sections)) {
      let items = data[section] || [];
      if (section === 'reviewedPrs')
        items = [...items].sort(
          (a, b) => new Date(b.myFirstReviewDate) - new Date(a.myFirstReviewDate)
        );
      if (section === 'coAuthoredPrs')
        items = [...items].sort(
          (a, b) => new Date(b.firstCommitDate) - new Date(a.firstCommitDate)
        );

      htmlContent += `<details id="${sectionInfo.id}" class="border border-gray-200 rounded-xl p-4 shadow-sm">\n`;
      htmlContent += ` <summary style="color: ${getColorValue(COLORS.primary)};" class="text-xl font-bold cursor-pointer outline-none">\n`;
      htmlContent += `  <div class="inline-flex items-center flex-nowrap gap-2 ml-3" style="vertical-align: middle;">\n`;
      htmlContent += `    <span class="w-6 h-6 flex items-center shrink-0">${sectionInfo.icon}</span>\n`;
      htmlContent += `    <span class="text-xl font-bold whitespace-nowrap">${sectionInfo.title} (${items.length})</span>\n`;
      htmlContent += `  </div>\n`;
      htmlContent += ` </summary>\n`;

      if (items.length === 0) {
        htmlContent += `<div class="p-4 text-gray-500 bg-gray-50 rounded-lg">No contributions of this type in this quarter.</div>\n`;
      } else {
        htmlContent += dedent`
          <div class="flex flex-wrap gap-2 items-center mb-4 mt-2 px-1">
            <div class="icon-input-container grow">
              <div class="input-icon" style="color: ${getColorValue(COLORS.primary)};">${SEARCH_SVG}</div>
              <input type="text" id="${sectionInfo.id}-search" placeholder="Search..." class="search-input w-full border rounded-md px-3 py-2 text-sm focus:outline-none transition" style="border-color: ${getColorValue(COLORS.primary)};" />
            </div>
            <button class="reset-btn bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition">Reset</button>
          </div>
          <div class="overflow-x-auto rounded-lg border border-gray-100 max-h-[70vh] overflow-y-auto">
            <table class="report-table min-w-full divide-y divide-gray-200 bg-white">
              <thead>
                <tr>
                  ${sectionInfo.headers
                    .map((h, i) => {
                      const type = sectionInfo.colTypes[i];
                      return i === 0
                        ? `<th class="py-3 px-4">${h}</th>`
                        : `<th data-type="${type}" class="py-3 px-4 cursor-pointer" style="color: ${getColorValue(COLORS.primary)};">${h} <span class="sort-icon ml-1">↕</span></th>`;
                    })
                    .join('')}
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
        `;

        items.forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
          htmlContent += `<tr class="${rowBg} table-row-hover">`;
          htmlContent += `<td>${idx + 1}.</td>`;
          htmlContent += `<td data-value="${item.repo}"><span class="font-mono text-xs bg-gray-100 p-1 rounded">${item.repo}</span></td>`;
          htmlContent += `<td data-value="${sanitizeAttribute(item.title)}"><a href="${item.url}" target="_blank" class="text-blue-600 hover:underline">${item.title}</a></td>`;

          if (section === 'pullRequests') {
            htmlContent += `<td>${formatDate(item.createdAt)}</td><td>${formatDate(item.mergedAt)}</td><td>${calculatePeriodInDays(item.createdAt, item.mergedAt)}</td>`;
          } else if (section === 'issues') {
            const closing = calculatePeriodInDays(item.date, item.closedAt, 'open');
            htmlContent += `<td>${formatDate(item.date)}</td><td>${formatDate(item.closedAt)}</td><td>${closing === '<strong>OPEN</strong>' ? getStatusBadgeHtml('OPEN') : closing}</td>`;
          } else if (section === 'reviewedPrs' || section === 'coAuthoredPrs') {
            const date1 = section === 'reviewedPrs' ? item.myFirstReviewDate : item.firstCommitDate;
            const statusObj = formatPrStatusWithBadge(getPrStatusContent(item));
            htmlContent += `<td>${formatDate(item.createdAt)}</td><td>${formatDate(date1)}</td><td>${calculatePeriodInDays(item.createdAt, date1)}</td><td>${statusObj.html}</td>`;
          } else if (section === 'collaborations') {
            const statusObj = formatPrStatusWithBadge(getCollaborationStatusContent(item));
            htmlContent += `<td>${formatDate(item.createdAt)}</td><td>${formatDate(item.firstCommentedAt)}</td><td>${statusObj.html}</td>`;
          }
          htmlContent += `</tr>`;
        });
        htmlContent += `</tbody></table></div>`;
      }
      htmlContent += `</details>`;
    }

    htmlContent += dedent`
          </section>
          ${generateReportNavButton(index)}
        </div>
      </div>
    </main>
    <script>
      ${tableFiltersScript}
      function openSectionFromHash() {
        const hash = window.location.hash || '#merged-prs';
        const target = document.querySelector(hash);
        if (target && target.tagName === 'DETAILS') {
          document.querySelectorAll('details').forEach(d => d.open = false);
          target.open = true;
          setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
      }
      window.addEventListener('DOMContentLoaded', openSectionFromHash);
      window.addEventListener('hashchange', openSectionFromHash);
    </script>
    ${footerHtml}
</body>
</html>`;

    const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
    await fs.writeFile(filePath, formattedContent, 'utf8');
    quarterlyFileLinks.push({ path: relativePath, total: totalContributions });
  }
  return quarterlyFileLinks;
}

module.exports = { writeHtmlFiles };
