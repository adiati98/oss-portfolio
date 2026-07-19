const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');
const { LANES } = require('../html/workbench-html-generator');
const { THEME } = require('../../config/constants');
const { mdEscapeCell, mdEscapeLinkText } = require('./md-escape');

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
 * Talks (contents/talks.js) join the milestones timeline with a 🎤 Talk tag —
 * same shape as achievements, mapped from the talk fields (event → org,
 * blurb → description). Mirrors normalizeTalks in journey-html-generator.js.
 * An empty talks list contributes nothing.
 */
function normalizeTalksForMarkdown(talks) {
  return (talks || []).map((t) => ({
    title: t.title,
    year: t.year,
    org: t.event,
    url: t.url,
    description: t.blurb,
    tag: '🎤 Talk',
  }));
}

/**
 * Mirrors renderExpertiseAndTools: expertise rows (title + blurb) followed by
 * Tools/Skills as labeled lists — markdown has no chip row, so highlighted
 * entries (skills.highlight) are bolded in place instead. The "Expertise"
 * heading itself is unconditional in journey.html (the <h2> renders even if
 * expertise/tools/skills are all empty) — only the Tools/Skills sub-headings
 * are individually hidden when their own list is empty (renderChipSection's
 * guard), so this mirrors that exactly rather than hiding the whole section.
 */
function renderExpertiseMarkdown(skills) {
  const expertise = skills.expertise || [];
  const tools = skills.tools || [];
  const skillsList = skills.skills || [];

  const highlight = new Set((skills.highlight || []).map((t) => String(t).toLowerCase()));
  const renderChipBullets = (items) =>
    items
      .map(
        (t) =>
          `* ${highlight.has(String(t).toLowerCase()) ? `**${mdEscapeCell(t)}**` : mdEscapeCell(t)}\n`
      )
      .join('');

  let md = `## 🧭 Expertise\n\n`;
  expertise.forEach((c) => {
    md += `* **${mdEscapeCell(c.title)}**${c.blurb ? ` — ${mdEscapeCell(c.blurb)}` : ''}\n`;
  });
  if (expertise.length > 0) md += `\n`;
  if (tools.length > 0) md += `### 🛠️ Tools\n\n${renderChipBullets(tools)}\n`;
  if (skillsList.length > 0) md += `### 💡 Skills\n\n${renderChipBullets(skillsList)}\n`;
  return md;
}

/**
 * journey.md — the recruiter-facing half: milestones, expertise, and roles.
 * Mirrors journey.html (design blueprint §02): talks (contents/talks.js) join
 * the milestones timeline, and skills.js renders as an Expertise section
 * (see renderExpertiseMarkdown), matching the HTML page's expertise/tools/
 * skills chip rows within markdown's own styling limits.
 */
