/**
 * Redirect stubs for pages that moved in the IA restructure (blueprint §02):
 *   blog.html               → writing.html
 *   community-activity.html → journey.html (its recruiter-facing half; the
 *                             workbench half lives at workbench.html)
 * Old links keep working; nothing 404s.
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

async function createRedirectStubs() {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  await fs.mkdir(htmlBaseDir, { recursive: true });
  await fs.writeFile(path.join(htmlBaseDir, 'blog.html'), stubHtml('writing.html', 'Writing & Talks'), 'utf8');
  await fs.writeFile(
    path.join(htmlBaseDir, 'community-activity.html'),
    stubHtml('journey.html', 'Journey'),
    'utf8'
  );
  console.log('Generated redirect stubs: blog.html → writing.html, community-activity.html → journey.html');
}

module.exports = { createRedirectStubs };
