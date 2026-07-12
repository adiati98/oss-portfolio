const fs = require('fs/promises');

/**
 * SHARED: cache of PRs/issues that returned a confirmed non-rate-limit 403 —
 * in practice, a public repo under an org that enforces SSO and requires the
 * token to be explicitly authorized for it (an access-control restriction,
 * not a privacy one — private repos are excluded separately, deliberately,
 * before any of this code runs). These will 403 again no matter how long we
 * wait, so once one is confirmed, later runs skip it entirely instead of
 * re-fetching (and re-waiting on) something that can't succeed — until the
 * monthly full sync wipes this file and gives everything a fresh chance.
 *
 * Loaded once into memory and mutated in place for the whole run rather than
 * read-modify-written to disk per failure, so concurrent PR processing can't
 * corrupt the file with interleaved writes.
 */
async function loadFailedFetchCache(filePath) {
  const cache = new Map();
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    for (const [url, entry] of Object.entries(parsed)) {
      cache.set(url, entry);
    }
  } catch (e) {
    // Missing or unreadable file — start fresh.
  }
  return cache;
}

async function persistFailedFetchCache(filePath, cache) {
  const obj = {};
  for (const [url, entry] of cache) {
    obj[url] = entry;
  }
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { loadFailedFetchCache, persistFailedFetchCache };
