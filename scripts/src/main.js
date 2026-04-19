const path = require('path');
const fs = require('fs/promises');

// Import configuration
const { BLOG } = require('../config/config');

// Import Leadership Metadata
const leadershipData = require('../../contents/leadership');

// Import Repository Exclusions with safeguard
let excludedRepos = [];
try {
  const repoExclusions = require('../../contents/repo-exclusions');
  excludedRepos = repoExclusions.excludedRepos || [];
} catch (e) {
  // If the file doesn't exist, we proceed with an empty exclusion list
}

// Import core fetching logic
const {
  fetchContributions,
  fetchOngoingReviews,
  fetchOngoingIssues
} = require('../api/github-api-fetchers');
const { fetchStrictOssArticles } = require('../api/articles-api-fetcher');

// Import grouping logic
const { groupContributionsByQuarter } = require('../utils/contributions-groupers');

// Import markdown generation logic
const { writeMarkdownFiles } = require('../generators/markdown/quarterly-reports-generator');
const { createStatsReadme } = require('../generators/markdown/contributions-readme-generator');
const { writeArticlesMarkdown } = require('../generators/markdown/blog-markdown-generator');
const { createCommunityMarkdown } = require('../generators/markdown/community-markdown-generator');

// Import html generation logic
const { writeHtmlFiles } = require('../generators/html/quarterly-reports-html-generator');
const { createHtmlReports } = require('../generators/html/contributions-report-html-generator');
const { createIndexHtml } = require('../generators/html/landing-page-html-generator');
const { createBlogHtml } = require('../generators/html/blog-html-generator');
const { createCommunityHtml } = require('../generators/html/community-html-generator');
const { createGlossaryHtml } = require('../generators/html/glossary-html-generator');

