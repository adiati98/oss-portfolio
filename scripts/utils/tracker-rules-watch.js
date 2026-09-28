/**
 * TRACKER RULES WATCH — the "change alert" for the copied backport rules
 *
 * backport-rules.js is a copy of the Mautic docs PR tracker's backport logic.
 * The tracker keeps changing, and it is never edited from here, so this file
 * downloads the tracker's public tracker.js as plain text on every run (a raw
 * file download, not a GitHub API call) and checks whether the parts that
 * matter have changed since the copy was made.
 *
 * What it watches:
 *   - each named declaration listed in WATCHED_DECLARATIONS: the detection
 *     rules and the helpers they call
 *   - every code line (not comments) that deals with how the tracker TREATS a
 *     confirmed backport: waiting on the parent, ready once the parent merged,
 *     no milestone of its own. Those lines live inside the tracker's big main()
 *     and all mention the backport parent, so they are found by name.
 *
 * Comments and indentation are ignored, so rewording a comment does not raise
 * the alert. Everything else in the tracker (reminders, priorities, the guide
 * page) is ignored on purpose — it does not affect oss-portfolio.
 *
 * It never fails the build: a download failure only prints a note.
 *
 * To refresh the baseline after copying new rules:
 *   node scripts/utils/tracker-rules-watch.js
 * prints the current hashes; paste them into BASELINE below.
 */
const crypto = require('crypto');
const axios = require('axios');

const TRACKER_SOURCE_URL =
  'https://raw.githubusercontent.com/adiati98/mautic-docs-prs-tracker/main/tracker.js';

const WATCHED_DECLARATIONS = [
  'REPOS',
  'DEPENDABOT_LOGIN',
  'escapeRegExp',
  'DEPENDENCY_BACKPORT_TITLE_PATTERN',
  'isDependencyBumpBackportTitle',
  'extractReferencedPRNumber',
  'resolveManualDependencyBackport',
  'BACKPORT_TITLE_SUFFIX_PATTERN',
  'backportTitleSuffixBranch',
  'normalizeTitleForBackportMatch',
  'SENTENCE_BREAK',
  'backportReferenceWordPattern',
  'backportReferenceUrlPattern',
  'extractBackportParentNumber',
  'extractFirstBareReference',
  'findBackportParent',
];

// Code lines in the tracker that decide how a confirmed backport is handled.
const HANDLING_LINE_PATTERN =
  /backportparent|allowTitleMatch|isManualDependencyBackport|isDependabotPR/i;
const HANDLING_KEY = 'backport handling (lines inside main)';

/** The tracker commit the baseline was taken from, and its hashes. */
const BASELINE_COMMIT = '92436323';
const BASELINE = {
  REPOS: '54908696c137',
  DEPENDABOT_LOGIN: '8f5672884498',
  escapeRegExp: '7b09e452fe89',
  DEPENDENCY_BACKPORT_TITLE_PATTERN: '11aa4ef837c2',
  isDependencyBumpBackportTitle: '0dc4f0257542',
  extractReferencedPRNumber: 'a8ecae3b1db1',
  resolveManualDependencyBackport: '39f8c29be421',
  BACKPORT_TITLE_SUFFIX_PATTERN: 'bc44bbbfacb5',
  backportTitleSuffixBranch: '3f289b9cebf1',
  normalizeTitleForBackportMatch: 'dd7ee16c6a6c',
  SENTENCE_BREAK: '302de8ad1f34',
  backportReferenceWordPattern: 'c9b28a8414d9',
  backportReferenceUrlPattern: 'c4fc07f1a8dc',
  extractBackportParentNumber: '3efca5536afa',
  extractFirstBareReference: 'fdf7573b5c27',
  findBackportParent: '5eb7216f3c51',
  'backport handling (lines inside main)': '3c9bfba576d8',
};

/** Trims each line, and drops blank and comment-only lines. */
function normalizeLines(lines) {
  return lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .join('\n');
}

