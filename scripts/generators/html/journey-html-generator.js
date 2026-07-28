/**
 * JOURNEY PAGE (journey.html) — milestones timeline, expertise & tools, and
 * experience/roles. Split out of the old Community & Activity page per the
 * design blueprint §02–§04.
 *
 * Structural contract (blueprint):
 *   Milestones — continuous spine, display-type linked titles (titles wrap,
 *   never clamp), mono org line, descriptions shown in full (the blueprint's
 *   3-line clamp was dropped: it truncated real content mid-sentence).
 *   Entries flagged `highlight: true` show on arrival; the rest sit behind a
 *   two-way control, with year markers and a jump index alongside it.
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
const {
  buildMilestones,
  selectShown,
  summarize,
  formatYears,
  endYear,
} = require('../../services/milestones-model');

const FLAT_TIMELINE_MAX = 10;

const JOURNEY_CSS = `
  ${THEME_CSS_VARS}
  .jy-eyebrow{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-ink-3)}
  .jy-h2{font-family:inherit;font-weight:800;letter-spacing:-.01em;color:var(--t-ink)}
  .jy-tl{position:relative;padding-left:26px;max-width:660px}
  .jy-tl::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;border-radius:2px;
    background:linear-gradient(var(--t-brand-line),var(--t-line))}
  /* Anchored jumps have to clear both the fixed navbar (4rem) and the sticky
     control row, or the year you jumped to lands underneath them. */
  .jy-yr{font-family:ui-monospace,monospace;font-size:.8rem;font-weight:700;letter-spacing:.14em;
    color:var(--t-brand);margin:26px 0 4px;position:relative;scroll-margin-top:8rem}
  .jy-yr::before{content:"";position:absolute;left:-24px;top:7px;width:10px;height:2px;background:var(--t-brand-line)}
  #jy-milestones{scroll-margin-top:5rem}
  .jy-ms{position:relative;padding:14px 0 10px}
  .jy-ms::before{content:"";position:absolute;left:-24.5px;top:23px;width:11px;height:11px;border-radius:50%;
    background:var(--t-card);border:2.5px solid var(--t-brand);transition:transform .15s ease}
  .jy-ms:hover::before{transform:scale(1.25)}
  /* Highlighted entries keep their marker once the rest are revealed, so the
     reel stays legible in the expanded list too. */
  .jy-ms--hl::before{background:var(--t-brand);border-color:var(--t-brand);width:13px;height:13px;left:-25.5px;top:22px}
  .jy-star{color:var(--t-caution);margin-right:3px}
  .jy-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  @media (prefers-reduced-motion: reduce){.jy-ms::before{transition:none}}
  .jy-ms h3{font-size:1.16rem;font-weight:800;margin:0;line-height:1.32}
  /* Every title links to the evidence. Underlined at rest, not just on hover:
     hover doesn't exist on touch, and an unstyled link reads as plain text —
     which hides the proof behind an affordance nobody can see. */
  .jy-ms h3 a{color:var(--t-ink);text-decoration:underline;text-decoration-color:var(--t-brand-line);
    text-decoration-thickness:2px;text-underline-offset:3px}
  .jy-ms h3 a:hover{color:var(--t-brand);text-decoration-color:var(--t-brand)}
  .jy-ms h3 a:focus-visible{outline:2px solid var(--t-brand);outline-offset:3px;border-radius:3px}
  /* Roomier above than below: the title's underline sits close to its
     baseline, so 4px left the tag row crowding the link. */
  .jy-org{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.08em;color:var(--t-ink-3);margin:11px 0 7px}
  .jy-org b{color:var(--t-accent);font-weight:400}
  .jy-ms-tag{display:inline-flex;align-items:center;gap:4px;font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-accent);background:var(--t-card-2);border:1px solid var(--t-line);border-radius:999px;padding:1px 8px;margin-right:6px}
  .jy-desc{font-size:.9rem;color:var(--t-ink-2);margin:0;max-width:60ch}
  /* Sticky so the year chips and ★ Highlights stay reachable while you read
     down the timeline — no scrolling back up to switch view. Sits below the
     fixed navbar (z-50) and clears its 4rem height. */
  .jy-index{display:flex;gap:20px;flex-wrap:wrap;align-items:center;margin:0 0 18px;
    position:sticky;top:4rem;z-index:30;background:var(--t-surface);
    padding:10px 0 9px;border-bottom:1px solid var(--t-line)}
  /* The switch keeps button chrome and a lit state: it changes WHAT you see. */
  .jy-index button{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);
    background:none;border:1px solid var(--t-line);border-radius:6px;padding:3px 10px;cursor:pointer;line-height:1.6}
  .jy-index button:hover{color:var(--t-brand);border-color:var(--t-brand-line)}
  .jy-index button[aria-pressed="true"]{color:var(--t-caution);border-color:var(--t-caution-line);background:var(--t-caution-wash)}
  /* The year shortcuts drop that chrome entirely: they change WHERE you are.
     Styling them alike made shortcuts read as filters, and left the row with
     nothing marked active once a year was clicked. */
  .jy-jump{display:flex;flex-wrap:wrap;align-items:center;gap:11px}
  .jy-jump-label{font-family:ui-monospace,monospace;font-size:.72rem;letter-spacing:.1em;
    text-transform:uppercase;color:var(--t-ink-3)}
  .jy-jump a{font-family:ui-monospace,monospace;font-size:.78rem;color:var(--t-accent);
    text-decoration:none;border-bottom:1px solid transparent;padding-bottom:1px}
  .jy-jump a:hover{color:var(--t-brand);border-bottom-color:var(--t-brand)}
  .jy-index button:focus-visible,.jy-jump a:focus-visible,.jy-more button:focus-visible{outline:2px solid var(--t-brand);outline-offset:2px}
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
  @media (prefers-reduced-motion: reduce){.jy-chip{transition:none}}
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
  .jy-scale{font-size:.88rem;color:var(--t-ink-2);margin:-8px 0 20px}
