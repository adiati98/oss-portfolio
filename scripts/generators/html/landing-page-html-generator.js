const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { BASE_DIR } = require('../../config/config');
const { COLORS, FAVICON_SVG_ENCODED, LANDING_PAGE_ICONS } = require('../../config/constants');

const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');

const reportStructure = [
  {
    section: 'Quarterly Statistics',
    description:
      'A high-level summary showing the total contributions and repositories involved in during the quarter.',
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
    description: "Pull Requests where user contributed commits to other contributor's Pull Requests.",
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
  const HTML_OUTPUT_PATH = path.join(BASE_DIR, 'index.html');
  const footerHtml = createFooterHtml();
  const navHtml = createNavHtml('../');

  // Generate the HTML for cards
  const cardsHtml = reportStructure
    .map((item) => {
      // Safety check: Get icon from constants or show a placeholder if missing
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
    :root { --brand-primary: ${COLORS.primary.rgb}; }
    .feature-card:hover { border-color: var(--brand-primary) !important; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1); }
    .btn-secondary:hover { background-color: ${COLORS.primary[10]}; transform: translateY(-2px); }
    .btn-primary:hover { filter: brightness(1.1); transform: translateY(-2px); }
    /* Ensure SVGs inside the container are visible and sized correctly */
    .feature-card svg { width: 1.75rem; height: 1.75rem; display: block; }
  </style>
</head>
<body class="antialiased bg-white text-slate-900">
  ${navHtml}
  
  <header class="pt-32 pb-20 px-6 border-b" style="border-color: ${COLORS.border.light};">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-5xl md:text-7xl font-black mb-8 mt-12" style="color: var(--brand-primary);">Open Source Portfolio</h1>
      <p class="text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto" style="color: ${COLORS.text.secondary};">
        Visualizing open source engagement through structured, data-driven quarterly reports.
      </p>
    </div>
  </header>

  <section class="py-24 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${cardsHtml}
      </div>

      <div class="mt-20 flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="./html-generated/all-contributions.html" 
           class="btn-secondary w-full sm:w-auto text-center px-8 py-4 rounded-xl font-bold transition-all border-2" 
           style="border-color: var(--brand-primary); color: var(--brand-primary);">
           View All Contributions
        </a>
        <a href="./html-generated/reports.html" 
           class="btn-primary w-full sm:w-auto text-center px-8 py-4 rounded-xl font-bold text-white transition-all border-2 border-transparent" 
           style="background-color: var(--brand-primary);">
           View Quarterly Reports
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
    printWidth: 120,
  });

  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');
  console.log('Generated landing page successfully.');
}

module.exports = { createIndexHtml };
