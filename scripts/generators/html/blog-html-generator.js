/**
 * WRITING PAGE (writing.html) — articles only. Talks live exclusively on the
 * Journey timeline (design blueprint) — no Talks chip, no talks slot here.
 *
 * Structural contract:
 *   1. "Written for organizations" timeline — every article with `org` set
 *      (freeCodeCamp + Dev.to org posts), grouped into one node per org on a
 *      continuous spine, orgs ordered by their most recent piece. Renders
 *      only when at least one org article exists.
 *   2. Personal writing list — only articles with org = null/missing, newest
 *      first: title (2-line clamp, full text in `title`), date, tags.
 * An article renders in exactly one place — the timeline or the list, never
 * both.
 *
 * Platform labels and the filter chips are data-driven: both appear only
 * when a list actually spans more than one platform. With a single-platform
 * list the label states nothing the reader can act on and the filter has
 * nothing to filter, so neither renders.
 */
const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { GITHUB_USERNAME, BASE_DIR } = require('../../config/config');
const { FAVICON_SVG_ENCODED, THEME_CSS_VARS } = require('../../config/constants');
const {
  createNavHtml,
  createSkipToContentHtml,
  createBackToTopHtml,
  getBackToTopScript,
  SHARED_CHROME_CSS,
} = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { getThemeInitScript, getThemeStyleVariant } = require('../../components/theme-init');
const { escapeHtml } = require('../../utils/escape-html');
const { newestFirst, platformsIn, groupByOrg } = require('../../services/writing-model');

const WRITING_CSS = `
  ${THEME_CSS_VARS}
  .wr-eyebrow{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-ink-3)}
  .wr-h1{font-weight:800;letter-spacing:-.01em;color:var(--t-ink)}
  .wr-sub{color:var(--t-ink-2);font-size:.95rem;max-width:64ch;margin:8px 0 0}
  .wr-sec-label{font-family:ui-monospace,monospace;font-size:.78rem;font-weight:400;letter-spacing:.13em;text-transform:uppercase;color:var(--t-ink-3);margin-bottom:16px}
  .wr-tl{position:relative;padding-left:26px;max-width:760px}
  .wr-tl::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:2px;border-radius:2px;
    background:linear-gradient(var(--t-brand-line),var(--t-line))}
  .wr-org{position:relative;padding:4px 0 20px}
  .wr-org:last-child{padding-bottom:2px}
  .wr-org::before{content:"";position:absolute;left:-24.5px;top:9px;width:11px;height:11px;border-radius:50%;
    background:var(--t-card);border:2.5px solid var(--t-brand)}
  .wr-org-h{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:0}
  .wr-org-name{font-size:1.06rem;font-weight:800;letter-spacing:-.01em;color:var(--t-brand);overflow-wrap:anywhere}
  .wr-org-n{font-family:ui-monospace,monospace;font-size:.75rem;font-weight:600;color:var(--t-on-brand);background:var(--t-brand);border:1px solid var(--t-brand);border-radius:999px;padding:1px 9px}
  .wr-personal-h-row{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-bottom:16px}
  .wr-personal{max-width:760px}
  .wr-list{list-style:none;margin:6px 0 0;padding:0}
  .wr-item{padding:10px 0;border-bottom:1px solid var(--t-line)}
  .wr-item:last-child{border-bottom:0}
  .wr-item.wr-hidden{display:none}
  .wr-item-t{font-size:.95rem;font-weight:600;margin:0;line-height:1.4}
  .wr-item-t a{color:var(--t-ink);text-decoration:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
  .wr-item-t a:hover{color:var(--t-brand)}
  .wr-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);margin-top:4px}
  .wr-platform{color:var(--t-ink-2);font-weight:600}
  .wr-tags{display:flex;flex-wrap:wrap;gap:6px}
  .wr-tag{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-2);background:var(--t-card-2);border:1px solid var(--t-line);border-radius:6px;padding:1px 8px}
  .wr-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
  .wr-chip{font-family:ui-monospace,monospace;font-size:.78rem;color:var(--t-ink-2);background:var(--t-card-2);border:1px solid var(--t-line);border-radius:999px;padding:6px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:border-color .15s ease,color .15s ease,background .15s ease}
  .wr-chip:hover{border-color:var(--t-brand-line);color:var(--t-brand)}
  .wr-chip:focus-visible{outline:2px solid var(--t-brand);outline-offset:2px}
  .wr-chip[aria-pressed="true"]{color:var(--t-brand);background:var(--t-brand-wash);border-color:var(--t-brand-line)}
  .wr-chip-n{opacity:.75}
  .wr-empty{color:var(--t-ink-3);font-style:italic;font-size:.9rem}
  @media (prefers-reduced-motion: reduce){.wr-chip{transition:none}}
`;

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderArticleItem(article, { showPlatform, headingTag }) {
  const title = escapeHtml(article.title);
  const platform = article.platform || '';
  const safePlatform = escapeHtml(platform);
  const tagsHtml = (article.tags || [])
    .map((t) => `<span class="wr-tag">${escapeHtml(t)}</span>`)
    .join('');
  const platformHtml =
    showPlatform && platform ? `<span class="wr-platform">${safePlatform}</span>` : '';
  return dedent`
    <li class="wr-item" data-platform="${safePlatform}">
      <${headingTag} class="wr-item-t">
        <a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">${title}</a>
      </${headingTag}>
      <div class="wr-meta">
        ${platformHtml}
        <span>${formatDate(article.date)}</span>
        ${tagsHtml ? `<span class="wr-tags">${tagsHtml}</span>` : ''}
      </div>
    </li>
  `;
}

