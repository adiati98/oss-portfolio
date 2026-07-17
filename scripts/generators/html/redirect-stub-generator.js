/**
 * Stubs for pages that moved in the IA restructure (blueprint §02).
 *
 * HTML — a real meta-refresh redirect:
 *   blog.html               → writing.html
 *   community-activity.html → journey.html (its recruiter-facing half; the
 *                             workbench half lives at workbench.html)
 *
 * Markdown — GitHub renders .md but won't follow a redirect, so the old
 * files become short pointers instead of stale copies of the data:
 *   blog.md               → writing.md
 *   community-activity.md → journey.md + workbench.md
 *
 * Old links keep working; nothing 404s, and nothing serves stale numbers.
 * Nothing generated ever links to these stubs as a primary destination.
 */
const fs = require('fs/promises');
const path = require('path');
const { BASE_DIR } = require('../../config/config');

function stubHtml(target, label) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${target}">
  <title>Moved — ${label}</title>
</head>
<body>
  <p>This page moved to <a href="${target}">${label}</a>.</p>
</body>
</html>
`;
}

/** @param {Array<[string,string]>} targets [file, label] pairs */
function stubMarkdown(title, targets) {
  const links = targets.map(([file, label]) => `* [**${label}**](./${file})`).join('\n');
  return `# ${title} — moved

This page has moved. It's now generated as:

${links}

_This file is kept so older links keep resolving; it is no longer updated._
`;
}

async function createRedirectStubs() {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const mdBaseDir = path.join(BASE_DIR, 'markdown-generated');
  await fs.mkdir(htmlBaseDir, { recursive: true });
  await fs.mkdir(mdBaseDir, { recursive: true });

  await fs.writeFile(
    path.join(htmlBaseDir, 'blog.html'),
    stubHtml('writing.html', 'Writing & Talks'),
    'utf8'
  );
  await fs.writeFile(
    path.join(htmlBaseDir, 'community-activity.html'),
    stubHtml('journey.html', 'Journey'),
    'utf8'
  );

  await fs.writeFile(
    path.join(mdBaseDir, 'blog.md'),
    stubMarkdown('Open Source and GitHub Articles', [['writing.md', 'Writing & Talks']]),
    'utf8'
  );
  await fs.writeFile(
    path.join(mdBaseDir, 'community-activity.md'),
    stubMarkdown('Community & Activity', [
      ['journey.md', 'Journey — milestones & roles'],
      ['workbench.md', 'Active Workbench — live tasks'],
    ]),
    'utf8'
  );

  console.log(
    'Generated redirect stubs: blog.html → writing.html, community-activity.html → journey.html, ' +
      'blog.md → writing.md, community-activity.md → journey.md + workbench.md'
  );
}

module.exports = { createRedirectStubs };
