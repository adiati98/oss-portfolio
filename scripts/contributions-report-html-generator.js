const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import configuration (SINCE_YEAR is needed for reporting)
const { BASE_DIR, SINCE_YEAR, GITHUB_USERNAME } = require('./config');

// Import navbar and footer
const { navHtml } = require('./navbar');
const { createFooterHtml } = require('./footer');

const HTML_OUTPUT_DIR_NAME = 'html-generated';
const HTML_REPORTS_FILENAME = 'reports.html';

/**
 * Calculates aggregate totals from all contribution data and writes the
 * all-time contributions HTML report file.
 * @param {object} finalContributions The object with all contributions, grouped by type.
 * @param {Array<string>} quarterlyFileLinks List of relative paths (e.g., ['2023/Q4-2023.html', ...])
 * to the generated quarterly files, provided by the quarterly generator.
 */
async function createHtmlReports(quarterlyFileLinks = []) {
  const htmlBaseDir = path.join(BASE_DIR, HTML_OUTPUT_DIR_NAME);
  const HTML_OUTPUT_PATH = path.join(htmlBaseDir, HTML_REPORTS_FILENAME);

  // Ensure the output directory exists
  await fs.mkdir(htmlBaseDir, { recursive: true });

  // Generate the footer HTML
  const footerHtml = createFooterHtml();

  // Define the report structure data
  const reportStructure = [
    {
      section: 'Quarterly Statistics',
      description:
        'A high-level summary showing the **Total Contributions** and **Total Repositories** involved in during the quarter.',
      metric: 'Total Count, Unique Repositories',
    },
    {
      section: 'Contribution Breakdown',
      description:
        'A table listing the count of contributions for each of the five core categories within that quarter.',
      metric: 'Category Counts',
    },
    {
      section: 'Top 3 Repositories',
      description:
        'The top three projects where contributions were made in that quarter, ranked by total count.',
      metric: 'Contribution Frequency',
    },
    {
      section: 'Merged PRs',
      description:
        'Detailed list of Pull Requests **authored by me** and merged into external repositories.',
      metric: '**Review Period** (Time from creation to merge)',
    },
    {
      section: 'Issues',
      description: 'Detailed list of Issues **authored by me** on external repositories.',
      metric: '**Closing Period** (Time from creation to close)',
    },
    {
      section: 'Reviewed PRs',
      description:
        'Detailed list of Pull Requests **reviewed or merged by me** on external repositories.',
      metric: '**My First Review Period** (Time from PR creation to my first review)',
    },
    {
      section: 'Co-Authored PRs',
      description:
        "Pull Requests where **I contributed commits (including co-authored commits)** to other contributor's PRs.",
      metric: '**My First Commit Period** (Time from PR creation to my first commit)',
    },
    {
      section: 'Collaborations',
      description:
        'Detailed list of open Issues or PRs where I have **commented** to participate in discussion.',
      metric: '**First Commented At** (The date of my initial comment)',
    },
  ];

  // Helper function to render table rows
  const renderStructureTableRows = () => {
    return reportStructure
      .map((item, index) => {
        // Convert Markdown formatting to HTML
        const safeDescription = item.description
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/`/g, '<code>');
        const safeMetric = item.metric.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        return `
            <tr class="${rowBg} border-b hover:bg-indigo-50 transition duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-700">
                ${item.section}
              </td>
              <td class="px-6 py-4 text-sm text-gray-700">
                ${safeDescription}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${safeMetric}
              </td>
            </tr>
          `;
      })
      .join('');
  };

  // 4. Generate Quarterly Links HTML
  const sortedLinks = quarterlyFileLinks
    // Filter out any undefined/null entries or objects missing the 'path' for safety
    .filter((link) => link && typeof link.path === 'string')
    .sort((a, b) => {
      // Sort by path string in reverse order (b before a) to show newer quarters first
      if (a.path < b.path) return 1;
      if (a.path > b.path) return -1;
      return 0;
    });
  let linkHtml = '';

  // Helper object to group links by year: { '2024': [...links], '2023': [...links] }
  const linksByYear = {};

  if (sortedLinks.length > 0) {
    for (const link of sortedLinks) {
      const relativePath = link.path;
      const totalContributions = link.total;

      // Extract year (e.g., from '2024/Q1-2024.html' -> '2024')
      const parts = path.dirname(relativePath).split(path.sep);
      const year = parts[parts.length - 1];

      const filename = path.basename(relativePath, '.html'); // Q1-2024
      const [quarter] = filename.split('-'); // Q1
      const quarterText = quarter.replace('Q', 'Quarter '); // Quarter 1

      if (!linksByYear[year]) {
        linksByYear[year] = [];
      }

      linksByYear[year].push({
        relativePath,
        quarterText,
        totalContributions,
      });
    }

    // Iterate through the years (newest year first)
    const sortedYears = Object.keys(linksByYear).sort().reverse();

    let openAttribute = 'open';

    for (const year of sortedYears) {
      // Start a new year section with a dedicated heading
      linkHtml += `
            <details ${openAttribute} class="col-span-full mb-8 border border-gray-200 rounded-xl shadow-lg transition duration-300">
                <summary class="text-2xl font-bold 
                text-gray-700 p-4 sm:p-6 cursor-pointer 
                hover:bg-indigo-100 transition duration-150 rounded-xl flex items-center">
                    <span class="mr-3">📅</span> ${year} Reports
                </summary>
                <div class="flex flex-col sm:flex-row 
                gap-6 
                report-list p-6 pb-12 sm:justify-between">
                `;

      // Add the quarterly cards for this year
      for (const link of linksByYear[year]) {
        // Updated card width to sm:w-[23.5%] and added flex-shrink-0 for uniform sizing
        linkHtml += `
                <div class="bg-white border border-indigo-200 hover:bg-indigo-50 transition duration-150 rounded-lg shadow-md overflow-hidden w-full sm:w-[23.5%] flex-shrink-0">
                    <a href="./${link.relativePath}" class="block p-4">
                        <p class="text-sm font-semibold text-indigo-700">${link.quarterText}</p>
                        <p class="text-3xl font-extrabold text-gray-800 mt-1">${link.totalContributions}</p>
                        <p class="text-xs text-gray-500">Total Contributions</p>
                    </a>
                </div>
                `;
      }

      // Close the quarterly list/grid for this year
      linkHtml += `
                </div>
            </details>
            `;

      openAttribute = '';
    }
  } else {
    // Fallback for no reports generated
    linkHtml = `<p class="p-4 text-gray-500 italic col-span-full">No quarterly reports have been generated yet.</p>`;
  }

  // 5. Build HTML Content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quarterly Reports</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M5.75 21a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 19.25a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM5.75 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM18.25 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM15 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0z'/%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M5.75 16.75A.75.75 0 006.5 16V8A.75.75 0 005 8v8c0 .414.336.75.75.75z'/%3E%3Cpath fill='%234338CA' fill-rule='evenodd' d='M17.5 8.75v-1H19v1a3.75 3.75 0 01-3.75 3.75h-7a1.75 1.75 0 00-1.75 1.75H5A3.25 3.25 0 018.25 11h7a2.25 2.25 0 002.25-2.25z'/%3E%3C/svg%3E">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
        }
        /* FIX: Removing padding: 0 to allow Tailwind utility classes to work */
        .report-list { 
            list-style: none; 
        } 
        .report-list a { text-decoration: none; }
        
        /* --- Dynamic Styling for Collapsible Year (is-open) --- */
        details summary {
            cursor: pointer;
            outline: none;
            color: #1f2937;
            transition: background-color 0.15s ease-in-out;
        }

        /* FIX 1: Apply indigo background to the entire details element when open */
        details.is-open {
            background-color: #EEF2FF; /* Light indigo background */
        }
        details.is-open summary {
            background-color: #EEF2FF; /* Matches the details background */
            border-radius: 0.5rem 0.5rem 0 0; 
            color: #4338CA; 
        }
        details:not(.is-open) {
            background-color: #f9fafb; /* Light gray background when closed */
        }
        details:not(.is-open) summary {
            border-bottom: none;
            border-radius: 0.5rem; 
        }
        /* --- END Dynamic Styling --- */
    </style>
</head>
<body>
${navHtml}
    <div class="mx-auto max-w-7xl bg-white p-6 sm:p-10 rounded-xl shadow-2xl mt-16">
        <header class="text-center mb-12 pb-4 border-b-2 border-indigo-100">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-indigo-700 mb-2 pt-8">
                <span class="text-5xl">📈</span> Quarterly Reports
            </h1>
            <p class="text-lg text-gray-600 max-w-3xl mx-auto mt-10 mb-6">
                Organized by calendar quarter, these reports track
                <a href="https://github.com/${GITHUB_USERNAME}" class="text-xl font-extrabold text-[#4338CA] hover:text-[#5E51D9] transition duration-150">
                    ${GITHUB_USERNAME}
                </a>'s external open source involvement, aggregating key community activities across 
                <strong>Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations</strong>.
            </p>
        </header>

        <section class="mb-14">
            <h2 class="text-3xl font-bold text-gray-800 border-b-2 border-indigo-500 pb-3 mb-8">
                Report Structure Breakdown
            </h2>
            <p class="text-lg text-gray-600 mb-8">
                Each quarterly report provides a detailed log and summary for that period:
            </p>
            
            <div class="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-indigo-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/4">
                                Section
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/2">
                                Content Description
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider w-1/4">
                                Key Metric / Insight
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${renderStructureTableRows()}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="mt-14 pt-8 border-t border-gray-300">
            <h2 class="text-3xl font-bold text-gray-800 border-b-2 border-indigo-500 pb-3 mb-8">
                Quarterly Reports (Detail Pages)
            </h2>
            <p class="text-lg text-gray-600 mb-6">
                Expand the yearly sections below and click on any quarter to view the detailed tables and statistics for that period.
            </p>
            <div class="grid grid-cols-1 report-list">
                ${linkHtml}
            </div>
        </section>
        ${footerHtml}
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('details').forEach(details => {
                // Initial state check for the default 'open' attribute
                if (details.open) {
                    details.classList.add('is-open');
                } else {
                    // Apply a background to closed elements for visual separation
                    details.classList.add('bg-gray-50'); 
                }

                // Listener for the 'toggle' event (triggered on open/close)
                details.addEventListener('toggle', () => {
                    if (details.open) {
                        details.classList.add('is-open');
                        details.classList.remove('bg-gray-50'); // Remove closed background
                    } else {
                        details.classList.remove('is-open');
                        details.classList.add('bg-gray-50'); // Re-apply closed background
                    }
                });
            });
        });
    </script>
</body>
</html>
`;

  // 5. Format the content
  const formattedContent = await prettier.format(htmlContent, {
    parser: 'html', // Ensure Prettier formats it as HTML
  });

  // 6. Write the formatted file
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`);
}

module.exports = {
  createHtmlReports,
};
