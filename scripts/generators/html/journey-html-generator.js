/**
 * JOURNEY PAGE (journey.html) — milestones timeline, expertise & tools, and
 * experience/roles. Split out of the old Community & Activity page per the
 * design blueprint §02–§04.
 *
 * Structural contract (blueprint):
 *   Milestones — continuous spine, display-type linked titles (titles wrap,
 *   never clamp), mono org line, 3-line-clamped descriptions. ≤10 entries
 *   render flat; above that they group under year markers with a jump index
 *   and a "show earlier" collapse.
 *   Expertise & tools — no proficiency bars; expertise rows + flat chip row.
 *   Experience — active roles get a positive dot + tinted rule; past roles
 *   recede to neutral. No ACTIVE/PAST badges.
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

const FLAT_TIMELINE_MAX = 10;

const JOURNEY_CSS = `
  ${THEME_CSS_VARS}
  .jy-eyebrow{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-ink-3)}
  .jy-h2{font-family:inherit;font-weight:800;letter-spacing:-.01em;color:var(--t-ink)}
  .jy-tl{position:relative;padding-left:26px;max-width:660px}
  .jy-tl::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;border-radius:2px;
    background:linear-gradient(var(--t-brand-line),var(--t-line))}
  .jy-yr{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.14em;color:var(--t-ink-3);margin:26px 0 4px;position:relative}
  .jy-yr::before{content:"";position:absolute;left:-24px;top:6px;width:10px;height:2px;background:var(--t-line-2)}
  .jy-ms{position:relative;padding:14px 0 10px}
  .jy-ms::before{content:"";position:absolute;left:-24.5px;top:23px;width:11px;height:11px;border-radius:50%;
    background:var(--t-card);border:2.5px solid var(--t-brand);transition:transform .15s ease}
  .jy-ms:hover::before{transform:scale(1.25)}
  @media (prefers-reduced-motion: reduce){.jy-ms::before{transition:none}}
  .jy-ms h3{font-size:1.16rem;font-weight:800;margin:0;line-height:1.25}
  .jy-ms h3 a{color:var(--t-ink);text-decoration:none}
  .jy-ms h3 a:hover{color:var(--t-brand)}
  .jy-ms .jy-arr{display:inline-block;color:var(--t-brand);transition:transform .18s ease;margin-left:4px}
  .jy-ms:hover .jy-arr{transform:translate(3px,-3px)}
  .jy-org{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.08em;color:var(--t-ink-3);margin:4px 0 6px}
  .jy-org b{color:var(--t-accent);font-weight:400}
  .jy-ms-tag{display:inline-flex;align-items:center;gap:4px;font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-accent);background:var(--t-card-2);border:1px solid var(--t-line);border-radius:999px;padding:1px 8px;margin-right:6px}
  .jy-desc{font-size:.9rem;color:var(--t-ink-2);margin:0;max-width:56ch;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .jy-index{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
  .jy-index a{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);border:1px solid var(--t-line);border-radius:6px;padding:2px 9px;text-decoration:none}
  .jy-index a:hover{color:var(--t-brand);border-color:var(--t-brand-line)}
  .jy-more{margin:20px 0 4px}
  .jy-more button{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-brand);background:none;border:1px dashed var(--t-brand-line);border-radius:8px;padding:7px 16px;cursor:pointer}
  .jy-more button:hover{background:var(--t-brand-wash)}
  .jy-hidden{display:none}
  .jy-expertise{padding:13px 0;border-bottom:1px solid var(--t-line)}
  .jy-expertise:last-of-type{border-bottom:0}
  .jy-expertise b{display:block;font-size:1.02rem;font-weight:800;color:var(--t-ink)}
  .jy-expertise span{font-size:.85rem;color:var(--t-ink-2);display:block;margin-top:3px;max-width:52ch}
  .jy-chips{display:flex;flex-wrap:wrap;gap:8px}
  .jy-chip{font-family:ui-monospace,monospace;font-size:.76rem;color:var(--t-ink-2);background:var(--t-card-2);border:1px solid var(--t-line);border-radius:8px;padding:5px 13px;transition:border-color .15s ease,color .15s ease}
  .jy-chip:hover{border-color:var(--t-brand-line);color:var(--t-brand)}
  .jy-chip--hd{color:var(--t-brand);background:var(--t-brand-wash);border-color:var(--t-brand-line)}
  @media (prefers-reduced-motion: reduce){.jy-chip,.jy-ms .jy-arr{transition:none}}
  .jy-xp{padding:12px 0 12px 18px;border-left:2px solid var(--t-line);position:relative}
  .jy-xp::before{content:"";position:absolute;left:-5px;top:20px;width:8px;height:8px;border-radius:50%;background:var(--t-neutral)}
  .jy-xp--active::before{background:var(--t-positive)}
  .jy-xp--active{border-left-color:var(--t-positive-line)}
  .jy-xp h3{font-size:1rem;font-weight:800;margin:0;color:var(--t-ink)}
  .jy-xp .jy-xp-org{font-size:.85rem;color:var(--t-ink-2)}
  .jy-xp .jy-xp-org a{color:var(--t-accent)}
  .jy-xp .jy-xp-per{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);margin-top:2px}
  .jy-xp .jy-xp-per b{color:var(--t-positive);font-weight:400}
  .jy-sec-label{font-family:ui-monospace,monospace;font-size:.78rem;font-weight:400;letter-spacing:.13em;text-transform:uppercase;color:var(--t-ink-3);margin-bottom:16px}
`;

function renderMilestone(ach, hidden) {
  const org = escapeHtml(ach.org || '');
  const titleHtml = ach.url
    ? `<a href="${ach.url}" target="_blank" rel="noopener noreferrer">${ach.title}<span class="jy-arr" aria-hidden="true">↗</span></a>`
    : ach.title;
  const descHtml = ach.description
    ? `<p class="jy-desc" title="${escapeHtml(ach.description)}">${ach.description}</p>`
    : '';
  const tagHtml = ach.tag ? `<span class="jy-ms-tag">${ach.tag}</span>` : '';
  return dedent`
    <article class="jy-ms${hidden ? ' jy-hidden' : ''}" data-earlier="${hidden ? '1' : '0'}">
      <h3>${titleHtml}</h3>
      <div class="jy-org">${tagHtml}<b>${org}</b> · ${ach.year}</div>
      ${descHtml}
    </article>
  `;
}

/**
 * Talks (contents/talks.js) join the timeline as milestones with a 🎤 Talk
 * chip — same shape as achievements, just mapped from the talk fields
 * (event → org, blurb → description). An empty talks list contributes
 * nothing.
 */
