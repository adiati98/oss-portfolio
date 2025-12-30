const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { BASE_DIR, GITHUB_USERNAME } = require('../../config/config');
const {
  COLORS,
  FAVICON_SVG_ENCODED,
  LANDING_PAGE_ICONS,
  RIGHT_ARROW_SVG,
} = require('../../config/constants');

const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { getIndexStyleCss } = require('../css/style-generator');

const reportStructure = [
  {
    section: 'Quarterly Statistics',
    description:
      'A high-level summary showing the total contributions and repositories involved during the quarter.',
    iconKey: 'stats',
  },
  {
    section: 'Contribution Breakdown',
    description:
      'A table listing the count of contributions for each of the five core categories within that quarter.',
    iconKey: 'breakdown',
  },
  {
    section: 'Top 3 Repositories',
    description:
      'The top three projects where contributions were made in that quarter, ranked by total count.',
    iconKey: 'topRepos',
  },
  {
    section: 'Merged PRs',
    description:
      'Detailed list of Pull Requests authored by user and merged into external repositories.',
    iconKey: 'merged',
  },
  {
    section: 'Issues',
    description: 'Detailed list of Issues authored by user on external repositories.',
    iconKey: 'issues',
  },
  {
    section: 'Reviewed PRs',
    description:
      'Detailed list of Pull Requests reviewed or merged by user on external repositories.',
    iconKey: 'reviewed',
  },
  {
    section: 'Co-Authored PRs',
    description:
      "Pull Requests where user contributed commits to other contributor's Pull Requests.",
    iconKey: 'coAuthored',
  },
  {
    section: 'Collaborations',
    description:
      'Detailed list of open Issues or Pull Requests where user has commented to participate in discussion.',
    iconKey: 'collaborations',
  },
];

async function createIndexHtml() {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const HTML_OUTPUT_PATH = path.join(htmlBaseDir, 'index.html');

  // Ensure the directory exists
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const footerHtml = createFooterHtml();
  const navHtml = createNavHtml('./');
  const indexCss = getIndexStyleCss();
  const rightArrowSvg = RIGHT_ARROW_SVG;

  const cardsHtml = reportStructure
    .map((item) => {
      const iconSvg = LANDING_PAGE_ICONS[item.iconKey] || '';

      return `
        <div class="feature-card p-8 rounded-2xl border flex flex-col h-full transition-all duration-300 hover:-translate-y-1" 
             style="background-color: ${COLORS.primary[10]}; border-color: ${COLORS.border.light};">
            <div class="w-12 h-12 rounded-lg flex items-center justify-center mb-6 shrink-0" 
                 style="background-color: white; color: ${COLORS.primary.rgb};">
                ${iconSvg}
            </div>
            <h3 class="text-xl font-bold mb-3" style="color: ${COLORS.primary.rgb};">${item.section}</h3>
            <p class="text-sm leading-relaxed" style="color: ${COLORS.text.secondary};">${item.description}</p>
        </div>
      `;
    })
    .join('\n');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Open Source Portfolio</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${indexCss}
  </style>
</head>
<body class="antialiased bg-white text-slate-900">
  ${navHtml}
  
  <header class="pt-32 pb-20 px-6 border-b" style="border-color: ${COLORS.border.light};">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-5xl md:text-7xl font-black mb-8 mt-12" style="color: ${COLORS.primary.rgb};">
        Open Source Portfolio
      </h1>
      <h2 class="block text-4xl md:text-5xl font-bold opacity-80 mb-8" style="color: ${COLORS.primary[75]}";>@${GITHUB_USERNAME}</h2>
      <p class="text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto" style="color: ${COLORS.text.secondary};">
        A comprehensive visualization of open source contributions, from high-level impact to granular quarterly details.
      </p>
    </div>
  </header>

  <section class="py-24 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${cardsHtml}
      </div>

      <div class="mt-20 flex flex-col items-center justify-center gap-8 text-center">
        <a href="all-contributions.html" 
          style="color: ${COLORS.primary.rgb}; border-color: ${COLORS.primary[15]};" 
          class="index-report-link inline-flex items-center justify-center px-8 py-4 bg-white border font-bold rounded-xl shadow-md transition duration-200 hover:shadow-lg w-full sm:w-auto">
          <span class="text-lg">Explore All-Time Contributions</span>
          <span class="ml-2">${rightArrowSvg}</span>
        </a>
  
        <a href="reports.html" 
          class="browse-reports text-sm font-semibold transition-all hover:opacity-70">
          Or browse specific quarterly reports
        </a>
      </div>
    </div>
  </section>

  ${footerHtml}
</body>
</html>
`;

  const formattedContent = await prettier.format(htmlContent, {
    parser: 'html',
  });

  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log('Generated landing page successfully at: ' + HTML_OUTPUT_PATH);
}

module.exports = { createIndexHtml };
