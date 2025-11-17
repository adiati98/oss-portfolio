const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import configuration (SINCE_YEAR is needed for reporting)
const { BASE_DIR, SINCE_YEAR, GITHUB_USERNAME } = require('./config');

// Import navbar and footer
const { navHtml } = require('./navbar');
const { createFooterHtml } = require('./footer');

// Import favicon svg
const { FAVICON_SVG_ENCODED, COLORS } = require('./constants');

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
        'A high-level summary showing the total contributions and repositories involved in during the quarter.',
      metricTitle: 'Total Count, Unique Repositories',
      metricDescription: 'Aggregated totals for the 90-day period',
    },
    {
      section: 'Contribution Breakdown',
      description:
        'A table listing the count of contributions for each of the five core categories within that quarter.',
      metricTitle: 'Category Counts',
      metricDescription: 'Snapshot of all contribution types',
    },
    {
      section: 'Top 3 Repositories',
      description:
        'The top three projects where contributions were made in that quarter, ranked by total count.',
      metricTitle: 'Contribution Frequency',
      metricDescription: 'Count per repository, ranked highest first',
    },
    {
      section: 'Merged PRs',
      description:
        'Detailed list of Pull Requests authored by user and merged into external repositories.',
      metricTitle: 'Review Period',
      metricDescription: 'Time from creation to merge',
    },
    {
      section: 'Issues',
      description: 'Detailed list of Issues authored by user on external repositories.',
      metricTitle: 'Closing Period',
      metricDescription: 'Time from creation to close',
    },
    {
      section: 'Reviewed PRs',
      description:
        'Detailed list of Pull Requests reviewed or merged by user on external repositories.',
      metricTitle: "User's First Review Period",
      metricDescription: "Time from PR creation to user's first review",
    },
    {
      section: 'Co-Authored PRs',
      description:
        "Pull Requests where user contributed commits (including co-authored commits) to other contributor's PRs.",
      metricTitle: "User's First Commit Period",
      metricDescription: "Time from PR creation to user's first commit",
    },
    {
      section: 'Collaborations',
      description:
        'Detailed list of open Issues or PRs where user has commented to participate in discussion.',
      metricTitle: "User's First Comment",
      metricDescription: "The date of user's initial comment",
    },
  ];

  // Helper function to render table rows
  const renderStructureTableRows = () => {
    const totalRows = reportStructure.length;
    return reportStructure
      .map((item, index) => {
        const safeDescription = item.description;
        const safeMetricTitle = item.metricTitle;

        const bgColor = index % 2 === 0 ? COLORS.background.white : COLORS.background.altRows;
        const borderStyle =
          index === totalRows - 1 ? '' : `style="border-bottom: 1px solid ${COLORS.border.light};"`; // Light gray borders

        return `
            <tr style="background-color: ${bgColor};" ${borderStyle}>
              <td style="color: ${COLORS.primary.rgb};" class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${item.section}
              </td>
              <td style="color: ${COLORS.text.secondary};" class="px-6 py-4 text-sm">
                ${safeDescription}
              </td>
              <td style="color: ${COLORS.text.secondary};" class="px-6 py-4 text-sm">
                <span>${safeMetricTitle}</span>
                <span class="block text-xs italic" style="color: ${COLORS.text.muted};">
                  ${item.metricDescription}
                </span>
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
            <details ${openAttribute} class="col-span-full mb-8 border rounded-xl transition duration-300" style="border-color: ${COLORS.border.light};">
                <summary style="color: ${COLORS.text.primary};" class="text-2xl font-bold p-4 sm:p-6 cursor-pointer transition duration-150 rounded-xl flex items-center">
                    <span class="mr-3">📅</span> ${year} Reports
                </summary>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-6 report-list p-6 pb-12">
                `;

      // Add the quarterly cards for this year
      for (const link of linksByYear[year]) {
        linkHtml += `
                <a href="./${link.relativePath}" style="border-color: ${COLORS.border.light}; cursor: pointer; transition: border-color 0.15s ease-in-out; background-color: white; text-decoration: none; display: block;" 
                   class="report-card-link bg-white border rounded-lg shadow-md overflow-hidden w-full hover:shadow-lg transition duration-150 p-4">
                    <p style="color: ${COLORS.primary.rgb};" class="text-sm font-semibold">${link.quarterText}</p>
                    <p style="color: ${COLORS.text.primary};" class="text-3xl font-extrabold mt-1">${link.totalContributions}</p>
                    <p style="color: ${COLORS.text.muted};" class="text-xs">Total Contributions</p>
                </a>
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
    linkHtml = `<p style="color: ${COLORS.text.muted};" class="p-4 italic col-span-full">No quarterly reports have been generated yet.</p>`;
  }

  // 5. Build HTML Content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quarterly Reports</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh; 
      display: flex;
      flex-direction: column;
    }
    .report-list { 
      list-style: none; 
    } 
    .report-list a { text-decoration: none; }
        
    /* --- Dynamic Styling for Collapsible Year (is-open) --- */
    details summary {
      cursor: pointer;
      outline: none;
      color: ${COLORS.text.primary};
      transition: background-color 0.15s ease-in-out;
    }
    summary:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }

    /* Apply primary background to the entire details element when open */
    details.is-open {
      background-color: ${COLORS.primary[5]}; /* Light primary background */
    }
    details.is-open summary {
      background-color: ${COLORS.primary[5]}; /* Matches the details background */
      border-radius: 0.5rem 0.5rem 0 0; 
      color: ${COLORS.primary.rgb}; 
    }
    details.is-open summary:hover,
    details.is-open summary:focus-visible {
      background-color: ${COLORS.primary[10]}; /* Slightly darker on hover */
    }
    details:not(.is-open) {
      background-color: ${COLORS.background.altRows}; /* Light gray background when closed */
    }
    details:not(.is-open) summary {
      border-bottom: none;
      border-radius: 0.5rem; 
    }
    details:not(.is-open) summary:hover,
    details:not(.is-open) summary:focus-visible {
      background-color: ${COLORS.primary[5]}; /* Light primary background on hover when closed */
    }
    /* Accessible styles for report card links */
    .report-card-link:hover,
    .report-card-link:focus-visible {
      border-color: ${COLORS.primary.rgb};
    }
    .report-card-link:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }
    /* --- END Dynamic Styling --- */
  </style>
</head>
<body>
${navHtml}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header style="border-bottom-color: ${COLORS.primary[15]};" class="text-center mt-16 mb-12 pb-4 border-b-2">
          <h1 style="color: ${COLORS.primary.rgb};" class="text-4xl sm:text-5xl font-extrabold mb-2 pt-8">
              Quarterly Reports
          </h1>
          <p style="color: ${COLORS.text.secondary};" class="text-lg max-w-3xl mx-auto mt-10 mb-6">
            Organized by calendar quarter, these reports track
            <a href="https://github.com/${GITHUB_USERNAME}" style="color: ${COLORS.primary.rgb};" class="text-xl font-extrabold hover:opacity-80 transition duration-150">
                ${GITHUB_USERNAME}
            </a>'s external open source involvement, aggregating key community activities across 
            <strong>Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations</strong>.
          </p>
        </header>

        <section class="mb-14">
          <h2 style="color: ${COLORS.text.primary};" class="text-3xl font-bold pb-3 mb-1">
            Report Structure Breakdown
          </h2>
          <p style="color: ${COLORS.text.secondary};" class="text-lg mb-12">
            Each quarterly report provides a detailed log and summary for that period.
          </p>
            
          <div style="border-color: ${COLORS.border.light};" class="overflow-x-auto rounded-xl shadow-lg border">
            <table class="min-w-full" style="border-collapse: separate; border-color: ${COLORS.border.light};">
              <thead style="background-color: ${COLORS.primary[5]};">
                <tr>
                  <th scope="col" style="color: ${COLORS.primary.rgb};" class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider w-1/4">
                    Section
                  </th>
                  <th scope="col" style="color: ${COLORS.primary.rgb};" class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider w-1/2">
                    Content Description
                  </th>
                  <th scope="col" style="color: ${COLORS.primary.rgb};" class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider w-1/4">
                    Key Metric / Insight
                  </th>
                </tr>
              </thead>
              <tbody style="border-color: ${COLORS.border.light};">
                  ${renderStructureTableRows()}
              </tbody>
              </table>
          </div>
        </section>

        <section class="mt-14 pt-8">
          <h2 style="color: ${COLORS.text.primary};" class="text-3xl font-bold pb-3 mb-1">
            Quarterly Reports (Detail Pages)
          </h2>
          <p style="color: ${COLORS.text.secondary};" class="text-lg mb-12">
            Expand the yearly sections below and click on any quarter to view the detailed tables and statistics for that period.
          </p>
          <div class="grid grid-cols-1 report-list">
            ${linkHtml}
          </div>
        </section>
      </div>

      <script>
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('details').forEach(details => {
            const summary = details.querySelector('summary');
            
            // Initial state check for the default 'open' attribute
            if (details.open) {
              details.classList.add('is-open');
            } else {
              // Apply a background to closed elements for visual separation
              details.classList.add('bg-gray-50'); 
            }

            // Add tabindex to summary for keyboard navigation
            if (summary) {
              summary.setAttribute('tabindex', '0');
              
              // Add keyboard support to summary
              summary.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  details.open = !details.open;
                }
              });
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
    </div>
  </main>
  ${footerHtml}
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