async function main() {
  // Define the data directory path.
  const dataDir = 'data';
  // Ensure the data directory exists before trying to read from or write to it.
  await fs.mkdir(dataDir, { recursive: true });

  // Use the path module to correctly build the file paths.
  const cacheFile = path.join(dataDir, 'pr-cache.json');
  const dataFile = path.join(dataDir, 'all-contributions.json');
  const articlesFile = path.join(dataDir, 'all-articles.json');
  const ongoingTasksFile = path.join(dataDir, 'ongoing-tasks.json');
  const ongoingIssuesFile = path.join(dataDir, 'ongoing-issues.json');

  let prCache = new Set();

  // Try to load the cache from a JSON file.
  try {
    const cacheData = await fs.readFile(cacheFile, 'utf8');
    prCache = new Set(JSON.parse(cacheData));
    console.log('Loaded PR cache from file.');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Failed to load PR cache:', e);
    }
  }

  // Load persistent commit cache
  const commitCacheFile = path.join(dataDir, 'commit-cache.json');
  let commitCacheFromDisk = new Map();
  try {
    const commitCacheData = await fs.readFile(commitCacheFile, 'utf8');
    const parsed = JSON.parse(commitCacheData);
    for (const [k, v] of Object.entries(parsed)) {
      commitCacheFromDisk.set(k, v);
    }
    console.log('Loaded commit cache from file.');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Failed to load commit cache:', e);
    } else {
      console.log('No persistent commit cache found, starting fresh.');
    }
  }

  try {
    // --- Fetch Ongoing Reviews (Workbench) ---
    console.log('Fetching ongoing review tasks for the Active Workbench...');
    const rawOngoingTasks = await fetchOngoingReviews();

    const ongoingTasks = rawOngoingTasks.filter((task) => {
      const repoName = task.repo.toLowerCase();
      // Dynamically exclude repos based on the exclusions list
      const isExcluded = excludedRepos.some((excluded) =>
        repoName.includes(excluded.toLowerCase())
      );
      return !isExcluded;
    });

    await fs.writeFile(ongoingTasksFile, JSON.stringify(ongoingTasks, null, 2), 'utf8');
    console.log(
      `Saved ${ongoingTasks.length} ongoing tasks to ${ongoingTasksFile} (after exclusions).`
    );

    // --- Fetch Ongoing Issues (Assigned to you) ---
    console.log('Fetching ongoing issues for the Active Workbench...');
    const rawOngoingIssues = await fetchOngoingIssues();

    const ongoingIssues = rawOngoingIssues.filter((issue) => {
      const repoName = issue.repo.toLowerCase();
      const isExcluded = excludedRepos.some((excluded) =>
        repoName.includes(excluded.toLowerCase())
      );
      return !isExcluded;
    });

    await fs.writeFile(ongoingIssuesFile, JSON.stringify(ongoingIssues, null, 2), 'utf8');
    console.log(`Saved ${ongoingIssues.length} ongoing issues to ${ongoingIssuesFile}.`);

    // --- Fetch Articles ---
    console.log('Fetching Open Source Software articles from external platforms...');
    const articles = await fetchStrictOssArticles();
    await fs.writeFile(articlesFile, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`Saved ${articles.length} articles to ${articlesFile}`);

    let allContributions = {};

    try {
      const data = await fs.readFile(dataFile, 'utf8');
      allContributions = JSON.parse(data);
      console.log('Loaded existing contributions data.');
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('Failed to load contributions data:', e);
      } else {
        console.log('No existing data file found. Starting fresh.');
      }
    }

    const cacheStats = await fs.stat(dataFile).catch(() => null);
    const lastUpdate = cacheStats ? new Date(cacheStats.mtime) : null;
    const today = new Date();

    let fetchStartYear;

    if (!lastUpdate) {
      fetchStartYear = undefined;
      console.log('First run - triggering auto-discovery of GitHub join date');
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
        fetchStartYear = lastUpdateYear - 1;
        console.log(`Older update - fetching from: ${fetchStartYear}`);
      }
    }

    if (!lastUpdate) {
      prCache = new Set();
      console.log(
        'No existing contributions file — clearing persistent PR cache for a full fetch.'
      );
    }

    const mergedCommitCache = new Map();
    for (const [k, v] of commitCacheFromDisk) mergedCommitCache.set(k, v);

    const {
      contributions: newContributions,
      prCache: updatedPrCache,
      commitCache: usedCommitCache,
    } = await fetchContributions(fetchStartYear, prCache, mergedCommitCache);

    let finalContributions = {
      pullRequests: [],
      issues: [],
      reviewedPrs: [],
      coAuthoredPrs: [],
      collaborations: [],
    };

    console.log(
      'Preserving existing contributions by category (enforcing hierarchy: reviewedPrs/coAuthoredPrs > collaborations).'
    );

    const globalLoadedBy = new Map();

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

          if (currentIsHigher) {
            finalContributions[type].push(item);
            seen.add(type);
            globalLoadedBy.set(url, seen);
          } else {
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

          if (currentIsHigher) {
            const lowerToRemove = ['collaborations'];
            for (const lowerCat of lowerToRemove) {
              const idx = finalContributions[lowerCat].findIndex((i) => i.url === url);
              if (idx !== -1) {
                finalContributions[lowerCat].splice(idx, 1);
              }
            }

            finalContributions[type].push(item);
            if (existingInHigher.length > 0) {
              for (const higherCat of existingInHigher) {
                seen.add(higherCat);
              }
            }
            seen.add(type);
            globalLoadedBy.set(url, seen);
          } else {
            if (existingInHigher.length === 0) {
              finalContributions[type].push(item);
              seen.add(type);
              globalLoadedBy.set(url, seen);
            }
          }
        }
      }
    }

    for (const type of Object.keys(finalContributions)) {
      finalContributions[type].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    console.log('Merged and categorized all contributions based on latest status.');

    await fs.writeFile(dataFile, JSON.stringify(finalContributions, null, 2), 'utf8');
    console.log('Updated contributions data saved to file.');

    // --- Quarterly grouping, and Markdown and HTML generator functions ---
    const grouped = groupContributionsByQuarter(finalContributions);

    // 1. Generate quarterly reports (Markdown)
    await writeMarkdownFiles(grouped);

    // 2. Generate quarterly reports (HTML)
    const quarterlyHtmlLinks = await writeHtmlFiles(grouped);

    // 3. Generate README and glossary files (Markdown)
    await createStatsReadme(finalContributions, articles);

    // 4. Generate landing page (index.html)
    console.log('Generating landing page...');
    await createIndexHtml(finalContributions, articles);

    // 5. Generate the Glossary page
    console.log('Generating Glossary...');
    await createGlossaryHtml();

    // 6. Generate reports page (HTML)
    await createHtmlReports(quarterlyHtmlLinks);

    // 7. Generate Blog Reports (HTML and Markdown)
    await createBlogHtml(articles);
    await writeArticlesMarkdown(articles);

    // 8. Generate Community & Activity Reports
    console.log('Generating Community & Activity reports...');
    await createCommunityHtml(finalContributions, leadershipData, ongoingTasks, ongoingIssues);
    await createCommunityMarkdown(finalContributions, leadershipData, ongoingTasks, ongoingIssues);

    // Save the updated PR cache to a file for future runs.
    await fs.writeFile(cacheFile, JSON.stringify(Array.from(updatedPrCache)), 'utf8');
    console.log('Updated PR cache saved to file.');

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
