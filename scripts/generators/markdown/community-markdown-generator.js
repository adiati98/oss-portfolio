const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');
const { LANES } = require('../html/workbench-html-generator');

const MD_BASE_DIR = path.join(BASE_DIR, 'markdown-generated');

/** Shared footer: every generated .md links back to the README hub. */
function mdFooter(links) {
  const nav = ['[← Back to Summary](./README.md)', ...links].join(' | ');
  const stamp = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `---\n${nav} | *Last updated: ${stamp}*\n`;
}

/**
 * journey.md — the recruiter-facing half: milestones and roles.
 * Mirrors journey.html (design blueprint §02).
 */
async function createJourneyMarkdown(rolesData) {
  await fs.mkdir(MD_BASE_DIR, { recursive: true });

  let md = `# Journey\n\n`;
  md += `Milestones, and the leadership roles behind them, across the Open Source ecosystem.\n\n`;

  md += `## 🏆 Major Milestones\n\n`;
  (rolesData.achievements || []).forEach((ach) => {
    const orgDisplay = ach.orgUrl ? `[${ach.org}](${ach.orgUrl})` : ach.org;
    const title = ach.url ? `[${ach.title}](${ach.url})` : ach.title;
    md += `* **${title}** (${ach.year}) — *${orgDisplay}*\n`;
    if (ach.description) md += `  * ${ach.description}\n`;
  });
  md += `\n`;

  md += `## 🏗️ Roles & Impact\n\n`;
  (rolesData.roles || []).forEach((role) => {
    const icon = role.active ? '🟢 **Active**' : '⚪ *Past*';
    const orgDisplay = role.orgUrl ? `[${role.org}](${role.orgUrl})` : role.org;
    md += `* ${icon} | **${role.title}** at ${orgDisplay} (${role.period})\n`;
  });
  md += `\n`;

  md += mdFooter(['[Active Workbench →](./workbench.md)']);

  await fs.writeFile(path.join(MD_BASE_DIR, 'journey.md'), md.trim() + '\n', 'utf8');
  console.log(`Generated Journey Markdown at ${path.join(MD_BASE_DIR, 'journey.md')}`);
}

// ---------------------------------------------------------------------------
// workbench.md — mirrors workbench.html's structure exactly: the same
// records/impact/feed model (loadMergedWorkbench()) and the same LANES
// config (imported from workbench-html-generator.js, not redefined), so the
// two outputs can't drift out of sync.
// ---------------------------------------------------------------------------

const LANE_ICON = { action: '🔥', ready: '✅', waiting: '👀', stalled: '⏳', bot: '🤖' };

const BALL_COLOR = {
  'Take Action': 'b45309',
  'To Write': 'b45309',
  Approved: '15803d',
  Watching: '1d4ed8',
  Waiting: '4338ca',
  Stale: '334155',
  Bot: '334155',
};

const REL_LABEL = {
  authored: '✍ authored',
  'co-authoring': '🤝 co-authoring',
  reviewing: '👀 reviewing',
  'assigned issue': '📝 assigned issue',
};

