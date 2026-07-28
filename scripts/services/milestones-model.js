/**
 * Shared milestone assembly for the Journey page — consumed by both
 * journey-html-generator.js (journey.html) and community-markdown-generator.js
 * (journey.md) so the two outputs can't drift apart structurally.
 *
 * Milestones come from one file per kind of thing. The file an entry lives in
 * decides its tag, so no entry has to spell its own tag out (and none can get
 * it wrong). Adding a new kind means one file plus one line in MILESTONE_SOURCES.
 *
 * Two entry shapes feed in:
 *   'achievement' — title, org, year, url, description   (awards, courses,
 *                                                         projects, docs)
 *   'media'       — title, event, year, url, blurb       (talks, videos)
 * Both normalize to the achievement shape before rendering.
 */

/** Reel size used when nothing carries `highlight: true` yet. */
const HIGHLIGHT_FALLBACK = 5;

const MILESTONE_SOURCES = [
  { key: 'awards', tag: '🏆 Award', shape: 'achievement' },
  { key: 'courses', tag: '🎓 Course', shape: 'achievement' },
  { key: 'projects', tag: '🛠 Project', shape: 'achievement' },
  { key: 'docs', tag: '📚 Docs', shape: 'achievement' },
  { key: 'talks', tag: '🎤 Talk', shape: 'media' },
  { key: 'videos', tag: '🎥 Video', shape: 'media' },
];

/**
 * Multi-year efforts (a handbook maintained 2021–2025, a project still
 * running) carry an optional `yearEnd`. Everything orders by the year the
 * work last touched, so ongoing entries stay at the top of the timeline
 * rather than sinking to the year they began.
 */
function endYear(entry) {
  if (entry.yearEnd === 'present') return new Date().getFullYear();
  return entry.yearEnd || entry.year || 0;
}

function formatYears(entry) {
  if (!entry.yearEnd) return String(entry.year);
  if (entry.yearEnd === 'present') return `${entry.year}–present`;
  return `${entry.year}–${entry.yearEnd}`;
}

function normalize(entry, { tag, shape }) {
  const base =
    shape === 'media' ? { ...entry, org: entry.event, description: entry.blurb } : { ...entry };
  // An entry's own `tag` still wins — an escape hatch for the odd item that
  // doesn't match its file's default.
  return { ...base, tag: entry.tag || tag };
}

/**
 * Merges every source into one stream, newest-last-touched first.
 * @param {Object} content Keyed by the `key` values in MILESTONE_SOURCES.
 */
function buildMilestones(content = {}) {
  const merged = [];
  for (const source of MILESTONE_SOURCES) {
    for (const entry of content[source.key] || []) {
      merged.push(normalize(entry, source));
    }
  }
  return merged.sort((a, b) => endYear(b) - endYear(a));
}

/**
 * The reel: flagged entries, or the newest few when nothing is flagged yet,
 * so the timeline can never render empty.
 * @param {Array} sorted Output of buildMilestones.
 */
function selectShown(sorted) {
  const flagged = sorted.filter((entry) => entry.highlight);
  const shown = new Set(flagged.length ? flagged : sorted.slice(0, HIGHLIGHT_FALLBACK));
  return { shown, hiddenCount: sorted.length - shown.size, hasFlagged: flagged.length > 0 };
}

/**
 * Scale of the whole record, for the line under the section heading. Without
 * it a reader can't tell whether they're looking at eight entries or eighty
 * until they reach the control at the bottom.
 * @returns {?{count:number, orgs:number, from:number, to:number}}
 */
function summarize(sorted) {
  if (!sorted.length) return null;
  const orgs = new Set(sorted.map((e) => e.org).filter(Boolean));
  const starts = sorted.map((e) => e.year || endYear(e)).filter(Boolean);
  return {
    count: sorted.length,
    orgs: orgs.size,
    from: Math.min(...starts),
    to: Math.max(...sorted.map(endYear)),
  };
}

module.exports = {
  HIGHLIGHT_FALLBACK,
  MILESTONE_SOURCES,
  buildMilestones,
  selectShown,
  summarize,
  endYear,
  formatYears,
};