function renderOrgTimeline(orgArticles) {
  if (orgArticles.length === 0) return '';
  const nodes = groupByOrg(orgArticles)
    .map(({ org, items }) => {
      const showPlatform = platformsIn(items).length > 1;
      const list = items
        .map((a) => renderArticleItem(a, { showPlatform, headingTag: 'h4' }))
        .join('');
      return dedent`
        <div class="wr-org">
          <div class="wr-org-h">
            <h3 class="wr-org-name">${escapeHtml(org)}</h3>
            <span class="wr-org-n">${items.length} article${items.length === 1 ? '' : 's'}</span>
          </div>
          <ul class="wr-list">${list}</ul>
        </div>`;
    })
    .join('');

  return dedent`
    <section aria-labelledby="wr-org-h" class="mb-16">
      <h2 id="wr-org-h" class="wr-sec-label">Written for organizations</h2>
      <div class="wr-tl">${nodes}</div>
    </section>
  `;
}

/**
 * Chips only earn their place once there's more than one platform to choose
 * between — with a single-platform list every chip selects everything.
 */
function renderFilters(personalArticles) {
  const platforms = platformsIn(personalArticles);
  if (platforms.length < 2) return '';
  const chips = [
    `<button type="button" class="wr-chip" data-filter="all" aria-pressed="true">All <span class="wr-chip-n">${personalArticles.length}</span></button>`,
  ];
  for (const platform of platforms) {
    const count = personalArticles.filter((a) => a.platform === platform).length;
    chips.push(
      `<button type="button" class="wr-chip" data-filter="${escapeHtml(platform)}" aria-pressed="false">${escapeHtml(platform)} <span class="wr-chip-n">${count}</span></button>`
    );
  }
  return `<div class="wr-filters" role="group" aria-label="Filter by platform">${chips.join('')}</div>`;
}

function renderPersonalSection(personalArticles, hasOrgArticles) {
  if (personalArticles.length === 0) {
    const msg = hasOrgArticles
      ? 'No personal writing yet — see the organization pieces above.'
      : 'No articles found with Open Source or GitHub tags.';
    return `<p class="wr-empty">${msg}</p>`;
  }
  const showPlatform = platformsIn(personalArticles).length > 1;
  const list = newestFirst(personalArticles)
    .map((a) => renderArticleItem(a, { showPlatform, headingTag: 'h3' }))
    .join('');
  return dedent`
    <div class="wr-personal">
      ${renderFilters(personalArticles)}
      <ul class="wr-list">${list}</ul>
    </div>
  `;
}

async function createBlogHtml(articles) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  // Renamed to writing.html in the IA restructure (design blueprint §02);
  // blog.html is kept as a redirect stub for old links (see main.js).
  const outputPath = path.join(htmlBaseDir, 'writing.html');

  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();

  const orgArticles = (articles || []).filter((a) => Boolean(a.org));
  const personalArticles = (articles || []).filter((a) => !a.org);

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Writing | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      ${getThemeInitScript()}
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      ${getThemeStyleVariant()}
      <style>${WRITING_CSS}${SHARED_CHROME_CSS}</style>
    </head>
    <body style="background-color: var(--t-surface); color: var(--t-ink);" class="antialiased flex flex-col h-full min-h-full">
      ${createSkipToContentHtml('main')}
      ${navHtml}
      <main id="main" class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-6xl mx-auto">
            <header class="mt-16 mb-14">
              <p class="wr-eyebrow">writing</p>
              <h1 class="wr-h1 text-4xl sm:text-5xl mt-2 mb-4">Articles on open source and GitHub</h1>
              <p class="wr-sub">Guides and blog posts covering open source, its community, and the GitHub ecosystem.</p>
            </header>

            ${renderOrgTimeline(orgArticles)}

            <section aria-labelledby="wr-personal-h">
              <div class="wr-personal-h-row">
                <h2 id="wr-personal-h" class="wr-sec-label" style="margin-bottom:0">Personal writing</h2>
                ${personalArticles.length > 0 ? `<span class="wr-org-n">${personalArticles.length} article${personalArticles.length === 1 ? '' : 's'}</span>` : ''}
              </div>
              ${renderPersonalSection(personalArticles, orgArticles.length > 0)}
            </section>
          </div>
        </div>
      </main>
      <script>
        (function () {
          var buttons = document.querySelectorAll('.wr-chip');
          var items = document.querySelectorAll('.wr-personal .wr-item');
          if (!buttons.length || !items.length) return;
          buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
              buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
              btn.setAttribute('aria-pressed', 'true');
              var filter = btn.getAttribute('data-filter');
              items.forEach(function (item) {
                var show = filter === 'all' || item.getAttribute('data-platform') === filter;
                item.classList.toggle('wr-hidden', !show);
              });
            });
          });
        })();
      </script>
      ${footerHtml}
      ${createBackToTopHtml()}
      ${getBackToTopScript()}
    </body>
    </html>`;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(outputPath, formattedContent, 'utf8');
  console.log(`Generated Writing page at ${outputPath}`);
}

module.exports = { createBlogHtml };
