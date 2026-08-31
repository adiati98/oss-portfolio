const path = require('path');
const fs = require('fs/promises');

/**
 * data/workbench.json — the published workbench contract.
 *
 * WHAT IT IS
 * ----------
 * The classified workbench model — lane, ball, next step, holds, approval
 * verdict, chips — written out as data on every run, next to the raw
 * ongoing-*.json files.
 *
 * It exists so other projects (adiati.com) can READ the verdict instead of
 * re-deriving it from the raw files. The classifier in workbench-merge.js is
 * the single source of truth; a second implementation elsewhere drifts, and
 * every rule change then has to be made twice.
 *
 * This file is a PUBLISHED CONTRACT, not an internal cache. Other projects
 * read it. Do not reshape it casually.
 *
 * HOW IT IS BUILT
 * ---------------
 * Straight from the same in-memory model the HTML and markdown generators
 * render from (`loadMergedWorkbench()` in workbench-merge.js). Nothing here
 * recomputes, re-classifies or re-sorts anything. If this file and the
 * rendered Workbench page could disagree, the whole point is lost.
 *
 * WHAT IS IN IT
 * -------------
 *   schemaVersion  integer, currently 1 (see the versioning rule below)
 *   generatedAt    ISO timestamp of the run that wrote the file
 *   feed           tracker feed status: fetchedAt, degraded, reason — so a
 *                  consumer can tell a stale run from a fresh one
 *   impact         the aggregates from computeImpact()
 *   records        the merged records, in the order the generators get them
 *                  (lane order, then most-urgent first)
 *
 * Records carry conclusions, not evidence: no raw comment bodies, no review
 * arrays, no PR bodies. A consumer that needs the evidence should read the
 * raw ongoing-*.json files, not this one.
 *
 * VERSIONING RULE
 * ---------------
 * `schemaVersion` MUST be incremented whenever a field is REMOVED or its
 * MEANING CHANGES. Adding a new field is not a breaking change and must not
 * bump the version — consumers ignore fields they do not know.
 */
const SCHEMA_VERSION = 1;

/**
 * Serializes the already-merged workbench model. Takes the exact object
 * `loadMergedWorkbench()` returned — no re-derivation.
 */
function buildWorkbenchData(model, now = new Date()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    feed: {
      fetchedAt: model.feed?.fetchedAt || null,
      degraded: Boolean(model.feed?.degraded),
      reason: model.feed?.reason || null,
    },
    impact: model.impact,
    records: model.records,
  };
}

/** Writes data/workbench.json from the merged model used by the generators. */
async function writeWorkbenchData(model, { dataDir = 'data', now } = {}) {
  const file = path.join(dataDir, 'workbench.json');
  const payload = buildWorkbenchData(model, now || new Date());
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
  return file;
}

module.exports = { SCHEMA_VERSION, buildWorkbenchData, writeWorkbenchData };
