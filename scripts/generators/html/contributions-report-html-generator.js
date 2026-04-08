const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');

// Import the dedent utility
const { dedent } = require('../../utils/dedent');

// Import configuration (SINCE_YEAR is needed for reporting)
const { BASE_DIR, SINCE_YEAR } = require('../../config/config');

// Import navbar and footer
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');

// Import favicon svg
const { FAVICON_SVG_ENCODED, COLORS } = require('../../config/constants');

// Import the new style generator function
const { getReportsListStyleCss } = require('../css/style-generator');

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

  // Generate the footer HTML and dynamic CSS
  const footerHtml = createFooterHtml();
  const reportsListCss = getReportsListStyleCss();

  // Generate the navbar with the correct relative path to root
  const navHtml = createNavHtml('./');

  // Generate Quarterly Links HTML
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
      linkHtml += dedent`
            <details ${openAttribute} class="col-span-full mb-8 border rounded-2xl overflow-hidden transition duration-300" style="border-color: ${COLORS.border.light};">
                <summary style="color: ${COLORS.text.primary};" class="text-2xl font-bold p-6 cursor-pointer transition duration-150 flex items-center bg-slate-50/50">
                    <span class="mr-3">📅</span> ${year} Reports
                </summary>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8">
                `;

      // Add the quarterly cards for this year
      for (const link of linksByYear[year]) {
        linkHtml += dedent`
                <a href="./${link.relativePath}" 
                   style="border-color: ${COLORS.border.light};" 
                   class="report-card-link bg-white border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
                    <p style="color: ${COLORS.primary.rgb};" class="text-sm font-semibold">${link.quarterText}</p>
                    <p style="color: ${COLORS.text.primary};" class="text-3xl font-extrabold mt-1">${link.totalContributions}</p>
                    <p style="color: ${COLORS.text.muted};" class="text-xs">Total Contributions</p>
                </a>
                `;
      }

      // Close the quarterly list/grid for this year
      linkHtml += dedent`
                </div>
            </details>
            `;

      openAttribute = '';
    }
  } else {
    // Fallback for no reports generated
    linkHtml = `<p style="color: ${COLORS.text.secondary};" class="p-12 text-center italic border-2 border-dashed rounded-2xl">No quarterly reports have been generated yet.</p>`;
  }

  // Build HTML Content
  const htmlContent = dedent`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quarterly Reports | Open Source Portfolio</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    ${reportsListCss}
  </style>
</head>
<body class="bg-white antialiased">
${navHtml}
  <main class="grow w-full">
    <div class="min-h-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24 py-6 sm:py-10">
      <div class="max-w-[120ch] mx-auto">
        <header style="border-bottom-color: ${COLORS.primary[15]};" class="text-center mt-16 mb-16 pb-12 border-b-2">
          <h1 style="color: ${COLORS.primary.rgb};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
            Quarterly Reports
          </h1>
          <p style="color: ${COLORS.text.secondary};" class="text-xl max-w-3xl mx-auto leading-relaxed">
            Organized by calendar quarter, these reports track external open source involvement,
            aggregating key community activities across all tracked repositories.
          </p>
        </header>

        <section class="mt-4">
          <div class="flex flex-col">
            ${linkHtml}
          </div>
        </section>
      </div>
    </div>
  </main>
  ${footerHtml}
</body>
</html>
`;

  // Format the content
  const formattedContent = await prettier.format(htmlContent, {
    parser: 'html',
  });

  // Write the formatted file
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log(`Written aggregate HTML report: ${HTML_OUTPUT_PATH}`);
}

module.exports = {
  createHtmlReports,
};
