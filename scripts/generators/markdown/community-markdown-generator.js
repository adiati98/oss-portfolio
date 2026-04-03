const fs = require('fs/promises');
const path = require('path');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');

/**
 * Generates the Community & Activity Markdown report.
 * @param {Object} contributions - Full contributions data
 * @param {Object} rolesData - LEADERSHIP_DATA from config
 */
async function createCommunityMarkdown(contributions, rolesData) {
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  const outputPath = path.join(mdBaseDir, 'community-activity.md');

  await fs.mkdir(mdBaseDir, { recursive: true });

  // --- WORKBENCH LOGIC: Strictly Reviewed PRs ---
  const { reviewedPrs = [] } = contributions;

  const activeReviews = reviewedPrs
    .filter((pr) => (pr.state || '').toLowerCase() === 'open')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // 1. Build Header
  let md = `# Community & Activity\n\n`;
  md += `Leadership roles, major milestones, and active maintenance tasks across the Open Source ecosystem.\n\n`;

  // 2. Major Milestones
  md += `## 🏆 Major Milestones\n\n`;
  rolesData.achievements.forEach((ach) => {
    md += `* **${ach.title}** (${ach.year}) — *${ach.org}*\n`;
  });
  md += `\n`;

  // 3. Roles & Impact
  md += `## 🏗️ Roles & Impact\n\n`;
  rolesData.roles.forEach((role) => {
    const icon = role.active ? '🟢 **Active**' : '⚪ *Past*';
    md += `* ${icon} | **${role.title}** at ${role.org} (${role.period})\n`;
  });
  md += `\n`;

  // 4. Active Workbench
  md += `## 🛠️ Active Workbench (${activeReviews.length})\n\n`;
  md += `*A live list of open pull requests and ongoing maintenance tasks.*\n\n`;

  if (activeReviews.length === 0) {
    md += `_No active maintenance tasks._\n`;
  } else {
    // Table format for cleaner workbench view in Markdown
    md += `| Year | Repository | Task |\n`;
    md += `| :--- | :--- | :--- |\n`;
    activeReviews.forEach((pr) => {
      const year = new Date(pr.date).getFullYear();
      const repoName = pr.repo.split('/')[1];
      const isDraft = (pr.status || pr.state || '').toLowerCase() === 'draft';
      const draftLabel = isDraft ? '`Draft` ' : '';
      const typeLabel = '`To Review` ';

      md += `| ${year} | **${repoName}** | ${typeLabel}${draftLabel}[${pr.title}](${pr.url}) |\n`;
    });
  }

  md += `\n---\n`;
  md += `*Last updated: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}*\n`;

  await fs.writeFile(outputPath, md.trim() + '\n', 'utf8');
  console.log(`Generated community Markdown report at ${outputPath}`);
}

module.exports = { createCommunityMarkdown };