function normalizeTalks(talks) {
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
 * ≤ FLAT_TIMELINE_MAX entries: flat spine, no year markers, no collapse.
 * Above: year grouping + jump index + "show earlier" beyond the 10 newest.
 */
function renderTimeline(achievements) {
  const sorted = [...achievements].sort((a, b) => (b.year || 0) - (a.year || 0));
  if (sorted.length === 0) {
    return `<p style="color:var(--t-ink-3)" class="italic">Milestones will appear here — add them in <code>contents/leadership.js</code>.</p>`;
  }

  if (sorted.length <= FLAT_TIMELINE_MAX) {
    return `<div class="jy-tl">${sorted.map((a) => renderMilestone(a, false)).join('')}</div>`;
  }

  const years = [...new Set(sorted.map((a) => a.year))];
  const index = `<nav class="jy-index" aria-label="Jump to year">${years
    .map((y) => `<a href="#jy-${y}">${y}</a>`)
    .join('')}</nav>`;

  let rendered = 0;
  const groups = years
    .map((year) => {
      const items = sorted
        .filter((a) => a.year === year)
        .map((a) => renderMilestone(a, rendered++ >= FLAT_TIMELINE_MAX))
        .join('');
      // A year marker collapses with its entries only when EVERY entry
      // under it is behind the "show earlier" control.
      const yrHidden = !items.includes('data-earlier="0"');
      return `<div class="jy-yr${yrHidden ? ' jy-hidden' : ''}" id="jy-${year}" data-earlier="${yrHidden ? '1' : '0'}">${year}</div>${items}`;
    })
    .join('');

  const earlierCount = sorted.length - FLAT_TIMELINE_MAX;
  const more =
    earlierCount > 0
      ? dedent`
        <div class="jy-more">
          <button type="button" id="jy-show-earlier" aria-expanded="false">
            Show ${earlierCount} earlier milestone${earlierCount === 1 ? '' : 's'} ↓
          </button>
        </div>`
      : '';

  return `${index}<div class="jy-tl">${groups}${more}</div>`;
}

function renderChipSection(label, items, highlight) {
  if (!items || items.length === 0) return '';
  const chips = items
    .map(
      (t) =>
        `<span class="jy-chip${highlight.has(t.toLowerCase()) ? ' jy-chip--hd' : ''}">${t}</span>`
    )
    .join('');
  return `<h2 class="jy-sec-label" style="margin-top:26px">${label}</h2><div class="jy-chips">${chips}</div>`;
}

function renderExpertiseAndTools(skills) {
  const expertise = (skills.expertise || [])
    .map(
      (c) => dedent`
        <div class="jy-expertise">
          <b>${c.title}</b>
          ${c.blurb ? `<span>${c.blurb}</span>` : ''}
        </div>`
    )
    .join('');
  const highlight = new Set((skills.highlight || []).map((t) => t.toLowerCase()));
  const toolsSection = renderChipSection('Tools', skills.tools, highlight);
  const skillsSection = renderChipSection('Skills', skills.skills, highlight);
  if (!expertise && !toolsSection && !skillsSection) {
    return {
      expertise: `<p style="color:var(--t-ink-3)" class="italic">Expertise will appear here — add it in <code>contents/skills.js</code>.</p>`,
      toolsSection: '',
      skillsSection: '',
    };
  }
  return { expertise, toolsSection, skillsSection };
}

function renderExperience(roles) {
  if (!roles || roles.length === 0) {
    return `<p style="color:var(--t-ink-3)" class="italic">Roles will appear here — add them in <code>contents/leadership.js</code>.</p>`;
  }
  return roles
    .map((role) => {
      const orgHtml = role.orgUrl
        ? `<a href="${role.orgUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(role.org)}</a>`
        : escapeHtml(role.org || '');
      const period = role.active
        ? `${String(role.period || '').replace(/ ?- ?Present$/i, '')} — <b>present</b>`
        : role.period || '';
      return dedent`
        <div class="jy-xp${role.active ? ' jy-xp--active' : ''}">
          <h3>${role.title}</h3>
          <div class="jy-xp-org">${orgHtml}</div>
          <div class="jy-xp-per">${period}</div>
        </div>`;
    })
    .join('');
}

async function createJourneyHtml(rolesData, skills, talks) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'journey.html');
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();
  const milestones = [...(rolesData.achievements || []), ...normalizeTalks(talks)];
  const timeline = renderTimeline(milestones);
  const { expertise, toolsSection, skillsSection } = renderExpertiseAndTools(skills || {});
  const experience = renderExperience(rolesData.roles || []);

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Journey | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      ${getThemeInitScript()}
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      ${getThemeStyleVariant()}
      <style>${JOURNEY_CSS}${SHARED_CHROME_CSS}</style>
    </head>
    <body style="background-color: var(--t-surface); color: var(--t-ink);" class="antialiased flex flex-col h-full min-h-full">
      ${createSkipToContentHtml('main')}
      ${navHtml}
      <main id="main" class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-6xl mx-auto">
            <header class="mt-16 mb-14">
              <p class="jy-eyebrow">journey</p>
              <h1 class="jy-h2 text-4xl sm:text-5xl mt-2 mb-4">Milestones, expertise, and the roles behind them</h1>
            </header>

            <section aria-labelledby="jy-milestones" class="mb-20">
              <h2 id="jy-milestones" class="jy-sec-label">Milestones</h2>
              ${timeline}
            </section>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
              <section aria-labelledby="jy-expertise">
                <h2 id="jy-expertise" class="jy-sec-label">Expertise</h2>
                ${expertise}
                ${toolsSection}
                ${skillsSection}
              </section>
              <section aria-labelledby="jy-xp">
                <h2 id="jy-xp" class="jy-sec-label">Experience &amp; roles</h2>
                ${experience}
              </section>
            </div>
          </div>
        </div>
      </main>
      <script>
        (function () {
          var btn = document.getElementById('jy-show-earlier');
          if (!btn) return;
          btn.addEventListener('click', function () {
            document.querySelectorAll('[data-earlier="1"]').forEach(function (el) {
              el.classList.remove('jy-hidden');
            });
            btn.setAttribute('aria-expanded', 'true');
            btn.parentElement.remove();
          });
        })();
      </script>
      ${footerHtml}
      ${createBackToTopHtml()}
      ${getBackToTopScript()}
    </body>
    </html>
  `;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(outputPath, formattedContent, 'utf8');
  console.log(`Generated Journey page at ${outputPath}`);
}

module.exports = { createJourneyHtml, renderTimeline, FLAT_TIMELINE_MAX };
