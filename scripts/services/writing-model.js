/**
 * Shared grouping/sort rules for the Writing page — consumed by both
 * blog-html-generator.js (writing.html) and blog-markdown-generator.js
 * (writing.md) so the two outputs can't drift apart structurally.
 */

function newestFirst(articles) {
  return [...articles].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** Distinct platform names present in a list — drives the platform label and filters. */
function platformsIn(articles) {
  return [...new Set(articles.map((a) => a.platform).filter(Boolean))];
}

/**
 * One node per org, articles newest-first inside each, orgs ordered by their
 * most recent piece. An article missing `org` never reaches here (the caller
 * splits on it), so grouping is safe without a fallback bucket.
 */
function groupByOrg(orgArticles) {
  const byOrg = new Map();
  for (const article of orgArticles) {
    if (!byOrg.has(article.org)) byOrg.set(article.org, []);
    byOrg.get(article.org).push(article);
  }
  return [...byOrg.entries()]
    .map(([org, items]) => ({ org, items: newestFirst(items) }))
    .sort((a, b) => new Date(b.items[0].date) - new Date(a.items[0].date));
}

module.exports = { newestFirst, platformsIn, groupByOrg };
