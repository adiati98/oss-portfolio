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
const { navHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const {
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  FAVICON_SVG_ENCODED,
  COLORS,
} = require('../../config/constants');

// Update navigation links for report pages
let navHtmlForReports = navHtml.replace(/href="\.\/"/g, 'href="../index.html"');
navHtmlForReports = navHtmlForReports.replace(/href="reports\.html"/g, 'href="../reports.html"');

/**
 * Sanitizes a string for safe use in HTML attributes (prevents " breaking HTML).
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
  // Read the Interaction Script
  const interactionsScriptPath = path.join(__dirname, '../../utils/table-filters.js');
  let tableInteractionsScript = '';
  try {
    tableInteractionsScript = await fs.readFile(interactionsScriptPath, 'utf8');
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
      default:
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

    const statusBadge = getStatusBadgeHtml(statusWord); // Return both the HTML and the raw status text for sorting
    return {
      html: `${date}<br>${statusBadge}`,
      statusText: statusWord,
    };
  }

  function generateReportNavButton(index) {
    // ... (Existing code for buttons, unmodified) ...
    const reports = allReports;
    const previousReport = index > 0 ? reports[index - 1] : null;
    const nextReport = index < reports.length - 1 ? reports[index + 1] : null;

    let previousButton = '';
    let nextButton = ''; // Helper function to build the relative path: ../YEAR/QX-YYYY.html

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

  for (let index = 0; index < allReports.length; index++) {
    const report = allReports[index];
    const { key, year, quarterPrefix: quarter, data, totalContributions } = report;
    const footerHtml = createFooterHtml().trim();
    const yearDir = path.join(htmlBaseDir, year);
    await fs.mkdir(yearDir, { recursive: true });

    const filename = `${quarter}-${year}.html`;
    const relativePath = path.join(year, filename);
    const filePath = path.join(yearDir, filename);

    if (totalContributions === 0) {
      console.log(`Skipping empty quarter: ${key}`);
      continue;
    } // ... (Existing repo statistics calculation) ...

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

    const prCount = data.pullRequests?.length || '0';
    const reviewedPrCount = data.reviewedPrs?.length || '0';
    const issueCount = data.issues?.length || '0';
    const coAuthoredPrCount = data.coAuthoredPrs?.length || '0';
    const collaborationCount = data.collaborations?.length || '0'; // UPDATED SECTIONS CONFIG: Added 'types' for better sorting

    const sections = {
      pullRequests: {
        title: 'Merged PRs',
        icon: '🚀',
        id: 'merged-prs',
        headers: ['No.', 'Project', 'Title', 'Created', 'Merged', 'Review Period'],
        widths: ['5%', '20%', '30%', '15%', '15%', '15%'], // 'string', 'number', 'date', 'status'
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number'],
        keys: ['repo', 'title', 'date', 'mergedAt', 'reviewPeriod'],
      },
      issues: {
        title: 'Issues',
        icon: '🐞',
        id: 'issues',
        headers: ['No.', 'Project', 'Title', 'Created', 'Closed', 'Closing Period'],
        widths: ['5%', '25%', '35%', '15%', '15%', '10%'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number'],
        keys: ['repo', 'title', 'date', 'closedAt', 'closingPeriod'],
      },
      reviewedPrs: {
        title: 'Reviewed PRs',
        icon: '👀',
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
        widths: ['5%', '20%', '28%', '10%', '15%', '10%', '12%'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number', 'status'],
        keys: ['repo', 'title', 'createdAt', 'myFirstReviewDate', 'myFirstReviewPeriod', 'date'],
      },
      coAuthoredPrs: {
        title: 'Co-Authored PRs',
        icon: '🤝',
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
        widths: ['5%', '15%', '25%', '10%', '12%', '13%', '20%'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'number', 'status'],
        keys: ['repo', 'title', 'createdAt', 'firstCommitDate', 'firstCommitPeriod', 'date'],
      },
      collaborations: {
        title: 'Collaborations',
        icon: '💬',
        id: 'collaborations',
        headers: ['No.', 'Project', 'Title', 'Created At', 'First Comment', 'Last Update / Status'],
        widths: ['5%', '25%', '30%', '12%', '12%', '16%'],
        colTypes: ['number', 'string', 'string', 'date', 'date', 'status'],
        keys: ['repo', 'title', 'createdAt', 'date', 'date'],
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
    html, body { margin: 0; padding: 0; height: 100%; }
    body { font-family: 'Inter', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
    summary { cursor: pointer; outline: none; margin: 0.5em 0; padding: 0.5em 0; color: #1f2937; }
    summary:focus-visible { outline: 2px solid ${COLORS.primary.rgb}; outline-offset: 2px; }
    .report-table th, .report-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .details-section { background-color: ${COLORS.primary[5]}; }
    .details-section details:open summary { color: ${COLORS.primary.rgb}; }
    .report-table tbody tr:last-child td { border-bottom: none; }
    .nav-report-button { border: 1px solid ${COLORS.border.light} !important; transition: border-color 0.15s ease-in-out !important; }
    .nav-report-button:hover { border-color: ${COLORS.primary.rgb} !important; }
    .nav-report-button:focus-visible { border-color: ${COLORS.primary.rgb}; outline: 2px solid ${COLORS.primary.rgb}; outline-offset: 2px; }
    .nav-contribution-button { border: 1px solid ${COLORS.border.light} !important; transition: border-color 0.15s ease-in-out !important; }
    .nav-contribution-button:hover { border-color: ${COLORS.primary.rgb} !important; }
    .nav-contribution-button:focus-visible { border-color: ${COLORS.primary.rgb}; outline: 2px solid ${COLORS.primary.rgb}; outline-offset: 2px; }
    .table-row-hover { background-color: inherit; }
    .table-row-hover:hover, .table-row-hover:focus-visible { background-color: ${COLORS.primary[10]} !important; }
    .table-row-hover:focus-visible { outline: 2px solid ${COLORS.primary.rgb}; outline-offset: -2px; }
    /* Sorting Icons */
    th .sort-icon { margin-left: 5px; font-size: 0.8em; opacity: 0.5; }
    th.sort-asc .sort-icon, th.sort-desc .sort-icon { opacity: 1; font-weight: bold; }
  </style>
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
             <a href="#${sections.pullRequests.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${COLORS.primary.rgb};">
               <span class="text-2xl font-bold" style="color: ${COLORS.primary.rgb};">${prCount}</span>
               <span class="text-xs sm:text-md text-gray-500 mt-1">Merged PRs</span>
             </a>
             <a href="#${sections.issues.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${COLORS.primary.rgb};">
               <span class="text-2xl font-bold" style="color: ${COLORS.primary.rgb};">${issueCount}</span>
               <span class="text-xs sm:text-md text-gray-500 mt-1">Issues</span>
             </a>
             <a href="#${sections.reviewedPrs.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${COLORS.primary.rgb};">
               <span class="text-2xl font-bold" style="color: ${COLORS.primary.rgb};">${reviewedPrCount}</span>
               <span class="text-xs sm:text-md text-gray-500 mt-1">Reviewed PRs</span>
             </a>
             <a href="#${sections.coAuthoredPrs.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${COLORS.primary.rgb};">
               <span class="text-2xl font-bold" style="color: ${COLORS.primary.rgb};">${coAuthoredPrCount}</span>
               <span class="text-xs sm:text-md text-gray-500 mt-1">Co-Authored PRs</span>
             </a>
             <a href="#${sections.collaborations.id}" class="nav-contribution-button flex flex-col items-center p-3 bg-white border rounded-xl shadow-sm hover:shadow-lg transition text-center" style="color: ${COLORS.primary.rgb};">
               <span class="text-2xl font-bold" style="color: ${COLORS.primary.rgb};">${collaborationCount}</span>
               <span class="text-xs sm:text-md text-gray-500 mt-1">Collaborations</span>
             </a>
           </div>
        </section>

        <section class="mb-8">
           <h3 class="text-2xl font-semibold text-gray-800 mb-4 border-l-4 border-yellow-500 pl-3">Top 3 Repositories</h3>
           <div class="p-4 bg-gray-50 rounded-lg shadow-sm">
             <ol class="list-decimal list-inside pl-4 text-gray-600 space-y-1">
               ${top3Repos}
             </ol>
           </div>
        </section>

        <hr class="my-8 border-gray-200">
     
        <section class="space-y-6">
    `;

    for (const [section, sectionInfo] of Object.entries(sections)) {
      let items = data[section]; // Keep existing initial sort

      if (section === 'reviewedPrs' && items && items.length > 0) {
        items = [...items].sort(
          (a, b) => new Date(b.myFirstReviewDate) - new Date(a.myFirstReviewDate)
        );
      } else if (section === 'coAuthoredPrs' && items && items.length > 0) {
        items = [...items].sort(
          (a, b) => new Date(b.firstCommitDate) - new Date(a.firstCommitDate)
        );
      }

      htmlContent += `<details id="${sectionInfo.id}" class="border border-gray-200 rounded-xl p-4 shadow-sm">\n`;
      htmlContent += ` <summary style="color: ${COLORS.primary.rgb};" class="text-xl font-bold">\n`;
      htmlContent += `  <span class="inline-block">${sectionInfo.icon} ${sectionInfo.title} (${items ? items.length : 0})</span>\n`;
      htmlContent += ` </summary>\n`;

      if (!items || items.length === 0) {
        htmlContent += `<div class="p-4 text-gray-500 bg-gray-50 rounded-lg">No contributions of this type in this quarter.</div>\n`;
      } else {
        // --- SEARCH BAR AREA ---
        htmlContent += dedent`
          <div class="flex flex-wrap gap-2 items-center 
          mb-4 mt-2 px-1">
            <input 
              type="text" 
              placeholder="Search (Project, Title, 
              'status:open'...)" 
              class="search-input grow border 
              border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button 
              class="reset-btn bg-gray-100 
              hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition"
            >
              Reset
            </button>
          </div>
        `;

        let tableContent = `<div class="overflow-x-auto rounded-lg border border-gray-100">\n`;
        tableContent += ` <table class="report-table min-w-full divide-y divide-gray-200 bg-white">\n`;
        tableContent += `  <thead style="background-color: ${COLORS.primary[5]};">\n`;
        tableContent += `   <tr>\n`; // Headers with data-type

        for (let i = 0; i < sectionInfo.headers.length; i++) {
          const type = sectionInfo.colTypes[i]; // --- MODIFICATION START (Header) ---
          const isStaticColumn = i === 0; // Check if it's the first column ("No.")
          // If static, omit data-type, sort-icon, and set cursor to default
          const thAttributes = isStaticColumn ? '' : `data-type="${type}" title="Click to sort"`;
          const sortIconHtml = isStaticColumn ? '' : ' <span class="sort-icon">↕</span>';
          const cursorStyle = isStaticColumn ? 'cursor: default;' : 'cursor: pointer;'; // --- MODIFICATION END (Header) ---
          tableContent += `    <th ${thAttributes} style='width:${sectionInfo.widths[i]}; color: ${COLORS.primary.rgb}; ${cursorStyle}'>
             ${sectionInfo.headers[i]}${sortIconHtml}
          </th>\n`;
        }
        tableContent += `   </tr>\n`;
        tableContent += `  </thead>\n`;
        tableContent += `  <tbody class="divide-y divide-gray-100">\n`;

        let counter = 1;
        for (const item of items) {
          const rowBg = counter % 2 === 1 ? 'bg-white' : 'bg-gray-50';
          const safeTitle = sanitizeAttribute(item.title);

          tableContent += `   <tr class="${rowBg} table-row-hover" style="transition: background-color 0.15s ease-in-out; cursor: pointer;" data-href="${item.url}">\n`; // 1. Counter (Static Text)
          // --- MODIFICATION START (Row Data) ---
          // Remove data-value and data-col-type to prevent it from being sorted.

          tableContent += `     <td>${counter++}.</td>\n`; // --- MODIFICATION END (Row Data) ---
          // 2. Repo (String)
          const repoSpanHtml = `<span class="font-mono text-xs bg-gray-100 p-1 rounded">${item.repo}</span>`;
          tableContent += `     <td data-value="${item.repo}" data-col-type="string">${repoSpanHtml}</td>\n`; // 3. Title (String) - sanitized data-value

          const linkHtml = `<a href='${item.url}' target='_blank' class="text-blue-600 hover:text-blue-800 hover:underline">${item.title}</a>`;
          tableContent += `     <td data-value="${safeTitle}" data-col-type="string">${linkHtml}</td>\n`;

          if (section === 'pullRequests') {
            const createdAt = formatDate(item.createdAt);
            const mergedAt = formatDate(item.mergedAt);
            const reviewPeriod = calculatePeriodInDays(item.createdAt, item.mergedAt);
            const daysNum = reviewPeriod.replace(/[^0-9]/g, '') || 0; // extract number for sorting

            tableContent += `     <td data-value="${item.createdAt}" data-col-type="date">${createdAt}</td>\n`;
            tableContent += `     <td data-value="${item.mergedAt}" data-col-type="date">${mergedAt}</td>\n`;
            tableContent += `     <td data-value="${daysNum}" data-col-type="number">${reviewPeriod}</td>\n`;
          } else if (section === 'issues') {
            const createdAt = formatDate(item.date);
            const closedAt = formatDate(item.closedAt);
            const closingPeriod = calculatePeriodInDays(item.date, item.closedAt, 'open');

            let closingPeriodHtml = closingPeriod; // NEW SORTING LOGIC: Differentiate between number of days and 'OPEN' status
            let sortValue = closingPeriod.replace(/[^0-9]/g, ''); // Extract number (e.g., "15" from "15 days")

            if (closingPeriod === '<strong>OPEN</strong>') {
              closingPeriodHtml = getStatusBadgeHtml('OPEN'); // Critical Change: Use "N/A" (non-numeric string) as the data-value for open issues.
              // The table-filters.js logic will map this string to +/- Infinity.
              sortValue = 'N/A';
            } else {
              // If it is a period (e.g., "15 days"), use the raw number or '0' if it's "0 days"
              sortValue = sortValue || '0';
            } // The column type must be consistently 'number' (as set in sectionInfo.colTypes)

            tableContent += `     <td data-value="${item.date}" data-col-type="date">${createdAt}</td>\n`;
            tableContent += `     <td data-value="${item.closedAt}" data-col-type="date">${closedAt}</td>\n`;
            tableContent += `     <td data-value="${sortValue}" data-col-type="number">${closingPeriodHtml}</td>\n`;
          } else if (section === 'reviewedPrs') {
            const createdAt = formatDate(item.createdAt);
            const myFirstReviewAt = formatDate(item.myFirstReviewDate);
            const myFirstReviewPeriod = calculatePeriodInDays(
              item.createdAt,
              item.myFirstReviewDate
            );
            const daysNum = myFirstReviewPeriod.replace(/[^0-9]/g, '') || 0;

            const statusObj = formatPrStatusWithBadge(getPrStatusContent(item));

            tableContent += `     <td data-value="${item.createdAt}" data-col-type="date">${createdAt}</td>\n`;
            tableContent += `     <td data-value="${item.myFirstReviewDate}" data-col-type="date">${myFirstReviewAt}</td>\n`;
            tableContent += `     <td data-value="${daysNum}" data-col-type="number">${myFirstReviewPeriod}</td>\n`;
            tableContent += `     <td data-value="${statusObj.statusText}" data-col-type="status">${statusObj.html}</td>\n`;
          } else if (section === 'coAuthoredPrs') {
            const createdAt = formatDate(item.createdAt);
            const firstCommitAt = formatDate(item.firstCommitDate);
            const firstCommitPeriod = calculatePeriodInDays(item.createdAt, item.firstCommitDate);
            const daysNum = firstCommitPeriod.replace(/[^0-9]/g, '') || 0;

            const statusObj = formatPrStatusWithBadge(getPrStatusContent(item));

            tableContent += `     <td data-value="${item.createdAt}" data-col-type="date">${createdAt}</td>\n`;
            tableContent += `     <td data-value="${item.firstCommitDate}" data-col-type="date">${firstCommitAt}</td>\n`;
            tableContent += `     <td data-value="${daysNum}" data-col-type="number">${firstCommitPeriod}</td>\n`;
            tableContent += `     <td data-value="${statusObj.statusText}" data-col-type="status">${statusObj.html}</td>\n`;
          } else if (section === 'collaborations') {
            const createdAt = formatDate(item.createdAt);
            const commentedAt = formatDate(item.firstCommentedAt);
            const statusObj = formatPrStatusWithBadge(getCollaborationStatusContent(item));

            tableContent += `     <td data-value="${item.createdAt}" data-col-type="date">${createdAt}</td>\n`;
            tableContent += `     <td data-value="${item.firstCommentedAt}" data-col-type="date">${commentedAt}</td>\n`;
            tableContent += `     <td data-value="${statusObj.statusText}" data-col-type="status">${statusObj.html}</td>\n`;
          }

          tableContent += `   </tr>\n`;
        }

        tableContent += `  </tbody>\n`;
        tableContent += ` </table>\n`;
        tableContent += `</div>\n`;

        htmlContent += tableContent;
      }

      htmlContent += `</details>\n\n`;
    }

    const navButton = generateReportNavButton(index);

    htmlContent += dedent`
          </section>
          ${navButton}
        </div>
      </div>
    </main>
    <script>
      ${tableInteractionsScript}
      
      // Existing scripts for hash handling and row clicks...
      function openSectionFromHash() {
        const hash = window.location.hash;
        if (hash) {
          const targetDetails = document.querySelector(hash);
          if (targetDetails && targetDetails.tagName === 'DETAILS') {
            document.querySelectorAll('details').forEach(detail => detail.open = false);
            targetDetails.open = true;
            setTimeout(() => {
              targetDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        } else {
          const defaultDetails = document.getElementById('merged-prs');
          if (defaultDetails) defaultDetails.open = true;
        }
      }
      window.addEventListener('DOMContentLoaded', openSectionFromHash);
      window.addEventListener('hashchange', openSectionFromHash);

      document.addEventListener('DOMContentLoaded', () => {
        const tableRows = document.querySelectorAll('.table-row-hover');
        tableRows.forEach(row => {
          const href = row.getAttribute('data-href');
          if (href) {
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.addEventListener('click', (e) => {
              // Prevent navigation if text is selected
              if(window.getSelection().toString().length > 0) return;
              window.location.href = href;
            });
            row.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.href = href;
              }
            });
          }
        });
      });
    </script>
${footerHtml}
    </body>
</html>
`;
    htmlContent = htmlContent.replace(/\u00A0/g, ' ').replace(/[ \t]+$/gm, '');

    const formattedContent = await prettier.format(htmlContent, {
      parser: 'html',
    });

    await fs.writeFile(filePath, formattedContent, 'utf8');
    console.log(`Written file: ${filePath}`);

    quarterlyFileLinks.push({
      path: relativePath,
      total: totalContributions,
    });
  }

  return quarterlyFileLinks;
}

module.exports = {
  writeHtmlFiles,
};
