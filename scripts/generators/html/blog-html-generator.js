const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { FAVICON_SVG_ENCODED } = require('../../config/constants');
const { createNavHtml } = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { getBlogStyleCss } = require('../css/style-generator');

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
      <div class="article-card px-4 sm:px-0">
        <h3 class="text-xl mb-2">
          <a href="${article.link}" target="_blank" rel="noopener noreferrer">
            ${article.title}
          </a>
        </h3>
        <p class="article-meta text-slate-500 text-sm">
          Published on <span class="platform-tag font-bold text-slate-700">${article.platform}</span> — ${date}
        </p>
      </div>`;
    })
    .join('\n');

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Articles | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>${blogCss}</style>
    </head>
    <body class="bg-white antialiased flex flex-col min-h-screen">
      ${navHtml}
      <main class="grow w-full py-24">
        <div class="max-w-[80ch] mx-auto px-6">
          <header class="mb-12 border-b-2 border-slate-100 pb-8">
            <h1 class="text-4xl font-black text-slate-900 mb-4">Open Source and GitHub Articles</h1>
            <p class="text-lg text-slate-500">
              A collection of articles that <strong>${GITHUB_USERNAME}</strong> wrote covering insights and tutorials regarding the Open Source and GitHub ecosystem.
            </p>
          </header>
          <div class="articles-list">
            ${listItems || '<p class="text-slate-400 italic">No articles found with Open Source or GitHub tags.</p>'}
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
