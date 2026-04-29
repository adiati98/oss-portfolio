const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR, GITHUB_USERNAME } = require('../../config/config');
const { WORKBENCH_SUCCESS_MESSAGES } = require('../../metadata/workbench-messages');
const { WORKBENCH_BALL_STATUS } = require('../../config/constants');

/**
 * Maps ball status to GitHub-friendly indicators (using Shields.io for consistency).
 */
function getBallTrackingBadge(task, type) {
  if (type !== 'ongoing') return null;

  // 1. Approved logic - HIGHEST PRIORITY
  if (task.reviewState === 'APPROVED' || task.status === 'APPROVED') {
    return {
      badge: `<img src="https://img.shields.io/badge/APPROVED-15803d?style=flat-square" alt="Approved">`,
      child: ``,
    };
  }

  const now = new Date();
  const lastUpdate = new Date(task.lastSubstantiveDate || task.updatedAt);
  const diffDays = (now - lastUpdate) / (1000 * 60 * 60 * 24);

  // 2. Stale logic - Displays day count
  if (diffDays >= 21) {
    const dayCount = Math.floor(diffDays);
    return {
      badge: `<img src="https://img.shields.io/badge/IDLE-334155?style=flat-square" alt="Idle">`,
      child: `<br><sub>${dayCount} days</sub>`,
    };
  }

  // 3. Actor logic - For active, non-approved PRs
  const lastActor = task.lastActor;
  const isMe = lastActor === GITHUB_USERNAME;
  const isAuthor = lastActor === task.author;

  let child = task.hasFormalReview ? 'Review' : 'Discussion';
  const isBotActor = task.isLastActorBot || /\[bot\]$|dependabot|snyk/i.test(lastActor || '');

  if (isBotActor) child += ' + BOT';

  let statusKey = 'watching';
  if (isMe) statusKey = 'waiting';
  else if (isAuthor) statusKey = 'takeAction';

  const colorMap = {
    waiting: '4338ca', // Indigo 700
    takeAction: 'b45309', // Amber 700
    watching: '1d4ed8', // Blue 700
  };

  const config = WORKBENCH_BALL_STATUS[statusKey];
  const color = colorMap[statusKey] || '334155';
  const label = config.label.toUpperCase().replace(' ', '%20');

  return {
    badge: `<img src="https://img.shields.io/badge/${label}-${color}?style=flat-square" alt="${config.label}">`,
    child: `<br><sub>${child}</sub>`,
  };
}

/**
 * Helper to render secondary status labels (Draft, Blocked, etc.).
 */
function getStatusBadge(task) {
  const labels = (task.labels || []).map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
  const isDraft = task.isDraft === true;
  const isPendingMerge = labels.some((l) => l.includes('pending') && l.includes('merge'));
  const isBlocked =
    !isPendingMerge &&
    labels.some((l) => l.includes('blocked') || l.includes('stalled') || l.includes('wait'));

  if (isDraft)
    return `<br><img src="https://img.shields.io/badge/DRAFT-334155?style=flat-square" alt="Draft">`;
  if (isPendingMerge)
    return `<br><img src="https://img.shields.io/badge/PENDING%20MERGE-15803d?style=flat-square" alt="Pending">`;
  if (isBlocked)
    return `<br><img src="https://img.shields.io/badge/BLOCKED-b91c1c?style=flat-square" alt="Blocked">`;

  return '';
}

async function createCommunityMarkdown(
  contributions,
  rolesData,
  ongoingTasks = [],
  ongoingIssues = [],
  ongoingPRs = [],
  ongoingCoAuthoredPRs = []
) {
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  const outputPath = path.join(mdBaseDir, 'community-activity.md');
  await fs.mkdir(mdBaseDir, { recursive: true });

  const isBot = (t) => {
    const username = typeof t.user === 'object' ? t.user?.login : t.user;
    const userStr = String(username || '').toLowerCase();
    const titleStr = String(t.title || '').toLowerCase();
    return (
      userStr.includes('dependabot') ||
      titleStr.startsWith('[snyk]') ||
      (titleStr.startsWith('bump') && userStr.includes('dependabot')) ||
      userStr.includes('[bot]')
    );
  };

  const botTasks = ongoingTasks.filter((t) => isBot(t));
  const humanTasks = ongoingTasks.filter((t) => !isBot(t));

  const manualRequestTasks = humanTasks.filter((t) => t.status === 'Request review');
  const inProgressTasks = humanTasks.filter((t) => t.status === 'Review in progress');

  let md = `# Community & Activity\n\n`;
  md += `Leadership roles, major milestones, and active maintenance tasks across the Open Source ecosystem.\n\n`;

  md += `## 🏆 Major Milestones\n\n`;
  rolesData.achievements.forEach((ach) => {
    md += `* **${ach.title}** (${ach.year}) — *${ach.org}*\n`;
  });
  md += `\n`;

  md += `## 🏗️ Roles & Impact\n\n`;
  rolesData.roles.forEach((role) => {
    const icon = role.active ? '🟢 **Active**' : '⚪ *Past*';
    md += `* ${icon} | **${role.title}** at ${role.org} (${role.period})\n`;
  });
  md += `\n`;

  md += `## 🛠️ Active Workbench\n\n`;

  const buildSection = (title, icon, tasks, type) => {
    const count = tasks.length;
    const randomMsg =
      WORKBENCH_SUCCESS_MESSAGES[Math.floor(Math.random() * WORKBENCH_SUCCESS_MESSAGES.length)];

    const hasStatus = type !== 'todo' && type !== 'bot';

    let section = `<details>\n`;
    section += `  <summary><h3 style="display: inline-block; cursor: pointer;">${icon} ${title} (${count})</h3></summary>\n\n`;

    if (count === 0) {
      section += `> ***${randomMsg}***\n`;
    } else {
      if (hasStatus) {
        section += `| Status | Repository | Task |\n`;
        section += `| :--- | :--- | :--- |\n`;
      } else {
        section += `| Repository | Task |\n`;
        section += `| :--- | :--- |\n`;
      }

      tasks
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .forEach((task) => {
          const repoName = task.repo.split('/')[1] || task.repo;
          const extraBadge = getStatusBadge(task);

          if (hasStatus) {
            const ballData = getBallTrackingBadge(task, type);
            const statusCell = ballData ? `${ballData.badge}${ballData.child}` : `—`;
            section += `| ${statusCell} | **${repoName}**${extraBadge} | [${task.title}](${task.url}) |\n`;
          } else {
            section += `| **${repoName}**${extraBadge} | [${task.title}](${task.url}) |\n`;
          }
        });
    }
    section += `\n</details>\n\n`;
    return section;
  };

  md += buildSection('To do issues', '📝', ongoingIssues, 'todo');
  md += buildSection('Request review', '📥', manualRequestTasks, 'todo');
  md += buildSection('Ongoing PRs', '📤', ongoingPRs, 'ongoing');
  md += buildSection('Moving Co-authored PRs Forward', '🤝', ongoingCoAuthoredPRs, 'ongoing');
  md += buildSection('Review in progress', '🔄', inProgressTasks, 'ongoing');
  md += buildSection('Bot request review', '🤖', botTasks, 'bot');

  md += `---\n`;
  md += `*Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*\n`;

  await fs.writeFile(outputPath, md.trim() + '\n', 'utf8');
}

module.exports = { createCommunityMarkdown };
