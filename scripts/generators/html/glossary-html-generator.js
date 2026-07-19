const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const {
  createNavHtml,
  createSkipToContentHtml,
  createBackToTopHtml,
  getBackToTopScript,
  SHARED_CHROME_CSS,
} = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { FAVICON_SVG_ENCODED } = require('../../config/constants');
const { GLOSSARY_CONTENT } = require('../../metadata/glossary');
const { getGlossaryStyleCss } = require('../css/style-generator');
const { getThemeInitScript, getThemeStyleVariant } = require('../../components/theme-init');

// Supplements getGlossaryStyleCss (shared, not owned by this generator) with
// token-only rules for classes this page emits. `.glossary-inline-code` was
// already referenced by processText below but had no matching rule anywhere
// — defined here now. All colors route through --t-* tokens, no hex.
const GLOSSARY_EXTRA_CSS = `
  .glossary-inline-code{font-family:ui-monospace,monospace;font-size:.85em;color:var(--t-accent);background:var(--t-card-2);border:1px solid var(--t-line);border-radius:4px;padding:1px 5px}
  .glossary-accent{color:var(--t-accent)}
  .glossary-body{color:var(--t-ink-2)}
  .glossary-caption{color:var(--t-ink-3)}
`;

async function createGlossaryHtml() {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'glossary.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const glossaryCss = getGlossaryStyleCss() + GLOSSARY_EXTRA_CSS;
  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();

  const processText = (text) => {
    if (!text) return '';
    return (
      text
        // 1. Transform backticks into a styled span
        .replace(/`(.*?)`/g, '<span class="glossary-inline-code">$1</span>')

        // 2. Bold labels
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

        // 3. List items: Wrap lines starting with '*' or '-' in <li>
        .replace(
          /^\s*[*|-]\s+(.*)$/gm,
          '<li class="ml-4 list-disc list-inside glossary-accent">$1</li>'
        )

        // 4. Wrap <li> groups in <ul>
        .replace(/(<li.*?>.*?<\/li>)+/g, '<ul class="my-3 space-y-1 glossary-accent">$1</ul>')

        // 5. Cleanup
        .replace(/<\/ul>\s+/g, '</ul>')

        // 6. Convert remaining newlines to <br>
        .replace(/\n(?!<ul|<li)/g, '<br>')
    );
  };

  const sections = GLOSSARY_CONTENT.sections || [];
  const metricBlocksHtml = sections
    .map((group) => {
      const itemsHtml = group.items
        .map((item) => {
          const description = processText(item.description);

          // Find the content from possible keys
          const rawNote = item.entryMethod || item.howItIsCalculated || item.source || '';
          const processedNote = processText(rawNote);

          // Determine the Label dynamically
          let label = 'Glossary Note';
          if (item.entryMethod) label = 'Entry Method';
          if (item.howItIsCalculated) label = 'Calculation Logic';
          if (item.source) label = 'Data Source';

          return dedent`
            <div id="${item.id}" class="mb-16 last:mb-0">
              <h3 style="color: var(--t-brand); border-bottom: 2px solid var(--t-brand-line);"
                  class="text-xl font-extrabold mb-6 pb-2 inline-block">
                ${item.title}
              </h3>
              
              <div class="space-y-6">
                <p class="text-lg glossary-body leading-relaxed">
                  ${description}
                </p>

                <div class="glossary-code-block p-6 overflow-x-auto rounded-2xl">
                  <span class="block text-xs uppercase tracking-widest glossary-caption mb-3 font-black font-mono">
                    ${label}
                  </span>
                  <div class="text-sm glossary-accent leading-relaxed">
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
            <h2 style="color: var(--t-brand);" class="text-3xl sm:text-4xl font-black mb-2">
              ${group.title}
            </h2>
            <p class="glossary-caption text-lg font-medium italic">${processText(group.description)}</p>
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
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Glossary | ${GITHUB_USERNAME} OSS Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      ${getThemeInitScript()}
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      ${getThemeStyleVariant()}
      <style>${glossaryCss}${SHARED_CHROME_CSS}</style>
    </head>
    <body style="background-color: var(--t-surface); color: var(--t-ink);" class="antialiased flex flex-col h-full min-h-full">
      ${createSkipToContentHtml('main')}
      ${navHtml}
      <main id="main" class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-7xl mx-auto">
            <header style="border-bottom-color: var(--t-brand-line);" class="text-center mt-16 mb-16 pb-12 border-b-2">
              <h1 style="color: var(--t-brand);" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
                ${GLOSSARY_CONTENT.title}
              </h1>
              <p class="text-xl max-w-3xl mx-auto leading-relaxed glossary-body">
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
      ${createBackToTopHtml()}
      ${getBackToTopScript()}
    </body>
    </html>
  `;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(outputPath, formattedContent, 'utf8');

  console.log('Generated glossary page successfully at: ' + outputPath);
}

module.exports = { createGlossaryHtml };