`;

function renderMilestone(ach, hidden) {
  const org = escapeHtml(ach.org || '');
  const titleHtml = ach.url
    ? `<a href="${ach.url}" target="_blank" rel="noopener noreferrer">${ach.title}</a>`
    : ach.title;
  // Descriptions render in full — no clamp, so no `title` tooltip needed to
  // recover text the clamp had cut off.
  const descHtml = ach.description ? `<p class="jy-desc">${ach.description}</p>` : '';
  const tagHtml = ach.tag ? `<span class="jy-ms-tag">${ach.tag}</span>` : '';
  // The star is decorative; the accessible name carries the same meaning as
  // words so it isn't lost on a screen reader or when emoji don't render.
  const starHtml = ach.highlight
    ? `<span class="jy-sr">Highlighted: </span><span class="jy-star" aria-hidden="true">★</span>`
    : '';
  const classes = `jy-ms${ach.highlight ? ' jy-ms--hl' : ''}${hidden ? ' jy-hidden' : ''}`;
  return dedent`
    <article class="${classes}" data-earlier="${hidden ? '1' : '0'}">
      <h3>${starHtml}${titleHtml}</h3>
      <div class="jy-org">${tagHtml}<b>${org}</b> · ${formatYears(ach)}</div>
      ${descHtml}
    </article>
  `;
}

/**
 * The timeline arrives as a highlight reel: entries flagged `highlight: true`
 * show, the rest sit behind the "show more" control. Nothing is dropped —
 * hidden entries keep their chronological position, so expanding reveals
 * them in place rather than reordering the list.
 *
 * With nothing flagged yet, the newest HIGHLIGHT_FALLBACK entries stand in,
 * so the timeline can never render empty.
 *
 * Everything visible and ≤ FLAT_TIMELINE_MAX entries: flat spine, no year
 * markers, no collapse. Otherwise: year grouping + jump index + the control.
 */
function renderTimeline(sorted) {
  if (sorted.length === 0) {
    return `<p style="color:var(--t-ink-3)" class="italic">Milestones will appear here — add them in <code>contents/awards.js</code>, <code>courses.js</code>, <code>projects.js</code>, <code>docs.js</code>, <code>talks.js</code>, or <code>videos.js</code>.</p>`;
  }

  const { shown, hiddenCount, hasFlagged } = selectShown(sorted);

  if (hiddenCount === 0 && sorted.length <= FLAT_TIMELINE_MAX) {
    return `<div class="jy-tl">${sorted.map((a) => renderMilestone(a, false)).join('')}</div>`;
  }

  // A multi-year entry files under the year its work last touched, matching
  // the sort above. The Highlights chip sits with the years because that's
  // where you are when you want to get back to the reel — jumping to a year
  // expands the list, and without this the only way back was a page reload.
  const years = [...new Set(sorted.map((a) => endYear(a)))];
  const hlChip = hasFlagged
    ? `<button type="button" id="jy-show-highlights" aria-pressed="true">★ Highlights</button>`
    : '';
  const jumpNav = `<nav class="jy-jump" aria-label="Jump to year"><span class="jy-jump-label">Jump to:</span>${years
    .map((y) => `<a href="#jy-${y}">${y}</a>`)
    .join('')}</nav>`;
  const index = `<div class="jy-index">${hlChip}${jumpNav}</div>`;

  const groups = years
    .map((year) => {
      const items = sorted
        .filter((a) => endYear(a) === year)
        .map((a) => renderMilestone(a, !shown.has(a)))
        .join('');
      // A year marker collapses with its entries only when EVERY entry
      // under it is behind the "show earlier" control.
      const yrHidden = !items.includes('data-earlier="0"');
      return `<div class="jy-yr${yrHidden ? ' jy-hidden' : ''}" id="jy-${year}" data-earlier="${yrHidden ? '1' : '0'}">${year}</div>${items}`;
    })
    .join('');

  // Both labels ship in the markup so the count stays server-side and the
  // script never has to compose copy.
  const moreLabel = `Show ${hiddenCount} more milestone${hiddenCount === 1 ? '' : 's'} ↓`;
  const lessLabel = hasFlagged ? 'Show highlights only ↑' : 'Show fewer ↑';
  const more =
    hiddenCount > 0
      ? dedent`
        <div class="jy-more">
          <button type="button" id="jy-show-earlier" aria-expanded="false"
                  data-label-more="${escapeHtml(moreLabel)}" data-label-less="${escapeHtml(lessLabel)}">
            ${moreLabel}
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
      // Adjacent roles at the same org (e.g. two Virtual Coffee entries in a
      // row) would otherwise produce two links with identical text and
      // destination back to back — a "redundant link" a screen reader user
      // can't tell apart. The aria-label folds in the role title so each
      // link's accessible name stays unique without changing what's shown.
      const orgHtml = role.orgUrl
        ? `<a href="${role.orgUrl}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(role.org)} — ${escapeHtml(role.title)}">${escapeHtml(role.org)}</a>`
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

