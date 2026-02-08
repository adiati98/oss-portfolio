const fs = require('fs/promises');
const path = require('path');

// Import configuration
const { BASE_DIR, SINCE_YEAR, GITHUB_USERNAME } = require('../../config/config');

const MARKDOWN_OUTPUT_DIR_NAME = 'markdown-generated';
const MARKDOWN_README_FILENAME = 'README.md';

/**
 * Determines the contributor's persona title and description.
 */
function determinePersona(counts) {
  const { prCount, issueCount, reviewedPrCount, coAuthoredPrCount, collaborationCount } = counts;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + coAuthoredPrCount + collaborationCount;

  const personaCategories = [
    {
      title: 'Community Mentor',
      desc: 'Expert advocate for code quality and peer development. Code review and technical guidance ensure high standards across the community.',
      count: reviewedPrCount,
      priority: 1,
    },
    {
      title: 'Core Contributor',
      desc: 'Main driver of project development. Responsible for moving features from concept to production through robust code and resolving complex bugs to ensure software stability.',
      count: prCount,
      priority: 2,
    },
    {
      title: 'Project Architect',
      desc: 'Strategic problem-solver focused on technical discovery. Skilled at identifying critical system issues and defining feature planning that shapes the long-term technical roadmap.',
      count: issueCount,
      priority: 3,
    },
    {
      title: 'Collaborative Partner',
      desc: 'Focused on shared project success. Pair programming and co-authoring code delivers high-impact value through collective development effort.',
      count: coAuthoredPrCount,
      priority: 4,
    },
    {
      title: 'Ecosystem Partner',
      desc: 'Community builder focused on technical discussion and engagement. Facilitates collaboration through project discussions to ensure the open source ecosystem remains vibrant and interconnected.',
      count: collaborationCount,
      priority: 5,
    },
  ];

  if (grandTotal === 0) {
    return {
      title: 'Open Source Contributor',
      desc: 'Active member of the global open source community.',
    };
  }

  return personaCategories.reduce((prev, curr) => {
    if (curr.count > prev.count) return curr;
    if (curr.count === prev.count && curr.priority < prev.priority) return curr;
    return prev;
  });
}

/**
 * Helper: Generates a Unicode progress bar string using Squares
 */
function generateProgressBar(count, total, width) {
  const filledChar = '■';
  const emptyChar = '□';
  if (total === 0) return emptyChar.repeat(width);
  const percent = count / total;
  const filledCount = Math.round(percent * width);
  const emptyCount = width - filledCount;
  return filledChar.repeat(Math.max(0, filledCount)) + emptyChar.repeat(Math.max(0, emptyCount));
}

