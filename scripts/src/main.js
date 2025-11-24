const path = require('path');
const fs = require('fs/promises');

// Import configuration (SINCE_YEAR is needed here)
const { SINCE_YEAR } = require('../config/config');

// Import core fetching logic
const { fetchContributions } = require('../api/github-api-fetchers');

// Import grouping logic
const { groupContributionsByQuarter } = require('../utils/contributions-groupers');

// Import markdown generation logic
const { writeMarkdownFiles } = require('../generators/markdown/quarterly-reports-generator');
const { createStatsReadme } = require('../generators/markdown/contributions-readme-generator');

// Import html generation logic
const { writeHtmlFiles } = require('../generators/html/quarterly-reports-html-generator');
const {
  createStatsHtmlReadme,
} = require('../generators/html/contributions-index-html-generator');
const { createHtmlReports } = require('../generators/html/contributions-report-html-generator');

async function main() {
  // Define the data directory path.
  const dataDir = 'data';
  // Ensure the data directory exists before trying to read from or write to it.
  await fs.mkdir(dataDir, { recursive: true });

  // Use the path module to correctly build the file paths.
  const cacheFile = path.join(dataDir, 'pr-cache.json');
  const dataFile = path.join(dataDir, 'all-contributions.json');

  let prCache = new Set();

  // Try to load the cache from a JSON file.
  try {
    const cacheData = await fs.readFile(cacheFile, 'utf8');
    prCache = new Set(JSON.parse(cacheData));
    console.log('Loaded PR cache from file.');
  } catch (e) {
    // Ignore 'file not found' (ENOENT); otherwise, log the error.
    if (e.code !== 'ENOENT') {
      console.error('Failed to load PR cache:', e);
    }
  }

  // Load persistent commit cache (if present) so we don't re-query PR commits repeatedly
  const commitCacheFile = path.join(dataDir, 'commit-cache.json');
  let commitCacheFromDisk = new Map();
  try {
    const commitCacheData = await fs.readFile(commitCacheFile, 'utf8');
    const parsed = JSON.parse(commitCacheData);
    // parsed expected to be an object mapping prUrlKey -> { firstCommitDate, commitCount } or null
    for (const [k, v] of Object.entries(parsed)) {
      commitCacheFromDisk.set(k, v);
    }
    console.log('Loaded commit cache from file.');
  } catch (e) {
    // Ignore 'file not found' (ENOENT); otherwise, log the error.
    if (e.code !== 'ENOENT') {
      console.error('Failed to load commit cache:', e);
    } else {
      console.log('No persistent commit cache found, starting fresh.');
    }
  }

  try {
    let allContributions = {};

    // Try to load the full contributions data from a JSON file.
    try {
      const data = await fs.readFile(dataFile, 'utf8');
      allContributions = JSON.parse(data);
      console.log('Loaded existing contributions data.');
    } catch (e) {
      // Ignore 'file not found' (ENOENT); otherwise, log the error.
      if (e.code !== 'ENOENT') {
        console.error('Failed to load contributions data:', e);
      } else {
        console.log('No existing data file found. Starting fresh.');
      }
    }

    // Determine optimal fetch strategy based on last update time
    const cacheStats = await fs.stat(dataFile).catch(() => null);
    const lastUpdate = cacheStats ? new Date(cacheStats.mtime) : null;
    const today = new Date();

    let fetchStartYear = typeof SINCE_YEAR !== 'undefined' ? SINCE_YEAR : today.getFullYear() - 1;

    if (!lastUpdate) {
      fetchStartYear = typeof SINCE_YEAR !== 'undefined' ? SINCE_YEAR : fetchStartYear;
      console.log('First run - fetching all contributions');
    } else {
      const lastUpdateYear = lastUpdate.getFullYear();
      const lastUpdateMonth = lastUpdate.getMonth();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      const sameMonth = lastUpdateMonth === currentMonth && lastUpdateYear === currentYear;
      const previousMonth =
        lastUpdateMonth === (currentMonth - 1 + 12) % 12 &&
        (lastUpdateYear === currentYear ||
          (lastUpdateYear === currentYear - 1 && currentMonth === 0));

      if (sameMonth) {
        fetchStartYear = currentYear;
        console.log('Recent update - fetching only current year');
      } else if (previousMonth) {
        fetchStartYear = currentYear - 1;
        console.log('Last month update - fetching last two years');
      } else {
        fetchStartYear = typeof SINCE_YEAR !== 'undefined' ? SINCE_YEAR : fetchStartYear;
        console.log('Older update - fetching all years');
      }
    }

    console.log(`Fetching contributions from year: ${fetchStartYear}`);

    // If there is no existing contributions data (first run / full fetch), clear
    // the persistent PR cache so authored PRs are re-processed and repopulated.
    if (!lastUpdate) {
      prCache = new Set();
      console.log(
        'No existing contributions file — clearing persistent PR cache for a full fetch.'
      );
    }

    // Merge the persistent commit cache into an in-memory Map and pass it into the fetcher
    const mergedCommitCache = new Map();
    for (const [k, v] of commitCacheFromDisk) mergedCommitCache.set(k, v);

    // Fetch new contributions and update the cache.
    const {
      contributions: newContributions,
      prCache: updatedPrCache,
      commitCache: usedCommitCache,
    } = await fetchContributions(fetchStartYear, prCache, mergedCommitCache);

    // Second pass: merge new contributions and existing ones, enforcing category hierarchy
    let finalContributions = {
      pullRequests: [],
      issues: [],
      reviewedPrs: [],
      coAuthoredPrs: [],
      collaborations: [],
    };

    // --- 1. Load Existing Contributions (Preserve categories with category hierarchy) ---
    console.log(
      'Preserving existing contributions by category (enforcing hierarchy: reviewedPrs/coAuthoredPrs > collaborations).'
    );

    const globalLoadedBy = new Map(); // url -> Set of categories

    // Load existing data from disk and allow duplication only for reviewedPrs + coAuthoredPrs combo
    const categoryOrder = Object.keys(finalContributions);
    for (const type of categoryOrder) {
      if (Array.isArray(allContributions[type])) {
        for (const item of allContributions[type]) {
          const url = item.url;
          const seen = globalLoadedBy.get(url);

          if (!seen) {
            finalContributions[type].push(item);
            globalLoadedBy.set(url, new Set([type]));
            continue;
          }

          const higherTier = new Set(['reviewedPrs', 'coAuthoredPrs']);
          const currentIsHigher = higherTier.has(type);

          // Allow higher-tier categories to be loaded even if the URL already
          // exists in `pullRequests` or `issues`. Only prevent loading
          // `collaborations` when a higher-tier category already exists.
          if (currentIsHigher) {
            finalContributions[type].push(item);
            seen.add(type);
            globalLoadedBy.set(url, seen);
          } else {
            // Non-higher types (e.g., collaborations) should only be added
            // when there are no existing higher-tier categories for the URL.
            const hasHigher = Array.from(seen).some((c) => higherTier.has(c));
            if (!hasHigher) {
              finalContributions[type].push(item);
              seen.add(type);
              globalLoadedBy.set(url, seen);
            }
          }
        }
      }
    }

    // --- 2. Add/Update Newly Fetched Contributions (with hierarchy enforcement) ---
    console.log('Merging newly fetched contributions (enforcing category hierarchy).');

    for (const type of Object.keys(newContributions)) {
      if (Array.isArray(newContributions[type])) {
        for (const item of newContributions[type]) {
          const url = item.url;

          const existingIndex = finalContributions[type].findIndex((i) => i.url === url);
          if (existingIndex !== -1) {
            finalContributions[type][existingIndex] = item;
            const s = globalLoadedBy.get(url) || new Set();
            s.add(type);
            globalLoadedBy.set(url, s);
            continue;
          }

          const seen = globalLoadedBy.get(url);
          if (!seen) {
            finalContributions[type].push(item);
            globalLoadedBy.set(url, new Set([type]));
            continue;
          }

          const higherTier = new Set(['reviewedPrs', 'coAuthoredPrs']);
          const currentIsHigher = higherTier.has(type);
          const existingInHigher = Array.from(seen).filter((c) => higherTier.has(c));

          // When promoting an item to a higher tier, only remove it from
          // `collaborations` (the true lower tier). Do NOT remove it from
          // `pullRequests` or `issues` so merged/authored PRs remain present.
          if (currentIsHigher) {
            const lowerToRemove = ['collaborations'];
            for (const lowerCat of lowerToRemove) {
              const idx = finalContributions[lowerCat].findIndex((i) => i.url === url);
              if (idx !== -1) {
                finalContributions[lowerCat].splice(idx, 1);
              }
            }

            finalContributions[type].push(item);
            // Preserve any existing higher-tier flags and add the current one.
            if (existingInHigher.length > 0) {
              for (const higherCat of existingInHigher) {
                seen.add(higherCat);
              }
            }
            seen.add(type);
            globalLoadedBy.set(url, seen);
          } else {
            // Non-higher types (like collaborations) should only be added if
            // there is no existing higher-tier representation for the URL.
            if (existingInHigher.length === 0) {
              finalContributions[type].push(item);
              seen.add(type);
              globalLoadedBy.set(url, seen);
            }
          }
        }
      }
    }

    // --- 3. Sort each category by date ---
    for (const type of Object.keys(finalContributions)) {
      finalContributions[type].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    console.log('Merged and categorized all contributions based on latest status.');

    // Save the updated, full contributions data to a new JSON file
    await fs.writeFile(dataFile, JSON.stringify(finalContributions, null, 2), 'utf8');
    console.log('Updated contributions data saved to file.');

    // --- Quarterly grouping, and Markdown and HTML generator functions ---
    // 1. Group data by quarter
    const grouped = groupContributionsByQuarter(finalContributions);

    // 2. Generate quarterly reports (Markdown)
    await writeMarkdownFiles(grouped);

    // 3. Generate quarterly reports (HTML)
    const quarterlyHtmlLinks = await writeHtmlFiles(grouped);

    // 4. Generate aggregate README (Markdown)
    await createStatsReadme(finalContributions);

    // 5. Generate aggregate README (index.html)
    await createStatsHtmlReadme(finalContributions);

    // 6. Generate reports page (HTML)
    await createHtmlReports(quarterlyHtmlLinks);

    // Save the updated PR cache to a file for future runs.
    await fs.writeFile(cacheFile, JSON.stringify(Array.from(updatedPrCache)), 'utf8');
    console.log('Updated PR cache saved to file.');

    // Persist the commit cache to disk so future runs reuse it and save API calls.
    try {
      const obj = {};
      for (const [k, v] of usedCommitCache || mergedCommitCache) {
        obj[k] = v;
      }
      await fs.writeFile(commitCacheFile, JSON.stringify(obj, null, 2), 'utf8');
      console.log('Persisted commit cache to file.');
    } catch (e) {
      console.error('Failed to persist commit cache:', e);
    }

    console.log('Contributions update completed successfully.');
  } catch (e) {
    console.error(`Failed to update contributions: ${e.message}`);
    process.exit(1);
  }
}

main();