/**
 * @param {Object} rolesData contents/leadership.js — `roles` only.
 * @param {Object} skills    contents/skills.js
 * @param {Object} content   Milestone sources keyed as in MILESTONE_SOURCES
 *                           (awards, courses, projects, docs, talks, videos).
 */
async function createJourneyHtml(rolesData, skills, content = {}) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'journey.html');
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();
  const milestones = buildMilestones(content);
  const timeline = renderTimeline(milestones);
  const stats = summarize(milestones);
  const scaleLine = stats
    ? `<p class="jy-scale">${stats.count} milestones across ${stats.orgs} organizations, ${stats.from}\u2013${stats.to}.</p>`
    : '';
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
              <h1 class="jy-h2 text-4xl sm:text-5xl mt-2 mb-4">Roles, expertise, and the work behind them</h1>
            </header>

            <!-- Roles lead: they're the CV-shaped anchor a recruiter reads
                 first to place someone, before the evidence below. -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start mb-20">
              <section aria-labelledby="jy-xp">
                <h2 id="jy-xp" class="jy-sec-label">Experience &amp; roles</h2>
                ${experience}
              </section>
              <section aria-labelledby="jy-expertise">
                <h2 id="jy-expertise" class="jy-sec-label">Expertise</h2>
                ${expertise}
                ${toolsSection}
                ${skillsSection}
              </section>
            </div>

            <section aria-labelledby="jy-milestones">
              <h2 id="jy-milestones" class="jy-sec-label">Selected work</h2>
              ${scaleLine}
              ${timeline}
            </section>
          </div>
        </div>
      </main>
      <script>
        (function () {
          var btn = document.getElementById('jy-show-earlier');
          if (!btn) return;
          var hlBtn = document.getElementById('jy-show-highlights');
          var expanded = false;

          function setExpanded(next) {
            expanded = next;
            document.querySelectorAll('[data-earlier="1"]').forEach(function (el) {
              el.classList.toggle('jy-hidden', !expanded);
            });
            btn.setAttribute('aria-expanded', String(expanded));
            btn.textContent = expanded
              ? btn.getAttribute('data-label-less')
              : btn.getAttribute('data-label-more');
            if (hlBtn) hlBtn.setAttribute('aria-pressed', String(!expanded));
          }

          // Either toggle direction reflows the list around wherever you're
          // standing — expanding inserts entries above the button, collapsing
          // pulls the ground out from under you — so both return to the top
          // of the section rather than leaving you mid-timeline.
          function scrollToSection() {
            var top = document.getElementById('jy-milestones');
            if (!top) return;
            var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            top.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          }

          btn.addEventListener('click', function () {
            setExpanded(!expanded);
            scrollToSection();
          });

          if (hlBtn) {
            hlBtn.addEventListener('click', function () {
              setExpanded(false);
              scrollToSection();
            });
          }

          // Picking a year means "show me that year", so it always expands:
          // otherwise the year opens holding only its highlighted entries,
          // which is the one view the year chips exist to get you out of.
          document.querySelectorAll('.jy-jump a').forEach(function (link) {
            link.addEventListener('click', function () {
              setExpanded(true);
            });
          });

          setExpanded(false);
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
