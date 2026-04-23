const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');
const { WORKBENCH_SUCCESS_MESSAGES } = require('../../metadata/workbench-messages');

/**
 * Helper to render status labels as HTML badges.
 */
function getStatusBadge(task) {
  if (!task.labels && !task.isDraft) return '&nbsp;';

  const labels = (task.labels || []).map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
  const isDraft = task.isDraft === true;
  const isPendingMerge = task.isApproved && labels.includes('pending-pr-merge');
  const isBlocked =
    !isPendingMerge &&
    labels.some((l) => l.includes('blocked') || l.includes('stalled') || l.includes('wait'));

  let text = '';
  let color = '';

  if (isDraft) {
    text = 'DRAFT';
    color = '64748b';
  } else if (isPendingMerge) {
    text = 'PENDING%20MERGE';
    color = '10b981';
  } else if (isBlocked) {
    text = 'BLOCKED';
    color = 'f43f5e';
  }

  if (!text) return '&nbsp;';

  return `<img src="https://img.shields.io/badge/${text}-${color}?style=flat-square" alt="${text}">`;
}

/**
 * Generates the Community & Activity Markdown report.
 */
async function createCommunityMarkdown(
  contributions,
  rolesData,
  ongoingTasks = [],
  ongoingIssues = [],
  ongoingPRs = [],
  ongoingCoAuthoredPRs = [] // ADDED
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

  // 1. To do issues
  const todoTasks = ongoingIssues.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // 2. Ongoing PRs
  const submittedPRs = ongoingPRs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // 3. Co-authored PRs
  const coAuthoredPRs = ongoingCoAuthoredPRs.sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  // 4. Manual Request Review (Exclude Bots)
  const requestReviewTasks = ongoingTasks
    .filter((t) => t.status === 'Request review' && !isBot(t))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // 5. Review in progress
  const inProgressTasks = ongoingTasks
    .filter((t) => t.status === 'Review in progress')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // 6. Bot Request Review
  const botRequestReviewTasks = ongoingTasks
    .filter((t) => t.status === 'Request review' && isBot(t))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  /**
   * Helper function to build a collapsible table section.
   */
  const buildCollapsibleSection = (title, icon, tasks) => {
    const count = tasks.length;
    const displayCount = String(count);
    const randomMsg =
      WORKBENCH_SUCCESS_MESSAGES[Math.floor(Math.random() * WORKBENCH_SUCCESS_MESSAGES.length)];

    let section = `<details>\n`;
    section += `  <summary><h3 style="display: inline-block; padding-bottom: 20px; cursor: pointer; margin: 0;">${icon} ${title} (${displayCount})</h3></summary>\n\n`;

    if (count === 0) {
      section += `> ***${randomMsg}***\n`;
    } else {
      section += `<table style='width:100%; table-layout:fixed;'>\n`;
      section += `  <thead>\n    <tr>\n`;
      section += `      <th style='width:20%; text-align:left;'>Repository</th>\n`;
      section += `      <th style='width:15%; text-align:left;'>Status</th>\n`;
      section += `      <th style='width:65%; text-align:left;'>Task</th>\n`;
      section += `    </tr>\n  </thead>\n  <tbody>\n`;

      tasks.forEach((task) => {
        const repoName = task.repo.split('/')[1] || task.repo;
        const statusBadge = getStatusBadge(task);

        section += `    <tr>\n`;
        section += `      <td style='vertical-align: top;'><strong>${repoName}</strong></td>\n`;
        section += `      <td style='vertical-align: top; text-align: center;'>${statusBadge}</td>\n`;
        section += `      <td style='vertical-align: top;'><a href='${task.url}'>${task.title}</a></td>\n`;
        section += `    </tr>\n`;
      });

      section += `  </tbody>\n</table>\n`;
    }

    section += `\n</details>\n\n`;
    return section;
  };

  // --- Render Sections in Priority Order ---
  md += buildCollapsibleSection('Ongoing PRs', '📤', submittedPRs);
  md += buildCollapsibleSection('Moving Co-authored PRs Forward', '🤝', coAuthoredPRs);
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
