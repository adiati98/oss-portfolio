const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');

/**
 * Generates the Community & Activity Markdown report.
 * @param {Object} contributions - Full contributions data
 * @param {Object} rolesData - LEADERSHIP_DATA from config
 * @param {Array} ongoingTasks - Real-time workbench tasks
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
  md += `## 🛠️ Active Workbench\n\n`;
  md += `*A live list of open pull requests and ongoing maintenance tasks.*\n\n`;

  // Filter and sort by layers
  const requestReviewTasks = ongoingTasks
    .filter((t) => t.status === 'Request review')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const ongoingReviewTasks = ongoingTasks
    .filter((t) => t.status === 'Under review')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  /**
   * Helper function to build a collapsible table section.
   * Uses <details> for toggling visibility.
   */
  const buildCollapsibleSection = (title, icon, tasks) => {
    const count = tasks.length;
    // Section is open by default if it contains tasks
    let section = `<details ${count > 0 ? 'open' : ''}>\n`;
    section += `<summary><b>${icon} ${title} (${count})</b></summary>\n\n`;

    if (count === 0) {
      section += `_No tasks in this category._\n\n`;
    } else {
      // Table with only Repository and Task (Date and Status removed)
      section += `| Repository | Task |\n`;
      section += `| :--- | :--- |\n`;
      tasks.forEach((task) => {
        const repoName = task.repo.split('/')[1] || task.repo;
        const taskLink = `[${task.title}](${task.url})`;
        section += `| **${repoName}** | ${taskLink} |\n`;
      });
      section += `\n`;
    }

    section += `</details>\n\n`;
    return section;
  };

  // Layer 1: Request review
  md += buildCollapsibleSection('Request review', '📥', requestReviewTasks);

  // Layer 2: Ongoing review (Renamed from "Under review")
  md += buildCollapsibleSection('Ongoing review', '🔄', ongoingReviewTasks);

  md += `---\n`;
  md += `*Last updated: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}*\n`;

  await fs.writeFile(outputPath, md.trim() + '\n', 'utf8');
  console.log(`Generated community Markdown report at ${outputPath}`);
}

module.exports = { createCommunityMarkdown };
