const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');
const { WORKBENCH_SUCCESS_MESSAGES } = require('../../metadata/workbench-messages');

/**
 * Helper to render status labels as HTML badges.
 */
function getStatusBadge(task) {
  if (!task.labels && !task.isDraft) return '';

  const labels = (task.labels || []).map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
  const isDraft = task.isDraft === true;
  const isPendingMerge = task.isApproved && labels.includes('pending-pr-merge');
  const isBlocked =
    !isPendingMerge &&
    labels.some((l) => l.includes('blocked') || l.includes('stalled') || l.includes('wait'));

  let badge = '';
  const baseStyle =
    'padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 8px; color: white; vertical-align: middle; display: inline-block;';

  if (isDraft) {
    badge = `<span style='${baseStyle} background-color: #64748b;'>DRAFT</span>`;
  } else if (isPendingMerge) {
    badge = `<span style='${baseStyle} background-color: #10b981;'>PENDING MERGE</span>`;
  } else if (isBlocked) {
    badge = `<span style='${baseStyle} background-color: #f43f5e;'>BLOCKED</span>`;
  }

  return badge;
}

/**
 * Generates the Community & Activity Markdown report.
 */
async function createCommunityMarkdown(
  contributions,
  rolesData,
  ongoingTasks = [],
  ongoingIssues = [],
  ongoingPRs = []
) {
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

  // --- Filtering Logic ---
  const isBot = (t) => {
    const username = typeof t.user === 'object' ? t.user?.login : t.user;
    const userStr = String(username || '').toLowerCase();
    const titleStr = String(t.title || '').toLowerCase();
    return (
      userStr.includes('dependabot') ||
      titleStr.startsWith('[snyk]') ||
      (titleStr.startsWith('bump') && userStr.includes('dependabot'))
    );
  };

  const todoTasks = ongoingIssues.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const submittedPRs = ongoingPRs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const requestReviewTasks = ongoingTasks
    .filter((t) => t.status === 'Request review' && !isBot(t))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const inProgressTasks = ongoingTasks
    .filter((t) => t.status === 'Review in progress')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const botRequestReviewTasks = ongoingTasks
    .filter((t) => t.status === 'Request review' && isBot(t))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  /**
   * Helper function to build a collapsible HTML table section.
   */
  const buildCollapsibleSection = (title, icon, tasks) => {
    const count = tasks.length;
    const randomMsg =
      WORKBENCH_SUCCESS_MESSAGES[Math.floor(Math.random() * WORKBENCH_SUCCESS_MESSAGES.length)];

    let section = `<details>\n`;
    section += `  <summary><h3 style="display: inline-block; padding-bottom: 20px; cursor: pointer; margin: 0;">${icon} ${title} (${count})</h3></summary>\n\n`;

    if (count === 0) {
      section += `> ***${randomMsg}***\n`;
    } else {
      section += `<table style='width:100%; table-layout:fixed;'>\n`;
      section += `  <thead>\n    <tr>\n`;
      section += `      <th style='width:25%; text-align:left;'>Repository</th>\n`;
      section += `      <th style='width:75%; text-align:left;'>Task</th>\n`;
      section += `    </tr>\n  </thead>\n  <tbody>\n`;

      tasks.forEach((task) => {
        const repoName = task.repo.split('/')[1] || task.repo;
        const statusBadge = getStatusBadge(task);

        section += `    <tr>\n`;
        section += `      <td style='vertical-align: top;'><strong>${repoName}</strong><br />${statusBadge}</td>\n`;
        section += `      <td style='vertical-align: top;'><a href='${task.url}'>${task.title}</a></td>\n`;
        section += `    </tr>\n`;
      });

      section += `  </tbody>\n</table>\n`;
    }

    section += `\n</details>\n\n`;
    return section;
  };

  // --- Render Sections ---
  md += buildCollapsibleSection('Ongoing PRs', '📤', submittedPRs);
  md += buildCollapsibleSection('Review in progress', '🔄', inProgressTasks);
  md += buildCollapsibleSection('To do issues', '📝', todoTasks);
  md += buildCollapsibleSection('Request review', '📥', requestReviewTasks);
  md += buildCollapsibleSection('Bot request review', '🤖', botRequestReviewTasks);

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
