const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Full resync: re-verifies every contribution against live GitHub data
 * instead of trusting any cache — same intent as `npm run clean` + `npm
 * start` — but deliberately leaves data/all-contributions.json in place.
 * That file is the only fallback the merge logic in main.js has when a
 * given run's GitHub Search results happen to miss something (Search API
 * results aren't guaranteed consistent); deleting it removes the one thing
 * that makes a transient Search miss recoverable instead of silent data loss.
 */
const cacheFiles = [
  'commit-cache.json',
  'pr-cache.json',
  'failed-fetch.json',
  'workbench-activity-cache.json',
  'all-articles.json',
  'ongoing-tasks.json',
  'ongoing-issues.json',
  'ongoing-prs.json',
  'ongoing-coauthored-prs.json',
];

for (const file of cacheFiles) {
  const filePath = path.join('data', file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted: ${filePath}`);
  }
}

console.log('🔄 Running full resync (all-contributions.json kept as a fallback)...');
const result = spawnSync('node', ['scripts/src/main.js'], {
  stdio: 'inherit',
  env: { ...process.env, FULL_RESYNC: 'true' },
});
process.exit(result.status ?? 1);
