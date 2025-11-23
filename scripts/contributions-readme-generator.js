const fs = require('fs/promises');
const path = require('path');

// Import configuration
const { BASE_DIR, SINCE_YEAR, GITHUB_USERNAME } = require('./config');

const MARKDOWN_OUTPUT_DIR_NAME = 'markdown-generated';
const MARKDOWN_README_FILENAME = 'README.md';

/**
 * Helper: Generates a Unicode progress bar string using Squares
 * Example: ■■■■■■■□□□□□
 */
function generateProgressBar(count, total, width) {
  const filledChar = '■';
  const emptyChar = '□';

  if (total === 0) return emptyChar.repeat(width);

  const percent = count / total;
  const filledCount = Math.round(percent * width);
  const emptyCount = width - filledCount;

  // Safety check to prevent negative repeats
  const safeFilled = Math.max(0, filledCount);
  const safeEmpty = Math.max(0, emptyCount);

  return filledChar.repeat(safeFilled) + emptyChar.repeat(safeEmpty);
}

/**
 * Calculates aggregate totals from all contribution data and writes the
 * contributions/README.md file.
 * @param {object} finalContributions The object with all contributions, grouped by type.
 */
async function createStatsReadme(finalContributions) {
  const markdownBaseDir = path.join(BASE_DIR, MARKDOWN_OUTPUT_DIR_NAME);
  const MARKDOWN_OUTPUT_PATH = path.join(markdownBaseDir, MARKDOWN_README_FILENAME);

  await fs.mkdir(markdownBaseDir, { recursive: true });

  // 1. Calculate Totals
  const prCount = finalContributions.pullRequests.length;
  const issueCount = finalContributions.issues.length;
  const reviewedPrCount = finalContributions.reviewedPrs.length;
  const collaborationCount = finalContributions.collaborations.length;
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;

  // --- HELPER: Calculate Stats for display ---
  const getStats = (count) => {
    // Width of 30 ensures that small differences (like 100 items) are visible
    const BAR_WIDTH = 30;

    if (grandTotal === 0) return { pct: '0.0%', bar: generateProgressBar(0, 0, BAR_WIDTH) };

    const pct = (count / grandTotal) * 100;
    return {
      pct: pct.toFixed(1) + '%',
      bar: generateProgressBar(count, grandTotal, BAR_WIDTH),
    };
  };

  const stats = {
    prs: getStats(prCount),
    issues: getStats(issueCount),
    reviews: getStats(reviewedPrCount),
    coauth: getStats(coAuthoredPrCount),
    collab: getStats(collaborationCount),
  };

  // 2. Calculate Unique Repositories
  const allItems = [
    ...finalContributions.pullRequests,
    ...finalContributions.issues,
    ...finalContributions.reviewedPrs,
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...finalContributions.collaborations,
  ];
  const uniqueRepos = new Set(allItems.map((item) => item.repo));
  const totalUniqueRepos = uniqueRepos.size;

  // 3. Calculate Years Tracked
  const currentYear = new Date().getFullYear();
  const yearsTracked = currentYear - SINCE_YEAR + 1;

  // 4. Build Markdown Content
  let markdownContent = `# 📈 Open Source Contributions Report

Organized by calendar quarter, these reports track [**${GITHUB_USERNAME}**](https://github.com/${GITHUB_USERNAME})'s external open source involvement, aggregating key community activities across **Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations**.

---

## Report Structure Breakdown

Each quarterly report file (\`Qx-YYYY.md\` inside the year folders) provides a detailed log and summary for that period:

| Section | Description | Key Metric Tracked |
| :--- | :--- | :--- |
| **Quarterly Statistics** | A high-level summary showing the **Total Contributions** and **Total Repositories** involved in during the quarter. | Total Count, Unique Repositories |
| **Contribution Breakdown** | A table listing the count of contributions for each of the five core categories within that quarter. | Category Counts |
| **Top 3 Repositories** | The top three projects where contributions were made in that quarter, ranked by total count. | Contribution Frequency |
| **Merged PRs** | **(Collapsible Section)** Detailed list of Pull Requests **authored by me** and merged into external repositories. | **Review Period** (Time from creation to merge) |
| **Issues** | **(Collapsible Section)** Detailed list of Issues **authored by me** on external repositories. | **Closing Period** (Time from creation to close) |
| **Reviewed PRs** | **(Collapsible Section)** Detailed list of Pull Requests **reviewed or merged by me** on external repositories. | **My First Review Period** (Time from PR creation to my first review) |
| **Co-Authored PRs** | **(Collapsible Section)** Pull Requests where **I contributed commits (including co-authored commits)** to other contributor's PRs. | **My First Commit Period** (Time from PR creation to my first commit) |
| **Collaborations** | **(Collapsible Section)** Detailed list of open Issues or PRs where I have **commented** to participate in discussion. | **First Commented At** (The date of my initial comment) |

---

## All-Time Aggregate Contribution Summary

This is a summary of all contributions fetched since the initial tracking year (**${SINCE_YEAR}**), providing a quick overview of the portfolio's scale.

### Overall Counts

**Total Contributions:** 🚀 **${grandTotal}**

| Category | Contributions | Count | Percentage |
| :--- | :--- | :--- | :--- |
| **Merged PRs** | \`${stats.prs.bar}\` | ${prCount} | ${stats.prs.pct} |
| **Issues** | \`${stats.issues.bar}\` | ${issueCount} | ${stats.issues.pct} |
| **Reviewed PRs** | \`${stats.reviews.bar}\` | ${reviewedPrCount} | ${stats.reviews.pct} |
| **Co-Authored PRs** | \`${stats.coauth.bar}\` | ${coAuthoredPrCount} | ${stats.coauth.pct} |
| **Collaborations** | \`${stats.collab.bar}\` | ${collaborationCount} | ${stats.collab.pct} |

### Repository Summary

| Category | Total |
| :--- | :--- |
| **Unique Repositories** | ${totalUniqueRepos} |
| **Years Tracked** | ${yearsTracked} |

`;

  // 5. Write the file
  await fs.writeFile(MARKDOWN_OUTPUT_PATH, markdownContent, 'utf8');
  console.log(`Written aggregate README: ${MARKDOWN_OUTPUT_PATH}`);
}

module.exports = {
  createStatsReadme,
};
