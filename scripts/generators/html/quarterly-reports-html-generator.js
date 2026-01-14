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

// Import navbar and footer
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

async function writeHtmlFiles(groupedContributions) {
  const filtersScriptPath = path.join(__dirname, '../../utils/table-filters.js');
  let tableFiltersScript = '';
  try {
    tableFiltersScript = await fs.readFile(filtersScriptPath, 'utf8');
  } catch (err) {
    console.warn('Warning: utils/table-filters.js not found.');
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
    let bgColor = COLORS.status.gray.bg;
    let textColor = COLORS.status.gray.text;
    let fontWeight = 'font-medium';

    switch (cleanedStatus) {
      case 'OPEN':
        bgColor = COLORS.status.green.bg;
        textColor = COLORS.status.green.text;
        fontWeight = 'font-semibold';
        break;
      case 'MERGED':
        bgColor = COLORS.status.purple.bg;
        textColor = COLORS.status.purple.text;
        fontWeight = 'font-semibold';
        break;
      case 'CLOSED':
        bgColor = COLORS.status.red.bg;
        textColor = COLORS.status.red.text;
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
        <a href="${prevPath}" class="${baseClasses} bg-white nav-report-button text-left" style="color: ${COLORS.primary.rgb};">
          <span class="text-[10px] sm:text-xs font-medium text-gray-500">Previous</span>
          <span class="flex items-center space-x-1 font-bold text-sm sm:text-lg break-words whitespace-normal" style="color: ${COLORS.primary.rgb};">
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
        <a href="${nextPath}" class="${baseClasses} bg-white nav-report-button text-right" style="color: ${COLORS.primary.rgb};">
          <span class="text-[10px] sm:text-xs font-medium text-gray-500">Next</span>
          <span class="flex items-center space-x-1 justify-end font-bold text-sm sm:text-lg break-words whitespace-normal" style="color: ${COLORS.primary.rgb};">
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
    const uniqueRepos = new Set(allItems.map((item) => item.repo));
    const totalRepos = uniqueRepos.size;

    const repoCounts = allItems.reduce((acc, item) => {
      acc[item.repo] = (acc[item.repo] || 0) + 1;
      return acc;
    }, {});

    const sortedRepos = Object.entries(repoCounts).sort(([, a], [, b]) => b - a);
    const top3Repos = sortedRepos
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
        widths: ['5%', '20%', '30%', '15%', '15%', '15%'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number'],
      },
      issues: {
        title: 'Issues',
        icon: LANDING_PAGE_ICONS.issues,
        id: 'issues',
        headers: ['No.', 'Project', 'Title', 'Created', 'Closed', 'Closing Period'],
        widths: ['5%', '20%', '30%', '15%', '15%', '15%'],
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
          'Last Update / Status',
        ],
        widths: ['5%', '20%', '30%', '15%', '10%', '10%', '10%'],
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
          'Last Update / Status',
        ],
        widths: ['5%', '20%', '30%', '15%', '10%', '10%', '10%'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number', 'status'],
      },
      collaborations: {
        title: 'Collaborations',
        icon: LANDING_PAGE_ICONS.collaborations,
        id: 'collaborations',
        headers: ['No.', 'Project', 'Title', 'Created At', 'First Comment', 'Last Update / Status'],
        widths: ['5%', '20%', '30%', '15%', '15%', '15%'],
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
  <style>${dynamicCss}</style>
</head>
<body>
${navHtmlForReports}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header style="border-bottom-color: ${COLORS.primary[15]};" class="text-center mt-16 mb-12 pb-4 border-b-2">
          <h1 style="color: ${COLORS.primary.rgb};" class="text-4xl sm:text-5xl font-extrabold mb-2 pt-8">${quarter} ${year}</h1>
          <p class="text-lg text-gray-500 mt-2">Open Source Contributions Report</p>
        </header>

        <section class="mb-8">
          <h2 style="border-left-color: ${COLORS.primary.rgb};" class="text-3xl font-semibold text-gray-800 mb-12 border-l-4 pl-3">📊 Quarterly Statistics</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div style="background-color: ${COLORS.primary.rgb};" class="text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
              <p class="text-4xl font-extrabold">${totalContributions}</p>
              <p class="text-lg mt-2 font-medium">Total Contributions</p>
            </div>
            <div style="background-color: ${COLORS.primary.rgb};" class="text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
              <p class="text-4xl font-extrabold">${totalRepos}</p>
              <p class="text-lg mt-2 font-medium">Total Repositories</p>
            </div>
          </div>
        </section>

        <section class="mb-8">
          <h3 class="text-2xl font-semibold text-gray-800 mt-16 mb-4 border-l-4 border-green-500 pl-3">Contribution Breakdown</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            ${[
              {
                id: sections.pullRequests.id,
                count: data.pullRequests?.length || 0,
                label: 'Merged PRs',
                icon: sections.pullRequests.icon,
              },
              {
                id: sections.issues.id,
                count: data.issues?.length || 0,
                label: 'Issues',
                icon: sections.issues.icon,
              },
              {
                id: sections.reviewedPrs.id,
                count: data.reviewedPrs?.length || 0,
                label: 'Reviewed PRs',
                icon: sections.reviewedPrs.icon,
              },
              {
                id: sections.coAuthoredPrs.id,
                count: data.coAuthoredPrs?.length || 0,
                label: 'Co-Authored PRs',
                icon: sections.coAuthoredPrs.icon,
              },
              {
                id: sections.collaborations.id,
                count: data.collaborations?.length || 0,
                label: 'Collaborations',
                icon: sections.collaborations.icon,
              },
            ]
              .map(
                (item) => `
              <a href="#${item.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${COLORS.primary.rgb};">
                <span class="text-2xl font-bold" style="color: ${COLORS.primary.rgb};">${item.count}</span>
                <div class="flex items-center justify-center gap-1.5 text-gray-500 mt-1">
                  <span class="breakdown-icon-wrapper opacity-70">${item.icon}</span>
                  <span class="breakdown-label">${item.label}</span>
                </div>
              </a>`
              )
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
      let items = data[section];

      if (section === 'reviewedPrs' && items?.length > 0) {
        items = [...items].sort(
          (a, b) => new Date(b.myFirstReviewDate) - new Date(a.myFirstReviewDate)
        );
      } else if (section === 'coAuthoredPrs' && items?.length > 0) {
        items = [...items].sort(
          (a, b) => new Date(b.firstCommitDate) - new Date(a.firstCommitDate)
        );
      }

      htmlContent += `<details id="${sectionInfo.id}" class="border border-gray-200 rounded-xl p-4 shadow-sm">\n`;
      htmlContent += ` <summary style="color: ${COLORS.primary.rgb};" class="text-xl font-bold cursor-pointer outline-none">\n`;
      htmlContent += `  <div class="inline-flex items-center flex-nowrap gap-2 ml-3" style="vertical-align: middle;">\n`;
      htmlContent += `    <span class="w-6 h-6 flex items-center shrink-0">${sectionInfo.icon}</span>\n`;
      htmlContent += `    <span class="text-xl font-bold whitespace-nowrap">${sectionInfo.title} (${items ? items.length : 0})</span>\n`;
      htmlContent += `  </div>\n`;
      htmlContent += ` </summary>\n`;

      if (!items || items.length === 0) {
        htmlContent += `<div class="p-4 text-gray-500 bg-gray-50 rounded-lg">No contributions of this type in this quarter.</div>\n`;
      } else {
        const searchInputId = `${sectionInfo.id}-search`;
        htmlContent += dedent`
          <div class="flex flex-wrap gap-2 items-center mb-4 mt-2 px-1">
            <div class="icon-input-container grow">
              <div class="input-icon" style="color: ${COLORS.primary.rgb};">${SEARCH_SVG}</div>
              <input type="text" id="${searchInputId}" placeholder="Search (Project, Title, status:open...)" class="search-input w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 transition" style="border-color: ${COLORS.primary.rgb};" />
            </div>
            <button class="reset-btn bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition">Reset</button>
          </div>
        `;

        let tableContent = `<div class="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-100">\n`;
        tableContent += ` <table class="report-table min-w-full divide-y divide-gray-200 bg-white">\n`;
        tableContent += `  <thead style="background-color: ${COLORS.primary[5]};">\n   <tr>\n`;

        for (let i = 0; i < sectionInfo.headers.length; i++) {
          const type = sectionInfo.colTypes[i];
          const isStatic = i === 0;
          const thAttr = isStatic ? '' : `data-type="${type}" title="Click to sort"`;
          const content = isStatic
            ? sectionInfo.headers[i]
            : `<span class="th-content">${sectionInfo.headers[i]} <span class="sort-icon ml-1">↕</span></span>`;

          tableContent += `    <th ${thAttr} style="width:${sectionInfo.widths[i]}; color: ${COLORS.primary.rgb};">${content}</th>\n`;
        }
        tableContent += `   </tr>\n  </thead>\n`;
        tableContent += `  <tbody class="divide-y divide-gray-100">\n`;

        let counter = 1;
        for (const item of items) {
          const rowBg = counter % 2 === 1 ? 'bg-white' : 'bg-gray-50';
          const safeTitle = sanitizeAttribute(item.title);
          const [owner, name] = item.repo.includes('/') ? item.repo.split('/') : ['', item.repo];

          tableContent += `   <tr class="${rowBg} table-row-hover">\n`;
          tableContent += `    <td>${counter++}.</td>\n`;

          // Project Column: Two-liner with Badge style for name
          tableContent += `    <td data-value="${item.repo}" data-col-type="string">
            <div class="flex flex-col min-w-0">
              ${owner ? `<span class="text-[10px] uppercase tracking-wider text-gray-400 font-mono leading-none mb-1">${owner}</span>` : ''}
              <span class="font-mono text-xs bg-gray-100 p-1 rounded w-fit">${name}</span>
            </div>
          </td>\n`;

          tableContent += `    <td data-value="${safeTitle}" data-col-type="string">
            <a href='${item.url}' target='_blank' class="text-blue-600 hover:text-blue-800 hover:underline">${item.title}</a>
          </td>\n`;

          if (section === 'pullRequests') {
            const period = calculatePeriodInDays(item.createdAt, item.mergedAt);
            tableContent += `    <td data-value="${item.createdAt}" data-col-type="date">${formatDate(item.createdAt)}</td>\n`;
            tableContent += `    <td data-value="${item.mergedAt}" data-col-type="date">${formatDate(item.mergedAt)}</td>\n`;
            tableContent += `    <td data-value="${period.replace(/[^0-9]/g, '') || 0}" data-col-type="number">${period}</td>\n`;
          } else if (section === 'issues') {
            const period = calculatePeriodInDays(item.date, item.closedAt, 'open');
            const isOpened = period === '<strong>OPEN</strong>';
            tableContent += `    <td data-value="${item.date}" data-col-type="date">${formatDate(item.date)}</td>\n`;
            tableContent += `    <td data-value="${item.closedAt}" data-col-type="date">${formatDate(item.closedAt)}</td>\n`;
            tableContent += `    <td data-value="${isOpened ? 'N/A' : period.replace(/[^0-9]/g, '') || '0'}" data-col-type="number">${isOpened ? getStatusBadgeHtml('OPEN') : period}</td>\n`;
          } else if (section === 'reviewedPrs') {
            const period = calculatePeriodInDays(item.createdAt, item.myFirstReviewDate);
            const statusObj = formatPrStatusWithBadge(getPrStatusContent(item));
            tableContent += `    <td data-value="${item.createdAt}" data-col-type="date">${formatDate(item.createdAt)}</td>\n`;
            tableContent += `    <td data-value="${item.myFirstReviewDate}" data-col-type="date">${formatDate(item.myFirstReviewDate)}</td>\n`;
            tableContent += `    <td data-value="${period.replace(/[^0-9]/g, '') || 0}" data-col-type="number">${period}</td>\n`;
            tableContent += `    <td data-value="${statusObj.statusText}" data-col-type="status">${statusObj.html}</td>\n`;
          } else if (section === 'coAuthoredPrs') {
            const period = calculatePeriodInDays(item.createdAt, item.firstCommitDate);
            const statusObj = formatPrStatusWithBadge(getPrStatusContent(item));
            tableContent += `    <td data-value="${item.createdAt}" data-col-type="date">${formatDate(item.createdAt)}</td>\n`;
            tableContent += `    <td data-value="${item.firstCommitDate}" data-col-type="date">${formatDate(item.firstCommitDate)}</td>\n`;
            tableContent += `    <td data-value="${period.replace(/[^0-9]/g, '') || 0}" data-col-type="number">${period}</td>\n`;
            tableContent += `    <td data-value="${statusObj.statusText}" data-col-type="status">${statusObj.html}</td>\n`;
          } else if (section === 'collaborations') {
            const statusObj = formatPrStatusWithBadge(getCollaborationStatusContent(item));
            tableContent += `    <td data-value="${item.createdAt}" data-col-type="date">${formatDate(item.createdAt)}</td>\n`;
            tableContent += `    <td data-value="${item.firstCommentedAt}" data-col-type="date">${formatDate(item.firstCommentedAt)}</td>\n`;
            tableContent += `    <td data-value="${statusObj.statusText}" data-col-type="status">${statusObj.html}</td>\n`;
          }
          tableContent += `   </tr>\n`;
        }
        tableContent += `  </tbody>\n </table>\n</div>\n`;
        htmlContent += tableContent;
      }
      htmlContent += `</details>\n\n`;
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
        const hash = window.location.hash;
        if (hash) {
          const target = document.querySelector(hash);
          if (target && target.tagName === 'DETAILS') {
            document.querySelectorAll('details').forEach(d => d.open = false);
            target.open = true;
            setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
          }
        } else {
          const def = document.getElementById('merged-prs');
          if (def) def.open = true;
        }
      }
      window.addEventListener('DOMContentLoaded', openSectionFromHash);
      window.addEventListener('hashchange', openSectionFromHash);
    </script>
    ${footerHtml}
    </body>
</html>
`;
    htmlContent = htmlContent.replace(/\u00A0/g, ' ').replace(/[ \t]+$/gm, '');
    const formatted = await prettier.format(htmlContent, { parser: 'html' });
    await fs.writeFile(filePath, formatted, 'utf8');
    console.log(`Written file: ${filePath}`);
    quarterlyFileLinks.push({ path: relativePath, total: totalContributions });
  }
  return quarterlyFileLinks;
}

module.exports = { writeHtmlFiles };
