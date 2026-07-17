const fs = require('fs/promises');
const path = require('path');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');

/**
 * Generates and writes a Markdown report of articles written by the user.
 * Mirrors writing.html — renamed from blog.md in the IA restructure
 * (design blueprint §02).
 * @param {Array} articles Sorted list of article objects.
 * @param {Array} [talks] contents/talks.js — the Talks section is omitted
 *                        entirely while this is empty.
 */
async function writeArticlesMarkdown(articles, talks = []) {
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  const outputPath = path.join(mdBaseDir, 'writing.md');

  await fs.mkdir(mdBaseDir, { recursive: true });

  let markdownContent = `# Writing & Talks\n\n`;

  markdownContent += `Long-form guides, community essays, and conference talks by **${GITHUB_USERNAME}**, covering insights and tutorials regarding the Open Source and GitHub ecosystem.\n\n`;

  markdownContent += `## ✍️ Articles\n\n`;

  if (!articles || articles.length === 0) {
    markdownContent += `No articles found with Open Source or GitHub tags.\n\n`;
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

  if (talks && talks.length > 0) {
    markdownContent += `## 🎤 Talks\n\n`;
    talks.forEach((talk) => {
      const meta = [talk.event, talk.year, talk.length].filter(Boolean).join(' · ');
      markdownContent += `* **[${talk.title}](${talk.url})**\n`;
      markdownContent += `  * ${meta}\n`;
      if (talk.blurb) markdownContent += `  * ${talk.blurb}\n`;
      markdownContent += `\n`;
    });
  }

  await fs.writeFile(outputPath, markdownContent.trim() + '\n', 'utf8');
  console.log(`Generated articles Markdown report at ${outputPath}`);
}

module.exports = { writeArticlesMarkdown };
