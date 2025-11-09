const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import the dedent utility
const { dedent } = require('./dedent');

// Import configuration
const { BASE_DIR } = require('./config');

// Import formatters
const {
  formatDate,
  calculatePeriodInDays,
  getPrStatusContent,
} = require('./contribution-formatters');

// Import navbar and footer
const { navHtml } = require('./navbar');
const { createFooterHtml } = require('./footer');

// Import left and right arrow svgs
const { LEFT_ARROW_SVG, RIGHT_ARROW_SVG } = require('./constants');

// 1. Update the link from root (./) to relative root (../index.html)
let navHtmlForReports = navHtml.replace(/href="\.\/"/g, 'href="../index.html"');
// 2. Update all instances of 'reports.html' to the relative path '../reports.html'
navHtmlForReports = navHtmlForReports.replace(/href="reports\.html"/g, 'href="../reports.html"');

/**
 * Generates and writes a separate HTML file for each quarter's contributions.
 * Files will be stored in a 'html-generated' subfolder within BASE_DIR.
 * @param {object} groupedContributions An object where keys are "YYYY-QX" and values are the contributions for that quarter.
 * @returns {Array<string>} List of relative file paths generated (e.g., ['2023/Q4-2023.html']).
 */
async function writeHtmlFiles(groupedContributions) {
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
    // Sort reports chronologically for correct Next/Previous order
    .sort((a, b) => a.key.localeCompare(b.key));

  /**
   * Generates the HTML for the Next/Previous navigation buttons.
   * @param {number} index - The index of the current report being processed in the allReports array.
   * @returns {string} The HTML for the navigation bar.
   */
  function generateReportNavButton(index) {
    const reports = allReports; // Reference the prepared array
    const previousReport = index > 0 ? reports[index - 1] : null;
    const nextReport = index < reports.length - 1 ? reports[index + 1] : null;

    let previousButton = '';
    let nextButton = '';

    const leftArrowSvg = LEFT_ARROW_SVG;
    const rightArrowSvg = RIGHT_ARROW_SVG;

    // Helper function to build the relative path: ../YEAR/QX-YYYY.html
    const getReportPath = (report) => {
      const fileName = `${report.quarterPrefix}-${report.year}.html`;
      // Path is relative from the report file: ../YEAR/QX-YYYY.html
      return `../${report.year}/${fileName}`;
    };

    // --- Consolidated Classes for Button Look ---
    // Fixed size, white background, light indigo border, smooth transition
    const baseClasses =
      'w-52 h-20 p-4 flex flex-col justify-center rounded-lg shadow-md transition duration-200 border border-indigo-400';
    // Hover effect targets ONLY the border to darken it
    const hoverClasses = 'hover:border-indigo-600';

    // --- Previous Button Logic (Two Lines) ---
    if (previousReport) {
      const prevPath = getReportPath(previousReport);
      previousButton = dedent`
          <a href="${prevPath}" class="${baseClasses} bg-white ${hoverClasses} text-left">
            <span class="text-xs font-medium text-gray-500">Previous</span>
            <span class="flex items-center space-x-1 text-indigo-700 font-bold text-lg text-wrap break-all">
              ${leftArrowSvg}
              <span>${previousReport.fullQuarterName}</span>
            </span>
          </a>
        `;
    } else {
      // Placeholder for alignment (Updated to w-52 h-20)
      previousButton = '<div class="w-52 h-20"></div>';
    }

    // --- Next Button Logic (Two Lines) ---
    if (nextReport) {
      const nextPath = getReportPath(nextReport);
      nextButton = dedent`
          <a href="${nextPath}" class="${baseClasses} bg-white ${hoverClasses} text-right">
            <span class="text-xs font-medium text-gray-500">Next</span>
            <span class="flex items-center space-x-1 justify-end text-indigo-700 font-bold text-lg text-wrap break-all">
              <span>${nextReport.fullQuarterName}</span>
              ${rightArrowSvg}
            </span>
          </a>
        `;
    } else {
      // Placeholder for alignment (Updated to w-52 h-20)
      nextButton = '<div class="w-52 h-20"></div>';
    }

    return dedent`
        <div class="mt-12 mb-8 mx-auto max-w-7xl flex justify-between items-center gap-4">
          ${previousButton}
          ${nextButton}
        </div>
      `;
  }

  // Define the base directory path: 'contributions/html-generated'
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const quarterlyFileLinks = [];

  // Create a new base directory if it doesn't exist.
  await fs.mkdir(htmlBaseDir, { recursive: true });

  // Iterate over the prepared allReports array using the index
  for (let index = 0; index < allReports.length; index++) {
    const report = allReports[index]; // Destructure the properties needed for file naming and statistics
    const { key, year, quarterPrefix: quarter, data, totalContributions, fullQuarterName } = report;

    // Generate the dynamic footer
    const footerHtml = createFooterHtml();

    // Create the year-specific subdirectory inside the new htmlBaseDir (e.g., 'contributions/html-generated/2023')
    const yearDir = path.join(htmlBaseDir, year);
    await fs.mkdir(yearDir, { recursive: true });

    const filename = `${quarter}-${year}.html`;
    // This path is relative to the 'html-generated' directory, needed for the main index file links
    const relativePath = path.join(year, filename);

    // Set the file path and extension (absolute path for writing)
    const filePath = path.join(yearDir, filename);

    // Skip writing the file if there are no contributions for this quarter.
    if (totalContributions === 0) {
      console.log(`Skipping empty quarter: ${key}`);
      continue;
    }

    // --- Calculate additional statistics ---
    const allItems = [
      ...data.pullRequests,
      ...data.issues,
      ...data.reviewedPrs,
      ...data.coAuthoredPrs,
      ...data.collaborations,
    ];
    const uniqueRepos = new Set(allItems.map((item) => item.repo));
    const totalRepos = uniqueRepos.size;

    // Count contributions per repository
    const repoCounts = allItems.reduce((acc, item) => {
      acc[item.repo] = (acc[item.repo] || 0) + 1;
      return acc;
    }, {});

    // Determine and limit to the top 3 most active repositories
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
    const collaborationCount = data.collaborations?.length || '0';

    // --- Start building the HTML content with the new Tailwind boilerplate and styles ---
    let htmlContent = dedent`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <title>${quarter} ${year} Contributions Report</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M5.75 21a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 19.25a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM5.75 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM18.25 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM15 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0z'/%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M5.75 16.75A.75.75 0 006.5 16V8A.75.75 0 005 8v8c0 .414.336.75.75.75z'/%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M17.5 8.75v-1H19v1a3.75 3.75 0 01-3.75 3.75h-7a1.75 1.75 0 00-1.75 1.75H5A3.25 3.25 0 018.25 11h7a2.25 2.25 0 002.25-2.25z'/%3E%3C/svg%3E">
    <!-- Load Tailwind CSS -->
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
				@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7f9fb;
        }
        summary {
            cursor: pointer;
            outline: none;
            margin: 0.5em 0;
            padding: 0.5em 0;
            color: #1f2937;
        }
        .report-table th, .report-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .report-table th {
            background-color: #EEF2FF;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            color: #4338CA;
        }
        .report-table tbody tr:last-child td {
            border-bottom: none;
        }
    </style>
</head>
<body>
${navHtmlForReports}
		<div class="mx-auto max-w-7xl bg-white p-6 sm:p-10 rounded-xl shadow-2xl mt-16">
    		<header class="text-center mb-12 pb-4 border-b-2 border-indigo-100">
        		<h1 class="text-4xl sm:text-5xl font-extrabold text-indigo-700 mb-2 pt-8">${quarter} ${year}</h1>
        		<p class="text-lg text-gray-500 mt-2">Open Source Contributions Report</p>
    		</header>

		<!-- 1. PRIMARY STATS SECTION (Total Contribs & Repos) -->
    		<section class="mb-8">
        		<h2 class="text-3xl font-semibold text-gray-800 mb-12 border-l-4 border-indigo-500 pl-3">📊 Quarterly Statistics</h2>

        		<!-- Total Contributions & Total Repositories (Two Big Cards) -->
        		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
           		 <div class="bg-indigo-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
              		  <p class="text-4xl font-extrabold">${totalContributions}</p>
              		  <p class="text-lg mt-2 font-medium">Total Contributions</p>
            		</div>
            		<div class="bg-indigo-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
              		  <p class="text-4xl font-extrabold">${totalRepos}</p>
               		 <p class="text-lg mt-2 font-medium">Total Repositories</p>
            		</div>
        		</div>
    		</section>

    		<!-- 2. CONTRIBUTION BREAKDOWN SECTION -->
    		<section class="mb-8">
       		 <h3 class="text-2xl font-semibold text-gray-800 mt-16 mb-4 border-l-4 border-green-500 pl-3">Contribution Breakdown</h3>
       		 <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
        		    <!-- Merged PRs -->
         		   <div class="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center">
         		       <span class="text-2xl font-bold text-indigo-700">${prCount}</span>
          		      <span class="text-md text-gray-500 mt-1">Merged PRs</span>
          		  </div>
          		  <!-- Reviewed PRs -->
         		   <div class="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center">
           		     <span class="text-2xl font-bold text-indigo-700">${reviewedPrCount}</span>
            		    <span class="text-md text-gray-500 mt-1">Reviewed PRs</span>
           		 </div>
           		 <!-- Issues -->
           		 <div class="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center">
           		     	<span class="text-2xl font-bold text-indigo-700">${issueCount}</span>
            		    <span class="text-md text-gray-500 mt-1">Issues</span>
           		 </div>
          		  <!-- Co-Authored PRs -->
          		  <div class="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center">
             		   	<span class="text-2xl font-bold text-indigo-700">${coAuthoredPrCount}</span>
              		  <span class="text-md text-gray-500 mt-1">Co-Authored PRs</span>
            		</div>
            		<!-- Collaborations -->
            		<div class="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center">
             		   <span class="text-2xl font-bold text-indigo-700">${collaborationCount}</span>
              		  <span class="text-md text-gray-500 mt-1">Collaborations</span>
          		  </div>
        		</div>
    		</section>

    		<!-- 3. TOP 3 REPOSITORIES SECTION -->
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

    // Configuration for each table section
    const sections = {
      pullRequests: {
        title: 'Merged PRs',
        icon: '🚀',
        headers: ['No.', 'Project', 'Title', 'Created', 'Merged', 'Review Period'],
        widths: ['5%', '20%', '30%', '15%', '15%', '15%'],
        keys: ['repo', 'title', 'date', 'mergedAt', 'reviewPeriod'],
      },
      issues: {
        title: 'Issues',
        icon: '🐞',
        headers: ['No.', 'Project', 'Title', 'Created', 'Closed', 'Closing Period'],
        widths: ['5%', '25%', '35%', '15%', '15%', '10%'],
        keys: ['repo', 'title', 'date', 'closedAt', 'closingPeriod'],
      },
      reviewedPrs: {
        title: 'Reviewed PRs',
        icon: '👀',
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
        keys: ['repo', 'title', 'createdAt', 'myFirstReviewDate', 'myFirstReviewPeriod', 'date'],
      },
      coAuthoredPrs: {
        title: 'Co-Authored PRs',
        icon: '🤝',
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
        keys: ['repo', 'title', 'createdAt', 'firstCommitDate', 'firstCommitPeriod', 'date'],
      },
      collaborations: {
        title: 'Collaborations',
        icon: '💬',
        headers: ['No.', 'Project', 'Title', 'Created At', 'Commented At'],
        widths: ['5%', '30%', '35%', '15%', '15%'],
        keys: ['repo', 'title', 'createdAt', 'date'],
      },
    };

    // Loop through each contribution type to create a collapsible section.
    for (const [section, sectionInfo] of Object.entries(sections)) {
      const items = data[section];
      // Only keep 'pullRequests' open by default to match the template
      const openAttribute = section === 'pullRequests' ? 'open' : '';

      // Use the HTML <details> tag with Tailwind styles for a collapsible section
      htmlContent += `<details ${openAttribute} class="border border-gray-200 rounded-xl p-4 shadow-sm">\n`;
      htmlContent += ` <summary class="text-xl font-bold text-indigo-600">\n`;
      htmlContent += `  <span class="inline-block">${sectionInfo.icon} ${
        sectionInfo.title
      } (${items ? items.length : 0})</span>\n`;
      htmlContent += ` </summary>\n`;

      if (!items || items.length === 0) {
        htmlContent += `<div class="p-4 text-gray-500 bg-gray-50 rounded-lg">No contributions of this type in this quarter.</div>\n`;
      } else {
        let tableContent = `<div class="overflow-x-auto rounded-lg border border-gray-100">\n`;
        // Use the custom report-table class for styling
        tableContent += ` <table class="report-table min-w-full divide-y divide-gray-200 bg-white">\n`;
        tableContent += `  <thead>\n`;
        tableContent += `    <tr>\n`;

        // Generate table headers with specified width styles
        for (let i = 0; i < sectionInfo.headers.length; i++) {
          tableContent += `      <th style='width:${sectionInfo.widths[i]};'>${sectionInfo.headers[i]}</th>\n`;
        }
        tableContent += `    </tr>\n`;
        tableContent += `  </thead>\n`;
        tableContent += `  <tbody class="divide-y divide-gray-100">\n`;

        let counter = 1;
        // Iterate over each contribution item to build table rows
        for (const item of items) {
          const rowBg = counter % 2 === 1 ? 'bg-white' : 'bg-gray-50';
          tableContent += `    <tr class="${rowBg} hover:bg-indigo-50 transition duration-150">\n`;
          tableContent += `      <td>${counter++}.</td>\n`;
          tableContent += `      <td><span class="font-mono text-xs bg-gray-100 p-1 rounded">${item.repo}</span></td>\n`;
          // Title: styled as a link
          tableContent += `      <td><a href='${item.url}' target='_blank' class="text-blue-600 hover:text-blue-800 hover:underline">${item.title}</a></td>\n`;

          // Logic for Merged PRs table structure
          if (section === 'pullRequests') {
            const createdAt = formatDate(item.createdAt);
            const mergedAt = formatDate(item.mergedAt);
            const reviewPeriod = calculatePeriodInDays(item.createdAt, item.mergedAt);

            tableContent += `      <td>${createdAt}</td>\n`;
            tableContent += `      <td>${mergedAt}</td>\n`;
            tableContent += `      <td>${reviewPeriod}</td>\n`;
            // Logic for Issues table structure
          } else if (section === 'issues') {
            const createdAt = formatDate(item.date);
            const closedAt = formatDate(item.closedAt);
            const closingPeriod = calculatePeriodInDays(item.date, item.closedAt, item.state);

            tableContent += `      <td>${createdAt}</td>\n`;
            tableContent += `      <td>${closedAt}</td>\n`;
            tableContent += `      <td>${closingPeriod}</td>\n`;
            // Logic for Reviewed PRs table structure
          } else if (section === 'reviewedPrs') {
            const createdAt = formatDate(item.createdAt);
            const myFirstReviewAt = formatDate(item.myFirstReviewDate);
            const myFirstReviewPeriod = calculatePeriodInDays(
              item.createdAt,
              item.myFirstReviewDate
            );
            const lastUpdateContent = getPrStatusContent(item);

            tableContent += `      <td>${createdAt}</td>\n`;
            tableContent += `      <td>${myFirstReviewAt}</td>\n`;
            tableContent += `      <td>${myFirstReviewPeriod}</td>\n`;
            tableContent += `      <td>${lastUpdateContent}</td>\n`;
            // Logic for Co-Authored PRs table structure
          } else if (section === 'coAuthoredPrs') {
            const createdAt = formatDate(item.createdAt);
            const firstCommitAt = formatDate(item.firstCommitDate);
            const firstCommitPeriod = calculatePeriodInDays(item.createdAt, item.firstCommitDate);
            const lastUpdateContent = getPrStatusContent(item);

            tableContent += `      <td>${createdAt}</td>\n`;
            tableContent += `      <td>${firstCommitAt}</td>\n`;
            tableContent += `      <td>${firstCommitPeriod}</td>\n`;
            tableContent += `      <td>${lastUpdateContent}</td>\n`;
            // Logic for Collaborations table structure
          } else if (section === 'collaborations') {
            const createdAt = formatDate(item.createdAt);
            const commentedAt = formatDate(item.firstCommentedAt);

            tableContent += `      <td>${createdAt}</td>\n`;
            tableContent += `      <td>${commentedAt}</td>\n`;
          }

          tableContent += `    </tr>\n`;
        }

        tableContent += `  </tbody>\n`;
        tableContent += ` </table>\n`;
        tableContent += `</div>\n`;

        htmlContent += tableContent;
      }

      htmlContent += `</details>\n\n`;
    }

    const navButton = generateReportNavButton(index);

    // Close the last main <section> tag
    htmlContent += dedent`
            </section>
`;
    htmlContent += navButton;
    htmlContent += footerHtml;

    htmlContent += `
        </div>
    </body>
</html>
`;

    // Format the content before writing
    const formattedContent = await prettier.format(htmlContent, {
      parser: 'html', // Ensure Prettier formats it as HTML
    });

    // Write the final HTML content to the file.
    await fs.writeFile(filePath, formattedContent, 'utf8');
    console.log(`Written file: ${filePath}`);

    // Add the relative path and total contributions to the list to be returned
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
