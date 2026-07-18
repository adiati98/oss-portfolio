const fs = require('fs/promises');
const path = require('path');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { newestFirst, platformsIn, groupByOrg } = require('../../services/writing-model');

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Mirrors renderArticleItem's meta line (platform label only when the list
 * spans more than one). Tags are dropped in markdown — they're clickable
 * filter chips on writing.html, but inert text here. The date is a
 * continuation line of the same bullet, not a nested sub-bullet.
 */
function articleBullet(article, { showPlatform }) {
  const title = article.title.trim();
  let md = `* **[${title}](${article.link})**\n`;
  const platformBit = showPlatform && article.platform ? `Published on **${article.platform}** — ` : '';
  md += `  ${platformBit}${formatDate(article.date)}\n`;
  return md + '\n';
}

/** Mirrors renderOrgTimeline: one heading per org, newest org first, articles newest-first inside. */
function renderOrgSection(orgArticles) {
  if (orgArticles.length === 0) return '';
  let md = `## 🏢 Written for organizations\n\n`;
  for (const { org, items } of groupByOrg(orgArticles)) {
    const showPlatform = platformsIn(items).length > 1;
    md += `### ${org} — ${items.length} article${items.length === 1 ? '' : 's'}\n\n`;
    items.forEach((article) => {
      md += articleBullet(article, { showPlatform });
    });
  }
  return md;
}

/** Mirrors renderPersonalSection: newest-first, platform label only when the list spans more than one. */
function renderPersonalSection(personalArticles, hasOrgArticles) {
  let md = `## ✍️ Personal writing\n\n`;
  if (personalArticles.length === 0) {
    const msg = hasOrgArticles
      ? 'No personal writing yet — see the organization pieces above.'
      : 'No articles found with Open Source or GitHub tags.';
    return md + `${msg}\n\n`;
  }
  const showPlatform = platformsIn(personalArticles).length > 1;
  newestFirst(personalArticles).forEach((article) => {
    md += articleBullet(article, { showPlatform });
  });
  return md;
}

/**
 * Generates and writes a Markdown report of articles written by the user.
 * Mirrors writing.html — renamed from blog.md in the IA restructure
 * (design blueprint §02). Talks live exclusively on the Journey timeline,
 * not here. Structure matches writing.html exactly: an org timeline (one
 * heading per org with `org` set, newest org first) above a personal list
 * (only articles with org = null/missing); an article appears in exactly
 * one section, never both. Grouping/sort rules live in
 * services/writing-model.js, shared with the HTML generator.
 * @param {Array} articles Sorted list of article objects.
 */
async function writeArticlesMarkdown(articles) {
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  const outputPath = path.join(mdBaseDir, 'writing.md');

  await fs.mkdir(mdBaseDir, { recursive: true });

  const all = articles || [];
  const orgArticles = all.filter((a) => Boolean(a.org));
  const personalArticles = all.filter((a) => !a.org);

  let markdownContent = `# Writing\n\n`;
  markdownContent += `Articles by **${GITHUB_USERNAME}**, covering insights and tutorials regarding the Open Source and GitHub ecosystem.\n\n`;
  markdownContent += renderOrgSection(orgArticles);
  markdownContent += renderPersonalSection(personalArticles, orgArticles.length > 0);

  await fs.writeFile(outputPath, markdownContent.trim() + '\n', 'utf8');
  console.log(`Generated articles Markdown report at ${outputPath}`);
}

module.exports = { writeArticlesMarkdown };
