const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { COLORS, FAVICON_SVG_ENCODED } = require('../../config/constants');
const { GLOSSARY_CONTENT } = require('../../../metadata/glossary');
const { getColorValue } = require('../../utils/color-helpers');
const { getGlossaryStyleCss } = require('../css/style-generator');

async function createGlossaryHtml() {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'glossary.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const glossaryCss = getGlossaryStyleCss();
  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();
  const primaryColor = getColorValue(COLORS.primary);

  const processText = (text) => {
    return text
      .replace(/{{GITHUB_USERNAME}}/g, GITHUB_USERNAME)
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-800 font-black">$1</strong>');
  };

  const sections = GLOSSARY_CONTENT.sections || [];
  const metricBlocksHtml = sections
    .map((group) => {
      const itemsHtml = group.items
        .map((item) => {
          // Inside the itemsHtml.map function
          const description = processText(item.description);

          // 1. Find the content from any of the three possible keys
          const rawNote = item.entryMethod || item.howItIsCalculated || item.source || '';
          const processedNote = processText(rawNote);

          // 2. Determine the Label dynamically
          let label = 'Glossary Note'; // The "middle ground" fallback
          if (item.entryMethod) label = 'Entry Method';
          if (item.howItIsCalculated) label = 'Calculation Logic';
          if (item.source) label = 'Data Source';

          return dedent`
            <div id="${item.id}" class="mb-16 last:mb-0">
              <h3 style="color: ${primaryColor}; border-bottom: 2px solid ${COLORS.primary[15]};" 
                  class="text-xl font-extrabold mb-6 pb-2 inline-block">
                ${item.title}
              </h3>
              
              <div class="space-y-6">
                <p class="text-lg text-slate-600 leading-relaxed">
                  ${description}
                </p>
                
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono overflow-x-auto">
                  <span class="block text-xs uppercase tracking-widest text-slate-400 mb-3 font-black">
                    ${label}
                  </span>
                  <div class="text-sm text-indigo-600 leading-relaxed">
                    ${processedNote}
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      return dedent`
        <section id="${group.id}" class="mb-24 last:mb-0">
          <div class="mb-10">
            <h2 style="color: ${primaryColor};" class="text-3xl sm:text-4xl font-black mb-2">
              ${group.title}
            </h2>
            <p class="text-slate-500 text-lg font-medium italic">${processText(group.description)}</p>
          </div>
          <div class="space-y-2">
            ${itemsHtml}
          </div>
        </section>
      `;
    })
    .join('');

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Glossary | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>${glossaryCss}</style>
    </head>
    <body class="bg-white antialiased flex flex-col min-h-screen">
      ${navHtml}
      <main class="grow w-full">
        <div class="min-h-full px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-7xl mx-auto">
            <header style="border-bottom-color: ${COLORS.primary[15] || '#e2e8f0'};" class="text-center mt-16 mb-16 pb-12 border-b-2">
              <h1 style="color: ${primaryColor};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
                ${GLOSSARY_CONTENT.title}
              </h1>
              <p class="text-xl max-w-3xl mx-auto leading-relaxed text-slate-600">
                ${processText(GLOSSARY_CONTENT.subtitle)}
              </p>
            </header>
            <div class="max-w-[90ch] mx-auto">
              <article class="glossary-content">
                <div class="metrics-container">
                  ${metricBlocksHtml}
                </div>
              </article>
            </div>
          </div>
        </div>
      </main>
      ${footerHtml}
    </body>
    </html>
  `;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(outputPath, formattedContent, 'utf8');
}

module.exports = { createGlossaryHtml };
