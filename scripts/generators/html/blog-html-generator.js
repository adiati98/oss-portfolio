const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { FAVICON_SVG_ENCODED } = require('../../config/constants');
const { COLORS } = require('../../config/constants');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { getBlogStyleCss } = require('../css/style-generator');
const { getColorValue } = require('../../utils/color-helpers');

async function createBlogHtml(articles) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'blog.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const blogCss = getBlogStyleCss();
  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();

  const listItems = articles
    .map((article) => {
      const date = new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return dedent`
      <div class="article-card group py-10 border-b border-slate-100 last:border-0 transition-colors hover:bg-indigo-50/50">
        <h2 class="text-xl sm:text-2xl font-bold mb-3 pl-4">
          <a href="${article.link}" target="_blank" rel="noopener noreferrer" 
             style="color: ${getColorValue(COLORS.primary)};" 
             class="group-hover:text-indigo-800 transition-colors block">
            ${article.title}
          </a>
        </h2>
        <p class="article-meta text-slate-500 text-sm font-medium pl-4">
          Published on <span class="platform-tag font-bold text-slate-700">${article.platform}</span> — ${date}
        </p>
      </div>`;
    })
    .join('\n');

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Articles | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>${blogCss}</style>
    </head>
    <body class="bg-white antialiased flex flex-col h-full min-h-full">
      ${navHtml}
      <main class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-7xl mx-auto">
            <header style="border-bottom-color: ${getColorValue(COLORS.primary[15]) || '#e2e8f0'};" class="text-center mt-16 mb-16 pb-12 border-b-2">
              <h1 style="color: ${getColorValue(COLORS.primary)};" class="text-4xl sm:text-6xl font-black mb-6 pt-8">
                Open Source and GitHub Articles
              </h1>
              <p style="color: ${getColorValue(COLORS.text.secondary)};" class="text-xl max-w-3xl mx-auto leading-relaxed">
                A collection of articles that <strong>${GITHUB_USERNAME}</strong> wrote covering insights and tutorials regarding the Open Source and GitHub ecosystem.
              </p>
            </header>

            <div class="max-w-[90ch] mx-auto">
              <div class="articles-list">
                ${listItems || '<p class="text-slate-400 italic text-center py-12">No articles found with Open Source or GitHub tags.</p>'}
              </div>
            </div>
          </div>
        </div>
      </main>
      ${footerHtml}
    </body>
    </html>`;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(outputPath, formattedContent, 'utf8');
  console.log(`Generated blog HTML page at ${outputPath}`);
}

module.exports = { createBlogHtml };