async function createJourneyMarkdown(rolesData, skills = {}, talks = []) {
  await fs.mkdir(MD_BASE_DIR, { recursive: true });

  const milestones = [...(rolesData.achievements || []), ...normalizeTalksForMarkdown(talks)];
  const sortedMilestones = [...milestones].sort((a, b) => (b.year || 0) - (a.year || 0));

  let md = `# Journey\n\n`;
  md += `Milestones, expertise, and the leadership roles behind them, across the Open Source ecosystem.\n\n`;

  md += `## 🏆 Major Milestones\n\n`;
  if (sortedMilestones.length === 0) {
    md += `_Milestones will appear here — add them in \`contents/leadership.js\`._\n\n`;
  } else {
    sortedMilestones.forEach((ach) => {
      const orgDisplay = ach.orgUrl
        ? `[${mdEscapeLinkText(ach.org)}](${ach.orgUrl})`
        : mdEscapeCell(ach.org);
      const title = ach.url
        ? `[${mdEscapeLinkText(ach.title)}](${ach.url})`
        : mdEscapeCell(ach.title);
      const tagPrefix = ach.tag ? `${ach.tag} — ` : '';
      md += `* ${tagPrefix}**${title}** (${ach.year}) — *${orgDisplay}*\n`;
      if (ach.description) md += `  * ${mdEscapeCell(ach.description)}\n`;
    });
    md += `\n`;
  }

  md += renderExpertiseMarkdown(skills || {});

  md += `## 🏗️ Roles & Impact\n\n`;
  (rolesData.roles || []).forEach((role) => {
    const icon = role.active ? '🟢 **Active**' : '⚪ *Past*';
    const orgDisplay = role.orgUrl
      ? `[${mdEscapeLinkText(role.org)}](${role.orgUrl})`
      : mdEscapeCell(role.org);
    md += `* ${icon} | **${mdEscapeCell(role.title)}** at ${orgDisplay} (${role.period})\n`;
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

/** Strips the leading `#` off a theme hex so it drops straight into a
 * shields.io badge URL (`.../badge/LABEL-RRGGBB?...`). */
const stripHash = (hex) =>
  String(hex || '')
    .replace(/^#/, '')
    .toLowerCase();

/**
 * Ball badge colors, derived from the same THEME seeds workbench.html's pills
 * use — not hand-picked hex — so a re-brand (scripts/config/theme.js) can't
 * silently desync the two outputs. Uses each seed's light-mode `text` step
 * (badges render on GitHub's light chrome regardless of the viewer's OS
 * theme). Waiting intentionally matches Approved: both render with
 * `--t-positive` in workbench.html's PILL_CLASS (wbx-pill--wait / --ok) —
 * "waiting" here means your part is done, not that something is wrong.
 */
const BALL_COLOR = {
  'Take Action': stripHash(THEME.semantic.caution.light.text),
  'To Write': stripHash(THEME.semantic.caution.light.text),
  Approved: stripHash(THEME.semantic.positive.light.text),
  Watching: stripHash(THEME.semantic.brand.light.text),
  Waiting: stripHash(THEME.semantic.positive.light.text),
  Stale: stripHash(THEME.semantic.neutral.light.text),
  Bot: stripHash(THEME.semantic.neutral.light.text),
};

const REL_LABEL = {
  authored: '✍ authored',
  'co-authoring': '🤝 co-authoring',
  reviewing: '👀 reviewing',
  'assigned issue': '📝 assigned issue',
};

/** Mirrors the wbx-pill: ball label as a badge, plus the same idle-day suffix rule as renderRow. */
function statusCell(record) {
  const color = BALL_COLOR[record.ball] || stripHash(THEME.semantic.neutral.light.text);
  const label = String(record.ball).toUpperCase().replace(/ /g, '%20');
  const badge = `![${record.ball}](https://img.shields.io/badge/${label}-${color}?style=flat-square)`;
  const idleBadge =
    record.lane === 'stalled' || record.idleDays >= 7
      ? `<br><sub>${Math.floor(record.idleDays)}d</sub>`
      : '';
  return `${badge}${idleBadge}`;
}

/** Mirrors the wbx-meta row: repo chip, relationship label, Draft badge. */
function repoCell(record) {
  const bits = [`**${mdEscapeCell(record.repo || '')}**`];
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
    bits.push(`approved by **${mdEscapeCell(record.approval.by)}**${dismissedNote}`);
  }
  if (record.reviewedNote && record.reviewedNote.by) {
    bits.push(`**${mdEscapeCell(record.reviewedNote.by)}** reviewed this`);
  }
  if (record.botPing && record.botPing.of) {
    bits.push(`Promptless pinged **${mdEscapeCell(record.botPing.of)}**`);
  }
  if (record.linkedCodePr && record.linkedCodePr.ref) {
    const ref = record.linkedCodePr.ref;
    const match = ref.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    const refMd = match
      ? `[${ref}](https://github.com/${match[1]}/pull/${match[2]})`
      : mdEscapeCell(ref);
    bits.push(`🔗 code PR ${refMd}`);
  }
  if (record.nextStep) bits.push(mdEscapeCell(record.nextStep));
  return bits.length ? bits.map((bit) => `• ${bit}`).join('<br>') : '—';
}

function taskCell(record) {
  const title = mdEscapeLinkText(record.title || record.key || '');
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

/**
 * Mirrors renderImpact's five tiles. Each tile's own caption carries its
 * scope ("this quarter", "this month", or no scope word at all for a
 * point-in-time count like approvedLanding/needAction) exactly as
 * workbench.html phrases it — these are live-board figures, not Home's
 * lifetime ones, but the section itself isn't uniformly "this month &
 * quarter" so the header doesn't claim a single blanket scope either.
 */
function renderImpactSection(impact, feed) {
  const helpedTile =
    impact.contributorsHelpedThisMonth > 0
      ? [
          `${impact.contributorsHelpedThisMonth}`,
          `contributors' work you've helped ship this month`,
        ]
      : [`${impact.helpedShipThisMonth}`, `contributions you helped ship this month`];

  let md = `## 📊 Active across open source — live maintainer & contribution activity\n\n`;
  md += `| Metric | Activity |\n| :--- | :--- |\n`;
  md += `| 🚀 **${impact.shippedThisQuarter}** | changes shipped this quarter |\n`;
  md += `| ✅ **${impact.approvedLanding}** | approved & heading to merge |\n`;
  md += `| 🔥 **${impact.needAction}** | need your action now |\n`;
  md += `| 🤝 **${helpedTile[0]}** | ${helpedTile[1]} |\n`;
  md += `| 🌐 **${impact.projectsThisMonth}** | projects across ${impact.organizationsThisMonth} organization${impact.organizationsThisMonth === 1 ? '' : 's'} this month |\n\n`;

  if (feed.degraded) {
    // feed.reason (e.g. "live fetch failed (...); using cached feed") carries
    // no terminal punctuation of its own — append one before the next
    // sentence so the two clauses don't run together.
    const reasonText = feed.reason
      ? `${feed.reason}${/[.!?]$/.test(feed.reason) ? '' : '.'}`
      : 'Live fetch failed.';
    md += `> ⚠️ **Tracker feed degraded.** ${reasonText} Local records are current as of this build; lane placement keeps working from the last good data.\n\n`;
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
