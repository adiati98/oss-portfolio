const fs = require('fs/promises');
const path = require('path');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');

/**
 * Generates and writes a Markdown report of articles written by the user.
 * @param {Array} articles Sorted list of article objects.
 */
async function writeArticlesMarkdown(articles) {
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  const outputPath = path.join(mdBaseDir, 'blog.md');

  await fs.mkdir(mdBaseDir, { recursive: true });

  let markdownContent = `# Open Source and GitHub Articles\n\n`;

  markdownContent += `A collection of articles that **${GITHUB_USERNAME}** wrote covering insights and tutorials regarding the Open Source and GitHub ecosystem.\n\n`;

  if (!articles || articles.length === 0) {
    markdownContent += `No articles found with Open Source or GitHub tags.\n`;
  } else {
    articles.forEach((article) => {
      const date = new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const title = article.title.trim();

      markdownContent += `* **[${title}](${article.link})**\n`;

      markdownContent += `  * Published on **${article.platform}** — ${date}\n\n`;
    });
  }

  await fs.writeFile(outputPath, markdownContent.trim() + '\n', 'utf8');
  console.log(`Generated articles Markdown report at ${outputPath}`);
}

module.exports = { writeArticlesMarkdown };