/**
 * Calculates aggregate totals from all contribution data and writes the
 * contributions/README.md file.
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

  const maxCount = Math.max(
    prCount,
    issueCount,
    reviewedPrCount,
    collaborationCount,
    coAuthoredPrCount
  );

  // 2. Persona Logic
  const { title: personaTitle, desc: personaDesc } = determinePersona({
    prCount,
    issueCount,
    reviewedPrCount,
    coAuthoredPrCount,
    collaborationCount,
  });

  const lowerDesc = personaDesc.charAt(0).toLowerCase() + personaDesc.slice(1);
  const firstLetter = lowerDesc.charAt(0);
  // Capitalized article for sentence start
  const article = ['a', 'e', 'i', 'o', 'u'].includes(firstLetter) ? 'An' : 'A';

  // 3. Stats Helper (handles bolding of max values)
  const getStats = (count) => {
    const BAR_WIDTH = 30;
    if (grandTotal === 0)
      return { pct: '0.0%', count: '0', bar: generateProgressBar(0, 0, BAR_WIDTH) };

    const pctVal = (count / grandTotal) * 100;
    const isMax = count === maxCount && count > 0;
    const pctStr = pctVal.toFixed(1) + '%';

    return {
      pct: isMax ? `**${pctStr}**` : pctStr,
      count: isMax ? `**${count}**` : count,
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

  // 4. Aggregate Repository Activity
  const allItems = [
    ...finalContributions.pullRequests,
    ...finalContributions.issues,
    ...finalContributions.reviewedPrs,
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...finalContributions.collaborations,
  ];

  const totalUniqueRepos = new Set(allItems.map((item) => item.repo)).size;

  const repoActivity = allItems.reduce((acc, item) => {
    acc[item.repo] = (acc[item.repo] || 0) + 1;
    return acc;
  }, {});

  const topThreeRepos = Object.entries(repoActivity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const topReposMarkdown =
    topThreeRepos.length > 0
      ? topThreeRepos
          .map(([repo, count], idx) => {
            const rank = idx + 1;
            return `${rank}. [**${repo}**](https://github.com/${repo}) (${count} contributions)`;
          })
          .join('\n')
      : '_No activity recorded yet._';

  // 5. Metadata
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearsTracked = currentYear - SINCE_YEAR + 1;
  const generatedAt = now.toLocaleString();

  // 6. Generate Quarterly Links (Newest First)
  let reportLinksContent = '## 📂 Detailed Quarterly Reports\n\n';
  try {
    const files = await fs.readdir(markdownBaseDir);
    const years = files.filter((f) => /^\d{4}$/.test(f)).sort((a, b) => b - a);

    if (years.length === 0) {
      reportLinksContent += '_No detailed reports generated yet._\n';
    } else {
      for (const year of years) {
        const yearDir = path.join(markdownBaseDir, year);
        const quarters = (await fs.readdir(yearDir))
          .filter((f) => /^Q\d-\d{4}\.md$/.test(f))
          .sort((a, b) => b.localeCompare(a));

        if (quarters.length > 0) {
          reportLinksContent += `### ${year}\n`;
          quarters.forEach((qFile) => {
            const qName = qFile.replace('.md', '');
            reportLinksContent += `* [${qName}](./${year}/${qFile})\n`;
          });
          reportLinksContent += '\n';
        }
      }
    }
  } catch (err) {
    reportLinksContent += '_No detailed reports found._\n';
  }

  // 7. Build Markdown Content
  let markdownContent = `# 📈 Open Source Contributions Report

Organized by calendar quarter, these reports track [**${GITHUB_USERNAME}**](https://github.com/${GITHUB_USERNAME})'s external open source involvement since **${SINCE_YEAR}**. This portfolio aggregates key community activities across Merged PRs, Issues, Reviewed PRs, Co-Authored PRs, and general Collaborations.

---

## 📊 All-Time Impact Summary

### 🚀 Total Contributions: **${grandTotal}**

| Context | Detail |
| :--- | :--- |
| 🏗️ **Unique Repositories** | **${totalUniqueRepos}** projects |
| 📅 **Active Since** | **${SINCE_YEAR}** (${yearsTracked} years tracked) |

### 🧩 Contribution Distribution

| Category | Progress | Count | Percentage |
| :--- | :--- | :--- | :--- |
| **Merged PRs** | \`${stats.prs.bar}\` | ${stats.prs.count} | ${stats.prs.pct} |
| **Issues** | \`${stats.issues.bar}\` | ${stats.issues.count} | ${stats.issues.pct} |
| **Reviewed PRs** | \`${stats.reviews.bar}\` | ${stats.reviews.count} | ${stats.reviews.pct} |
| **Co-Authored PRs** | \`${stats.coauth.bar}\` | ${stats.coauth.count} | ${stats.coauth.pct} |
| **Collaborations** | \`${stats.collab.bar}\` | ${stats.collab.count} | ${stats.collab.pct} |

### 🎯 Primary Focus Projects

${topReposMarkdown}

### 🎭 Collaboration Profile: ${personaTitle}

${article} ${lowerDesc}

---

## 🛠️ Report Structure Breakdown

Each quarterly report file (\`Qx-YYYY.md\` inside the year folders) provides a detailed log and summary for that period. Use the table below to understand the metrics tracked in those reports:

| Section | Description | Key Metric Tracked |
| :--- | :--- | :--- |
| **Quarterly Statistics** | A high-level summary showing the **Total Contributions** and **Total Repositories** involved in during the quarter. | Total Count, Unique Repositories |
| **Contribution Breakdown** | A table listing the count of contributions for each of the five core categories within that quarter. | Category Counts |
| **Top 3 Repositories** | The top three projects where contributions were made in that quarter, ranked by total count. | Contribution Frequency |
| **Merged PRs** | **(Collapsible Section)** Detailed list of Pull Requests **authored by me** and merged into external repositories. | **Review Period** |
| **Issues** | **(Collapsible Section)** Detailed list of Issues **authored by me** on external repositories. | **Closing Period** |
| **Reviewed PRs** | **(Collapsible Section)** Detailed list of Pull Requests **reviewed or merged by me** on external repositories. | **My First Review Period** |
| **Co-Authored PRs** | **(Collapsible Section)** Pull Requests where **I contributed commits** to other contributor's PRs. | **My First Commit Period** |
| **Collaborations** | **(Collapsible Section)** Detailed list of open Issues or PRs where I have **commented** to participate in discussion. | **First Commented At** |

---

${reportLinksContent}

---
*Report last generated on: ${generatedAt}*
`;

  // 8. Write the file
  await fs.writeFile(MARKDOWN_OUTPUT_PATH, markdownContent, 'utf8');
  console.log(`Written aggregate README: ${MARKDOWN_OUTPUT_PATH}`);
}

module.exports = {
  createStatsReadme,
};