/**
 * The source text of one top-level `const NAME` / `function NAME` /
 * `async function NAME`, or null when it is not there (renamed or removed).
 * A declaration ends at a first-column line made only of closing brackets
 * ("}" or ")"), or at the next other line that starts in the first column. A
 * line like "}) {" (the end of a multi-line parameter list) does not end it.
 */
function extractDeclaration(source, name) {
  const lines = source.split('\n');
  const startPattern = new RegExp(`^(?:async\\s+)?(?:function\\s+${name}\\b|const\\s+${name}\\b)`);
  const start = lines.findIndex((l) => startPattern.test(l));
  if (start === -1) return null;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[})][})\];,]*\s*$/.test(line)) {
      out.push(line);
      break;
    }
    if (/^[})]/.test(line)) {
      out.push(line);
      continue;
    }
    if (/^\S/.test(line)) break;
    out.push(line);
  }
  return normalizeLines(out);
}

function extractHandlingLines(source) {
  return normalizeLines(source.split('\n').filter((l) => HANDLING_LINE_PATTERN.test(l)));
}

function shortHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** { name: hash | null } for every watched piece of a tracker.js source. */
function hashWatchedPieces(source) {
  const hashes = {};
  for (const name of WATCHED_DECLARATIONS) {
    const text = extractDeclaration(source, name);
    hashes[name] = text === null ? null : shortHash(text);
  }
  hashes[HANDLING_KEY] = shortHash(extractHandlingLines(source));
  return hashes;
}

/** The watched pieces whose hash differs from the baseline. */
function diffAgainstBaseline(hashes, baseline = BASELINE) {
  const changed = [];
  const missing = [];
  for (const [name, expected] of Object.entries(baseline)) {
    // Not in the baseline either, so there is nothing to compare against.
    if (expected === null || expected === undefined) continue;
    const actual = hashes[name];
    if (actual === null || actual === undefined) missing.push(name);
    else if (actual !== expected) changed.push(name);
  }
  return { changed, missing };
}

/**
 * Downloads tracker.js and prints the result. Returns
 * { status: 'unchanged' | 'changed' | 'unavailable', changed, missing }.
 * The "::warning" line is a GitHub Actions annotation, so the alert also shows
 * on the workflow run's summary page, not only deep in the log.
 */
async function checkTrackerRules({ url = TRACKER_SOURCE_URL, timeoutMs = 10000 } = {}) {
  let source;
  try {
    const res = await axios.get(url, { timeout: timeoutMs, responseType: 'text' });
    source = String(res.data || '');
  } catch (err) {
    console.log(`Could not check the tracker's backport rules (download failed: ${err.message}).`);
    return { status: 'unavailable', changed: [], missing: [] };
  }

  const { changed, missing } = diffAgainstBaseline(hashWatchedPieces(source));
  if (!changed.length && !missing.length) {
    console.log(`Tracker backport rules unchanged since ${BASELINE_COMMIT}.`);
    return { status: 'unchanged', changed, missing };
  }

  const parts = [];
  if (changed.length) parts.push(`changed: ${changed.join(', ')}`);
  if (missing.length) parts.push(`not found (renamed or removed): ${missing.join(', ')}`);
  const message =
    `The tracker's backport logic changed since ${BASELINE_COMMIT} (${parts.join('; ')}). ` +
    'Update scripts/utils/backport-rules.js to follow it.';
  console.log(`::warning title=Tracker backport rules changed::${message}`);
  console.warn(message);
  return { status: 'changed', changed, missing };
}

module.exports = {
  TRACKER_SOURCE_URL,
  BASELINE_COMMIT,
  BASELINE,
  extractDeclaration,
  hashWatchedPieces,
  diffAgainstBaseline,
  checkTrackerRules,
};

// Prints the current hashes, for refreshing BASELINE after an update.
if (require.main === module) {
  (async () => {
    const res = await axios.get(TRACKER_SOURCE_URL, { responseType: 'text' });
    console.log(JSON.stringify(hashWatchedPieces(String(res.data)), null, 2));
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