/** A `|` in a title/body would corrupt the table row; strip line breaks too. */
function escapeCell(str) {
  return String(str || '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

/** Mirrors the wbx-pill: ball label as a badge, plus the same idle-day suffix rule as renderRow. */
function statusCell(record) {
  const color = BALL_COLOR[record.ball] || '334155';
  const label = String(record.ball).toUpperCase().replace(/ /g, '%20');
  const badge = `![${record.ball}](https://img.shields.io/badge/${label}-${color}?style=flat-square)`;
  const idleBadge =
    record.lane === 'stalled' || record.idleDays >= 7 ? `<br><sub>${Math.floor(record.idleDays)}d</sub>` : '';
  return `${badge}${idleBadge}`;
}

/** Mirrors the wbx-meta row: repo chip, relationship label, Draft badge. */
function repoCell(record) {
  const bits = [`**${escapeCell(record.repo || '')}**`];
  const rel = REL_LABEL[record.relationship] || record.relationship;
  if (rel) bits.push(rel);
  if (record.isDraft) bits.push('`Draft`');
  return bits.join('<br>');
}

/** Mirrors renderRow's nextBits: approval note, reviewed note, bot ping, linked code PR, next step. */
function nextCell(record) {
  const bits = [];
  if (record.approval && record.approval.by) {
    const dismissedNote = record.approval.dismissed ? ' — dismissed after update' : '';
    bits.push(`approved by **${escapeCell(record.approval.by)}**${dismissedNote}`);
  }
  if (record.reviewedNote && record.reviewedNote.by) {
    bits.push(`**${escapeCell(record.reviewedNote.by)}** reviewed this`);
  }
  if (record.botPing && record.botPing.of) {
    bits.push(`Promptless pinged **${escapeCell(record.botPing.of)}**`);
  }
  if (record.linkedCodePr && record.linkedCodePr.ref) {
    const ref = record.linkedCodePr.ref;
    const match = ref.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    const refMd = match ? `[${ref}](https://github.com/${match[1]}/pull/${match[2]})` : escapeCell(ref);
    bits.push(`🔗 code PR ${refMd}`);
  }
  if (record.nextStep) bits.push(escapeCell(record.nextStep));
  return bits.length ? bits.map((bit) => `• ${bit}`).join('<br>') : '—';
}

function taskCell(record) {
  const title = escapeCell(record.title || record.key || '');
  return record.url ? `[${title}](${record.url})` : title;
}

/** One `<details>` block per lane — title/explain/open/order all come from the shared LANES config. */
function renderLaneSection(lane, records) {
  let section = `<details${lane.open && records.length > 0 ? ' open' : ''}>\n`;
  section += `  <summary><h3 style="display: inline-block; cursor: pointer;">${LANE_ICON[lane.id]} ${lane.title} (${records.length})</h3></summary>\n\n`;
  section += `  <sub>${lane.explain}</sub>\n\n`;

  if (records.length > 0) {
    section += `  | Status | Repo | Task | Next |\n`;
    section += `  | :--- | :--- | :--- | :--- |\n`;
    records.forEach((record) => {
      section += `  | ${statusCell(record)} | ${repoCell(record)} | ${taskCell(record)} | ${nextCell(record)} |\n`;
    });
    section += `\n`;
  }

  section += `</details>\n\n`;
  return section;
}

/** Mirrors renderImpact's five tiles — same "this month/quarter" framing, not Home's lifetime figures. */
function renderImpactSection(impact, feed) {
  const helpedTile =
    impact.contributorsHelpedThisMonth > 0
      ? [`${impact.contributorsHelpedThisMonth}`, `contributors' work you've helped ship this month`]
      : [`${impact.helpedShipThisMonth}`, `contributions you helped ship this month`];

  let md = `## 📊 Active across open source — this month & quarter\n\n`;
  md += `| Metric | Activity |\n| :--- | :--- |\n`;
  md += `| 🚀 **${impact.shippedThisQuarter}** | changes shipped this quarter |\n`;
  md += `| ✅ **${impact.approvedLanding}** | approved & heading to merge |\n`;
  md += `| 🔥 **${impact.needAction}** | need your action now |\n`;
  md += `| 🤝 **${helpedTile[0]}** | ${helpedTile[1]} |\n`;
  md += `| 🌐 **${impact.projectsThisMonth}** | projects across ${impact.organizationsThisMonth} organization${impact.organizationsThisMonth === 1 ? '' : 's'} this month |\n\n`;

  if (feed.degraded) {
    md += `> ⚠️ **Tracker feed degraded.** ${feed.reason || 'Live fetch failed.'} Local records are current as of this build; lane placement keeps working from the last good data.\n\n`;
  }

  return md;
}

/**
 * workbench.md — the maintainer-facing half: the live triage board.
 * Mirrors workbench.html exactly: same impact tiles, same five lanes (title,
 * explain text, open/folded state, and order all read from the LANES
 * config workbench.html itself uses), same per-row fields. Consumes the
 * merged `{ records, impact, feed }` model from loadMergedWorkbench() —
 * the same object passed to createWorkbenchHtml — rather than the raw
 * pre-merge task lists.
 */
async function createWorkbenchMarkdown({ records, impact, feed }) {
  const outputPath = path.join(MD_BASE_DIR, 'workbench.md');
  await fs.mkdir(MD_BASE_DIR, { recursive: true });

  let md = `# Active Workbench\n\n`;
  md += `Live maintainer and contribution activity, organized by what happens next.\n\n`;
  md += renderImpactSection(impact, feed);

  // "Approved is not done": every ready-lane row still needs a final review,
  // a backport check, or a maintainer nudge — see workbench-html-generator.js.
  const humanRecords = records.filter((r) => r.lane !== 'bot');

  if (humanRecords.length === 0) {
    md += `## ✅ Your court is clear.\n\n`;
    md += `No open tasks locally, and the tracker has nothing waiting on you.\n\n`;
  } else {
    LANES.forEach((lane) => {
      md += renderLaneSection(
        lane,
        records.filter((r) => r.lane === lane.id)
      );
    });
  }

  md += mdFooter(['[Journey →](./journey.md)']);

  await fs.writeFile(outputPath, md.trim() + '\n', 'utf8');
  console.log(`Generated Workbench Markdown at ${outputPath}`);
}

module.exports = { createJourneyMarkdown, createWorkbenchMarkdown };
