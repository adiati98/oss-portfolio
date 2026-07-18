const axios = require('axios');
const { BLOG } = require('../config/config');
const fccStaticArticles = require('../../contents/fcc-articles');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The author's own site — a canonical_url pointing here is still an OWN article,
// not one written for another publication. Falls back to adiati.com when
// BLOG.domain isn't set in config.
const OWN_SITE_HOST = String(BLOG.domain || 'adiati.com')
  .replace(/^www\./i, '')
  .toLowerCase();

// Foreign canonical hosts we can name as a publication. Anything not listed
// falls back to the bare host (see classifyDevToArticle rule 2).
const KNOWN_PUBLICATIONS = {
  'freecodecamp.org': 'freeCodeCamp',
  'mautic.org': 'Mautic',
  'opensauced.pizza': 'OpenSauced',
};

/** Bare host of a URL (no `www.`, lowercased), or null if unparseable. */
function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    return null;
  }
}

/** Scheme-, www-, and trailing-slash-insensitive URL key for dedup/matching. */
function normalizeUrl(url) {
  return String(url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Classifies a raw Dev.to API article by ownership and emits the org/canonical
 * contract on it:
 *   1. `organization` present  → it lives under a Dev.to org; org = its name
 *      (the URL path is the org slug, e.g. dev.to/opensauced/...).
 *   2. else a `canonical_url` whose host is neither dev.to nor the author's own
 *      site → written for another publication; org = the known publication name
 *      for that host, else the bare host.
 *   3. otherwise → the author's own article; org = null.
 * `canonical` is the API's canonical_url (string|null) verbatim.
 */
function classifyDevToArticle(a) {
  const canonical = a.canonical_url || null;
  let org = null;
  if (a.organization && a.organization.name) {
    org = a.organization.name;
  } else if (canonical) {
    const host = hostOf(canonical);
    if (host && host !== 'dev.to' && host !== OWN_SITE_HOST) {
      org = KNOWN_PUBLICATIONS[host] || host;
    }
  }
  return {
    title: a.title,
    link: a.url,
    date: a.published_at,
    platform: 'Dev.to',
    tags: a.tag_list || [],
    org,
    canonical,
  };
}

/**
 * Filter dynamic articles to ensure they match our core topics.
 */
function filterOssArticles(articles) {
  const allowedTags = ['open-source', 'opensource', 'oss', 'open source', 'github'];

  return articles.filter((article) => {
    const tags = (article.tags || []).map((t) => {
      if (typeof t === 'object') return (t.name || t.term || '').toLowerCase();
      return String(t).toLowerCase();
    });

    return allowedTags.some((tag) => tags.includes(tag));
  });
}

/**
 * Fetches articles from Dev.to using the config username.
 */
async function fetchDevTo() {
  // Guard clause: If no Dev.to user is set, skip the fetch
  if (!BLOG.devToUser) {
    console.log('No Dev.to username found in config. Skipping Dev.to fetch.');
    return [];
  }

  let allArticles = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`Fetching Dev.to page ${page}...`);
      const { data } = await axios.get(
        `https://dev.to/api/articles?username=${BLOG.devToUser}&page=${page}&per_page=100`
      );

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        // classifyDevToArticle keeps the API's `organization` and
        // `canonical_url` — previously dropped here — as the org/canonical
        // contract every downstream renderer reads.
        allArticles.push(...data.map(classifyDevToArticle));
        page++;
        await sleep(500);
      }
    }
    return allArticles;
  } catch (error) {
    console.error('Error fetching from Dev.to:', error.message);
    return allArticles;
  }
}

/**
 * Aggregates the manual FCC list and filtered Dev.to articles.
 *
 * Every emitted record carries `org` (string|null) and `canonical`
 * (string|null), and each article appears EXACTLY ONCE: a Dev.to cross-post
 * whose canonical points at a manual freeCodeCamp entry is the same article, so
 * the Dev.to copy is dropped and the manual entry — the authoritative one, with
 * the real publication date and URL — is kept.
 */
async function fetchStrictOssArticles() {
  console.log('--- Starting Global Article Sync ---');

  // 1. Fetch and filter dynamic Dev.to content (already org/canonical-classified)
  const devToRaw = await fetchDevTo();
  const devToFiltered = filterOssArticles(devToRaw);

  // 2. Load manual freeCodeCamp content (from your metadata/fcc-articles.js).
  // These are freeCodeCamp publications, and their own link IS their canonical.
  console.log(`Including ${fccStaticArticles.length} manual freeCodeCamp entries...`);
  const fccArticles = fccStaticArticles.map((a) => ({
    ...a,
    org: 'freeCodeCamp',
    canonical: a.link || null,
  }));

  // 3. Drop Dev.to copies of a manual freeCodeCamp article (matched on
  // canonical, scheme/www/trailing-slash-insensitively) so it can't appear both
  // as an org article and as an own article.
  const fccCanonicals = new Set(fccArticles.map((a) => normalizeUrl(a.canonical)));
  const devToDeduped = devToFiltered.filter(
    (a) => !(a.canonical && fccCanonicals.has(normalizeUrl(a.canonical)))
  );
  const droppedCrossPosts = devToFiltered.length - devToDeduped.length;
  if (droppedCrossPosts > 0) {
    console.log(`Dropped ${droppedCrossPosts} Dev.to cross-post(s) of manual freeCodeCamp entries.`);
  }

  // 4. Combine both sources, guarding against the same URL landing twice (e.g.
  // a Dev.to page boundary repeating an article between paginated requests).
  const seenLinks = new Set();
  const combinedArticles = [...devToDeduped, ...fccArticles].filter((a) => {
    const key = normalizeUrl(a.link);
    if (!key || seenLinks.has(key)) return false;
    seenLinks.add(key);
    return true;
  });

  // 5. Global Sort: Newest to Oldest
  combinedArticles.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  console.log(`--- Finished: ${combinedArticles.length} total articles sorted by date ---`);

  return combinedArticles;
}

module.exports = { fetchStrictOssArticles };
