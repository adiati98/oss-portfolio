const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR, GITHUB_USERNAME } = require('../../config/config');
const { GLOSSARY_CONTENT } = require('../../../metadata/glossary');
const { personaCategories, DEFAULT_PERSONA } = require('../../../metadata/personas');

const MARKDOWN_OUTPUT_DIR_NAME = 'markdown-generated';
const MARKDOWN_README_FILENAME = 'README.md';
const MARKDOWN_GLOSSARY_FILENAME = 'glossary.md';

/**
 * Determines the contributor's persona title and description.
 */
function determinePersona(counts) {
  const { prCount, issueCount, reviewedPrCount, coAuthoredPrCount, collaborationCount } = counts;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + coAuthoredPrCount + collaborationCount;

  if (grandTotal === 0) {
    return DEFAULT_PERSONA;
  }

  // Map the dynamic counts to the static metadata categories imported from personas.js
  const categoriesWithCounts = [
    { ...personaCategories.find((p) => p.title === 'Community Mentor'), count: reviewedPrCount },
    { ...personaCategories.find((p) => p.title === 'Core Contributor'), count: prCount },
    { ...personaCategories.find((p) => p.title === 'Project Architect'), count: issueCount },
    {
      ...personaCategories.find((p) => p.title === 'Collaborative Partner'),
      count: coAuthoredPrCount,
    },
    {
      ...personaCategories.find((p) => p.title === 'Ecosystem Partner'),
      count: collaborationCount,
    },
  ];

  return categoriesWithCounts.reduce((prev, curr) => {
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

async function createStatsReadme(finalContributions, articles = []) {
  const markdownBaseDir = path.join(BASE_DIR, MARKDOWN_OUTPUT_DIR_NAME);
  const README_PATH = path.join(markdownBaseDir, MARKDOWN_README_FILENAME);
  const GLOSSARY_PATH = path.join(markdownBaseDir, MARKDOWN_GLOSSARY_FILENAME);

  await fs.mkdir(markdownBaseDir, { recursive: true });

  // 1. Calculate Totals
  const prCount = finalContributions.pullRequests.length;
  const issueCount = finalContributions.issues.length;
  const reviewedPrCount = finalContributions.reviewedPrs.length;
  const collaborationCount = finalContributions.collaborations.length;
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const articleCount = articles.length || 0;

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
  const article = ['a', 'e', 'i', 'o', 'u'].includes(firstLetter) ? 'An' : 'A';

  // 3. Stats Helper
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
    ...(finalContributions.pullRequests || []),
    ...(finalContributions.issues || []),
    ...(finalContributions.reviewedPrs || []),
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...(finalContributions.collaborations || []),
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

  // 5. Dynamic year calculation (Safeguarded)
  const now = new Date();
  const currentYear = now.getFullYear();

  const yearsActive = allItems
    .map((item) => new Date(item.date).getFullYear())
    .filter((year) => !isNaN(year) && year >= 2008);

  const earliestYear = yearsActive.length > 0 ? Math.min(...yearsActive) : currentYear;
  const yearsTracked = currentYear - earliestYear + 1;
  const generatedAt = now.toLocaleString();

  // 6. Generate Quarterly Links
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

  // 7. BUILD glossary.md CONTENT
  const personalize = (text) => text.replace(/{{GITHUB_USERNAME}}/g, GITHUB_USERNAME);
  const groups = GLOSSARY_CONTENT?.sections || [];

  let glossarySectionsMd = '';

  groups.forEach((group) => {
    let noteHeader = 'Glossary Note';
    const hasEntryMethod = group.items.some((i) => i.entryMethod);
    const hasCalculation = group.items.some((i) => i.howItIsCalculated);
    const hasSource = group.items.some((i) => i.source);

    if (hasEntryMethod) noteHeader = 'Entry Method';
    else if (hasCalculation) noteHeader = 'Calculation Logic';
    else if (hasSource) noteHeader = 'Data Source';

    glossarySectionsMd += `## ${group.title}\n\n`;
    glossarySectionsMd += `_${personalize(group.description)}_\n\n`;
    glossarySectionsMd += `| Metric | Description | ${noteHeader} |\n`;
    glossarySectionsMd += `| :--- | :--- | :--- |\n`;

    group.items.forEach((item) => {
      const note = item.entryMethod || item.howItIsCalculated || item.source || '';
      glossarySectionsMd += `| **${item.title}** | ${personalize(item.description)} | ${personalize(note)} |\n`;
    });

    glossarySectionsMd += '\n';
  });

  const glossaryContent = `# 📖 Glossary

${personalize(GLOSSARY_CONTENT?.subtitle || 'Glossary details for contribution tracking.')}

${glossarySectionsMd}
---
[← Back to Summary](./${MARKDOWN_README_FILENAME}) | *Last updated: ${generatedAt}*
`;

  // 8. Build Markdown Content for README.md
  let markdownContent = `# 📈 Open Source Contributions Report

Organized by year and quarter, these reports track contributions made by **[${GITHUB_USERNAME}](https://github.com/${GITHUB_USERNAME})** to external repositories since **${earliestYear}**. This portfolio summarizes all community activity—including merged, reviewed, and co-authored PRs, issues, and collaborations—alongside formal leadership roles, blog posts, and live tasks on the active workbench.

> [!IMPORTANT]
> To understand the criteria used for these metrics or to see how specific categories are calculated, please refer to the [**Glossary**](./${MARKDOWN_GLOSSARY_FILENAME}).

---

## 📊 All-Time Impact Summary

### 🚀 Total Contributions: **${grandTotal}**

| Context | Detail |
| :--- | :--- |
| 🏗️ **Unique Repositories** | **${totalUniqueRepos}** projects |
| 📅 **Active Since** | **${earliestYear}** (${yearsTracked} years tracked) |
| ✍️ **Articles Written** | **${articleCount}** published articles |

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

## 🏛️ Ecosystem Engagement

Beyond code contributions, I maintain active roles in community leadership and technical content creation around open source.

* ✍️ **Technical Writing:** [**View full articles list (${articleCount})**](./blog.md)
* 🏗️ **Roles & Impact:** [**View community leadership & activity**](./community-activity.md)

---

${reportLinksContent}

---
*Report last generated on: ${generatedAt}*
`;

  // 9. Write the files
  await fs.writeFile(README_PATH, markdownContent, 'utf8');
  await fs.writeFile(GLOSSARY_PATH, glossaryContent, 'utf8');

  console.log(`Written aggregate README: ${README_PATH}`);
  console.log(`Written glossary markdown: ${GLOSSARY_PATH}`);
}

module.exports = {
  createStatsReadme,
};
