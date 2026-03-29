const axios = require('axios');
const { BLOG } = require('../config/config');
const fccStaticArticles = require('../../metadata/fcc-articles');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        allArticles.push(
          ...data.map((a) => ({
            title: a.title,
            link: a.url,
            date: a.published_at,
            platform: 'Dev.to',
            tags: a.tag_list || [],
          }))
        );
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
 */
async function fetchStrictOssArticles() {
  console.log('--- Starting Global Article Sync ---');

  // 1. Fetch and filter dynamic Dev.to content
  const devToRaw = await fetchDevTo();
  const devToFiltered = filterOssArticles(devToRaw);

  // 2. Load manual freeCodeCamp content (from your metadata/fcc-articles.js)
  console.log(`Including ${fccStaticArticles.length} manual freeCodeCamp entries...`);
  const fccArticles = fccStaticArticles;

  // 3. Combine both sources
  const combinedArticles = [...devToFiltered, ...fccArticles];

  // 4. Global Sort: Newest to Oldest
  combinedArticles.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  console.log(`--- Finished: ${combinedArticles.length} total articles sorted by date ---`);

  return combinedArticles;
}

module.exports = { fetchStrictOssArticles };
