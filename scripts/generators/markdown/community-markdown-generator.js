const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');

/**
 * Generates the Community & Activity Markdown report.
 * @param {Object} contributions - Full contributions data
 * @param {Object} rolesData - LEADERSHIP_DATA from config
 * @param {Array} ongoingTasks - Real-time workbench tasks from fetchOngoingReviews
 */
async function createCommunityMarkdown(contributions, rolesData, ongoingTasks = []) {
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  const outputPath = path.join(mdBaseDir, 'community-activity.md');

  await fs.mkdir(mdBaseDir, { recursive: true });

  // --- 1. Build Header ---
  let md = `# Community & Activity\n\n`;
  md += `Leadership roles, major milestones, and active maintenance tasks across the Open Source ecosystem.\n\n`;

  // --- 2. Major Milestones ---
  md += `## 🏆 Major Milestones\n\n`;
  rolesData.achievements.forEach((ach) => {
    md += `* **${ach.title}** (${ach.year}) — *${ach.org}*\n`;
  });
  md += `\n`;

  // --- 3. Roles & Impact ---
  md += `## 🏗️ Roles & Impact\n\n`;
  rolesData.roles.forEach((role) => {
    const icon = role.active ? '🟢 **Active**' : '⚪ *Past*';
    md += `* ${icon} | **${role.title}** at ${role.org} (${role.period})\n`;
  });
  md += `\n`;

  // --- 4. Active Workbench ---
  // Sort tasks to match the HTML logic (Latest activity first)
  const sortedTasks = [...ongoingTasks].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  md += `## 🛠️ Active Workbench (${sortedTasks.length})\n\n`;
  md += `*A live list of open pull requests and ongoing maintenance tasks.*\n\n`;

  if (sortedTasks.length === 0) {
    md += `_No active maintenance tasks._\n`;
  } else {
    md += `| Last Activity | Repository | Status | Task |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    sortedTasks.forEach((task) => {
      // Format date to DD-MM-YYYY using task.updatedAt
      const formattedDate = (() => {
        const d = new Date(task.updatedAt);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      })();

      const repoName = task.repo.split('/')[1];

      // Use task.status for the Status column, wrapped in backticks for visibility
      const statusLabel = `\`${task.status}\``;

      // Task is the linked PR Title
      const taskLink = `[${task.title}](${task.url})`;

      md += `| ${formattedDate} | **${repoName}** | ${statusLabel} | ${taskLink} |\n`;
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
