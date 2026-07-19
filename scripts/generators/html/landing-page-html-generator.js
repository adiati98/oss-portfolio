/**
 * HOME PAGE (index.html) — the recruiter-facing front door (design
 * blueprint §02, Home walkthrough tab).
 *
 * Reading order, top to bottom:
 *   Hero band      — radial brand wash, name with the surname in the
 *                    brand→accent gradient, one plain-language line.
 *   Impact band    — lifetime framing, completed work first, liveness on
 *                    the right. Reuses the workbench's impact tile pattern
 *                    so Home, Workbench, and the quarterly reports all
 *                    speak one visual language.
 *   Contribution   — one brand hue, label + % always visible. No rainbow
 *   mix meters       categories, no persona-colored rows.
 *   Primary focus  — the repos the work actually lands in.
 *   Persona seal   — compact; `determinePersona` is untouched.
 *   Index row      — quiet, text-first links into the other pages.
 *
 * Dropped in the rebuild: the emoji tile cards, and the stat blocks that
 * repeated the same five numbers the meters already carry.
 *
 * Every color comes from a --t-* token, so both themes and any fork's five
 * seeds flow through without theme-specific markup.
 */
const fs = require('fs/promises');
const path = require('path');
const prettier = require('prettier');
const { dedent } = require('../../utils/dedent');
const { GITHUB_USERNAME, BASE_DIR, PROFILE } = require('../../config/config');
const {
  createNavHtml,
  createSkipToContentHtml,
  createBackToTopHtml,
  getBackToTopScript,
  SHARED_CHROME_CSS,
} = require('../../components/navbar');
const { createFooterHtml } = require('../../components/footer');
const { personaCategories, DEFAULT_PERSONA } = require('../../metadata/personas');
const { FAVICON_SVG_ENCODED, THEME_CSS_VARS } = require('../../config/constants');
const { getThemeInitScript, getThemeStyleVariant } = require('../../components/theme-init');
const { escapeHtml } = require('../../utils/escape-html');

const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
const HTML_OUTPUT_PATH = path.join(htmlBaseDir, 'index.html');

const LANDING_CSS = `
  ${THEME_CSS_VARS}
  .lp-eyebrow{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-ink-3)}
  .lp-hero{background:
      radial-gradient(130% 170% at 10% -10%,var(--t-brand-wash),transparent 62%),
      radial-gradient(90% 140% at 100% 0%,var(--t-accent-wash),transparent 55%);
    border:1px solid var(--t-line);border-radius:16px;padding:30px 32px 26px}
  .lp-hero h1{font-size:clamp(1.9rem,4.4vw,3rem);font-weight:800;letter-spacing:-.015em;line-height:1.12;margin:6px 0 8px;color:var(--t-ink)}
  .lp-grad{background:linear-gradient(98deg,var(--t-brand) 10%,var(--t-accent) 90%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .lp-hero p{color:var(--t-ink-2);font-size:.95rem;max-width:60ch;margin:0}
  /* container-type lets .lp-tiles react to the card's own rendered width
     (below) instead of the viewport's — the card no longer tracks the
     viewport 1:1 now that it's capped to the Contribution mix column
     width on wide screens. */
  .lp-impact{container-type:inline-size;background:var(--t-card);border:1px solid var(--t-line);border-radius:14px;overflow:hidden;margin-top:22px;box-shadow:var(--t-shadow)}
  .lp-impact-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--t-line);
    background:linear-gradient(120deg,var(--t-brand-wash),var(--t-card-2) 62%)}
  .lp-impact-top h2{font-size:1.05rem;font-weight:800;margin:0;color:var(--t-ink)}
  .lp-impact-top h2 span{color:var(--t-ink-2);font-weight:400;font-size:.86rem}
  /* Above the .lp-cols breakpoint, match the hero/impact card width to the
     Contribution mix column exactly: that column is one of two
     minmax(0,1fr) tracks with a 40px gap, so its width is always
     calc(50% - 20px) of the same container these cards sit in. Below the
     breakpoint .lp-cols collapses to one column (full width), so the cap
     is scoped to only apply once that second column exists. */
  @media (min-width:861px){
    .lp-hero,.lp-impact{max-width:calc(50% - 20px)}
  }
  .lp-live{display:inline-flex;align-items:center;gap:7px;font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.09em;text-transform:uppercase;color:var(--t-positive)}
  .lp-live i{width:8px;height:8px;border-radius:50%;background:var(--t-positive);position:relative}
  .lp-live i::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--t-positive);animation:lp-ping 2.4s ease-out infinite}
  @keyframes lp-ping{0%{transform:scale(.6);opacity:.8}100%{transform:scale(1.6);opacity:0}}
  @media (prefers-reduced-motion: reduce){.lp-live i::after{animation:none}}
  .lp-live--stale{color:var(--t-caution)}
  .lp-live--stale i{background:var(--t-caution)}
  .lp-live--stale i::after{content:none}
  .lp-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
  @container (max-width:600px){.lp-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .lp-tile{min-width:0;padding:16px 18px;border-right:1px solid var(--t-line);display:flex;flex-direction:column;gap:3px;transition:background .18s ease}
  .lp-tile:last-child{border-right:0}
  @container (max-width:600px){.lp-tile{border-top:1px solid var(--t-line)}.lp-tile:nth-child(2n){border-right:0}}
  .lp-tile .n{font-weight:800;font-size:2.05rem;line-height:1.08;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--t-ink);overflow-wrap:anywhere}
  .lp-tile .n small{font-size:1.05rem;color:var(--t-ink-2)}
  .lp-tile .c{font-size:.76rem;color:var(--t-ink-2);line-height:1.35}
  .lp-tile--hero{background:linear-gradient(150deg,var(--t-brand-strong),var(--t-brand))}
  .lp-tile--hero .n,.lp-tile--hero .n small,.lp-tile--hero .c{color:var(--t-on-brand)}
  .lp-tile--hero .c2{color:var(--t-on-brand);font-size:.7rem;font-weight:500;margin-top:1px}
  @media (prefers-reduced-motion: reduce){.lp-tile{transition:none}}
  .lp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:start;margin-top:30px}
  @media (max-width:860px){.lp-cols{grid-template-columns:minmax(0,1fr)}}
  .lp-h3{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.13em;text-transform:uppercase;color:var(--t-ink-3);margin:0 0 12px}
  .lp-meters{max-width:520px}
  .lp-m{display:flex;flex-direction:column;gap:4px;padding:7px 0}
  .lp-m .r{display:flex;justify-content:space-between;gap:10px;font-size:.82rem}
  .lp-m .r b{font-weight:600;color:var(--t-ink)}
  .lp-m .r span{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3)}
  .lp-m .bar{height:4px;border-radius:2px;background:var(--t-neutral-wash)}
  .lp-m .bar i{display:block;height:100%;border-radius:2px;background:var(--t-brand);opacity:.85}
  .lp-focus{display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--t-line);max-width:520px}
  .lp-focus:last-of-type{border-bottom:0}
  .lp-focus a{font-weight:600;color:var(--t-ink);text-decoration:none;min-width:0;overflow-wrap:anywhere}
  .lp-focus a:hover{color:var(--t-brand)}
  .lp-focus a .o{color:var(--t-ink-3);font-weight:400}
  .lp-focus span{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);white-space:nowrap;flex-shrink:0}
  /* On narrow screens a long org/repo name wraps onto two lines, but as a
     row-flex sibling the count stays baseline-aligned to that first line —
     it visually lands between the org name and the repo name instead of
     next to the whole title. Stacking the count under the title once the
     column is this narrow keeps the two from reading as jumbled together. */
  @media (max-width:640px){
    .lp-focus{flex-direction:column;align-items:flex-start;gap:2px}
  }
  .lp-persona{display:grid;grid-template-columns:72px minmax(0,1fr);gap:18px;align-items:center}
  .lp-seal{width:72px;height:72px;border-radius:50%;position:relative;display:flex;align-items:center;justify-content:center;
    background:conic-gradient(from 210deg,var(--t-brand),var(--t-accent),var(--t-brand));animation:lp-spin 26s linear infinite}
  @keyframes lp-spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion: reduce){.lp-seal{animation:none}}
  .lp-seal::after{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--t-card)}
  .lp-seal b{position:relative;z-index:1;font-size:1.2rem;font-weight:800;color:var(--t-brand)}
  .lp-persona h3{font-size:1.25rem;font-weight:800;margin:0 0 4px;color:var(--t-ink)}
  .lp-persona p{font-size:.85rem;color:var(--t-ink-2);margin:0}
  .lp-how{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);margin-top:14px;max-width:46ch;line-height:1.5}
  .lp-how a{color:var(--t-brand);text-decoration:none;border-bottom:1px solid var(--t-brand-line)}
  .lp-how a:hover{border-bottom-color:var(--t-brand)}
  .lp-index{margin-top:44px;padding-top:14px;border-top:1px solid var(--t-line)}
  .lp-idx{display:flex;align-items:baseline;gap:14px;padding:13px 2px;border-bottom:1px solid var(--t-line);text-decoration:none}
  .lp-idx:last-child{border-bottom:0}
  .lp-idx b{font-size:.98rem;font-weight:700;color:var(--t-ink);min-width:118px}
  .lp-idx span{font-size:.82rem;color:var(--t-ink-2);flex:1}
  .lp-idx .go{flex:0 0 auto;font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);transition:transform .18s ease,color .18s ease}
  .lp-idx:hover b{color:var(--t-brand)}
  .lp-idx:hover .go{color:var(--t-brand);transform:translateX(3px)}
  @media (prefers-reduced-motion: reduce){.lp-idx .go{transition:none}}
  /* On narrow screens the fixed label width left almost nothing for the
     blurb, so its text felt cramped against the label and arrow. */
  @media (max-width:480px){
    .lp-idx b{min-width:92px}
    .lp-idx span:first-of-type{padding:2px 0;margin-left:2px}
  }
  .lp-empty{font-size:.85rem;color:var(--t-ink-3);font-style:italic}
`;

/**
 * The other four pages, in the order the blueprint's index row lists them.
 * Only real generated URLs — never a redirect stub.
 */
const PAGE_INDEX = [
  {
    href: 'journey.html',
    label: 'Journey',
    blurb: 'Milestones, expertise, and the roles behind them.',
  },
  {
    href: 'workbench.html',
    label: 'Workbench',
    blurb: 'Live maintainer activity, organized by what happens next.',
  },
  {
    href: 'writing.html',
    label: 'Writing',
    blurb: 'Long-form guides and community essays.',
  },
  {
    href: 'reports.html',
    label: 'Reports',
    blurb: 'The audit trail — every contribution, quarter by quarter.',
  },
  {
    href: 'glossary.html',
    label: 'Glossary',
    blurb: 'How each metric on this site is defined and counted.',
  },
];

/**
 * Determines the persona title and description based on contribution counts.
 */
function determinePersona(counts) {
  const { prCount, issueCount, reviewedPrCount, coAuthoredPrCount, collaborationCount } = counts;

  const grandTotal =
    prCount + issueCount + reviewedPrCount + coAuthoredPrCount + collaborationCount;

  if (grandTotal === 0) {
    return DEFAULT_PERSONA;
  }

  return personaCategories.reduce((prev, curr) => {
    const currentCount = counts[curr.key] || 0;
    const prevCount = counts[prev.key] || 0;

    if (currentCount > prevCount) return curr;
    if (currentCount === prevCount && curr.priority < prev.priority) return curr;

    return prev;
  });
}

/** "Community Mentor" → "CM"; falls back to the first two letters. */
function personaInitials(title) {
  const words = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  const initials = words.map((w) => w[0]).join('');
  return (initials.length > 1 ? initials : String(title).slice(0, 2)).slice(0, 2).toUpperCase();
}

/** Splits a display name so the last word can carry the gradient. */
function renderHeroName(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return `@${GITHUB_USERNAME}`;
  if (words.length === 1) return `<span class="lp-grad">${words[0]}</span>`;
  const last = words.pop();
  return `${words.join(' ')} <span class="lp-grad">${last}</span>`;
}

function renderHero() {
  const name = renderHeroName(PROFILE?.name);
  const tagline = PROFILE?.tagline || '';
  return dedent`
    <section class="lp-hero">
      <p class="lp-eyebrow">open source portfolio</p>
      <h1>${name}</h1>
      ${tagline ? `<p>${tagline}</p>` : ''}
    </section>
  `;
}

/**
 * The impact band. Lifetime framing throughout: every number counts the
 * whole history, not the current quarter — that's the Workbench's job.
 */
function renderImpact({
  displayTotal,
  earliestYear,
  shippedCount,
  helpedShipCount,
  articleCount,
  repoCount,
  orgCount,
}) {
  // Talks live on the Journey timeline, not here — this tile counts
  // published articles only.
  const contentCount = articleCount;
  const contentCaption = 'articles published';
  const helpedTile =
    helpedShipCount > 0
      ? `<span class="n">${helpedShipCount}</span><span class="c">contributions you helped ship</span>`
      : `<span class="n">0</span><span class="c">contributions you helped ship</span>`;

  // "Shipped" is a claim only mergedAt-bearing items can back up — the
  // headline total also includes open/unmerged work (see displayTotal),
  // so the hero caption stays verb-neutral and the shipped figure (a
  // strict subset) gets its own quieter line instead.
  const shippedLine =
    shippedCount > 0 ? `<span class="c2">${shippedCount} shipped changes</span>` : '';

  // Server-rendered fallback is always the absolute build time — a static
  // page can be viewed long after generation, so a hardcoded "today" goes
  // stale silently with no JS to correct it. The inline script recomputes
  // relative freshness at view-time and only then swaps the text.
  const buildIso = new Date().toISOString();
  const buildAbsolute = buildIso.slice(0, 16).replace('T', ' ');

  return dedent`
    <section class="lp-impact" aria-labelledby="lp-impact-h">
      <div class="lp-impact-top">
        <h2 id="lp-impact-h">Impact <span>— lifetime, across the ecosystem</span></h2>
        <span class="lp-live" data-build-ts="${buildIso}">
          <i aria-hidden="true"></i><time class="lp-live-text" datetime="${buildIso}">Updated ${buildAbsolute}</time>
        </span>
      </div>
      <div class="lp-tiles">
        <div class="lp-tile lp-tile--hero">
          <span class="n">${displayTotal}</span>
          <span class="c">contributions since ${earliestYear}</span>
          ${shippedLine}
        </div>
        <div class="lp-tile">${helpedTile}</div>
        <div class="lp-tile">
          <span class="n">${contentCount}</span>
          <span class="c">${contentCaption}</span>
        </div>
        <div class="lp-tile">
          <span class="n">${repoCount}</span>
          <span class="c">projects across ${orgCount} organization${orgCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </section>
  `;
}

/** One brand hue for every row; the label and % carry the meaning. */
function renderMeters(rows) {
  if (rows.every((r) => r.count === 0)) {
    return `<p class="lp-empty">No contributions recorded yet.</p>`;
  }
  return `<div class="lp-meters">${[...rows]
    .sort((a, b) => b.count - a.count)
    .map(
      (row) => dedent`
        <div class="lp-m">
          <div class="r"><b>${row.label}</b><span>${row.count} · ${row.pctStr}</span></div>
          <div class="bar"><i style="width:${row.pct.toFixed(1)}%"></i></div>
        </div>`
    )
    .join('')}</div>`;
}

function renderFocus(topRepos) {
  if (topRepos.length === 0) {
    return `<p class="lp-empty">No activity recorded yet.</p>`;
  }
  return topRepos
    .map(([repo, count]) => {
      const [owner, name] = repo.includes('/') ? repo.split('/') : ['', repo];
      const safeOwner = escapeHtml(owner);
      const safeName = escapeHtml(name);
      const label = owner ? `<span class="o">${safeOwner} /</span> ${safeName}` : safeName;
      return dedent`
        <div class="lp-focus">
          <a href="https://github.com/${escapeHtml(repo)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(repo)}">${label}</a>
          <span>${count} contribution${count === 1 ? '' : 's'}</span>
        </div>`;
    })
    .join('');
}

function renderPersona(personaTitle, personaDesc) {
  return dedent`
    <div class="lp-persona">
      <div class="lp-seal" aria-hidden="true"><b>${personaInitials(personaTitle)}</b></div>
      <div>
        <h3>${personaTitle}</h3>
        <p>${personaDesc}</p>
      </div>
    </div>
    <p class="lp-how">
      An assigned category, derived from which contribution type leads the mix above.
      <a href="glossary.html">How it's calculated →</a>
    </p>
  `;
}

function renderIndexRow() {
  return PAGE_INDEX.map(
    (page) => dedent`
      <a class="lp-idx" href="${page.href}">
        <b>${page.label}</b>
        <span>${page.blurb}</span>
        <span class="go" aria-hidden="true">→</span>
      </a>`
  ).join('');
}

/**
 * Generates the Home page.
 *
 * @param {object} finalContributions all-contributions.json
 * @param {Array}  articles           published articles
 * @param {number} failedFetchCount   confirmed-403 PRs (see failed-fetch.json)
 * @param {object} [options]
 * @param {object} [options.impact]   loadMergedWorkbench().impact
 */
async function createIndexHtml(
  finalContributions = {},
  articles = [],
  failedFetchCount = 0,
  options = {}
) {
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const { impact = {} } = options;

  const prCount = finalContributions.pullRequests?.length || 0;
  const issueCount = finalContributions.issues?.length || 0;
  const reviewedPrCount = finalContributions.reviewedPrs?.length || 0;
  const collaborationCount = finalContributions.collaborations?.length || 0;
  const coAuthoredPrCount = Array.isArray(finalContributions.coAuthoredPrs)
    ? finalContributions.coAuthoredPrs.length
    : 0;

  const articleCount = articles.length || 0;

  // grandTotal drives the persona/percentage math below, so it's kept to
  // contributions we could fully categorize. Confirmed-403 PRs (see
  // failed-fetch.json) are real contributions too — we just couldn't fetch
  // enough detail to place them in a category — so they're added to the
  // headline number only, not to grandTotal, to avoid distorting the
  // per-category percentages with contributions we can't attribute.
  const grandTotal =
    prCount + issueCount + reviewedPrCount + collaborationCount + coAuthoredPrCount;
  const displayTotal = grandTotal + failedFetchCount;

  const countsDict = {
    prCount,
    issueCount,
    reviewedPrCount,
    coAuthoredPrCount,
    collaborationCount,
  };

  const allItems = [
    ...(finalContributions.pullRequests || []),
    ...(finalContributions.issues || []),
    ...(finalContributions.reviewedPrs || []),
    ...(Array.isArray(finalContributions.coAuthoredPrs) ? finalContributions.coAuthoredPrs : []),
    ...(finalContributions.collaborations || []),
  ];

  const yearsActive = allItems
    .map((item) => new Date(item.date).getFullYear())
    .filter((year) => !isNaN(year) && year >= 2008);

  const currentYear = new Date().getFullYear();
  const earliestYear = yearsActive.length > 0 ? Math.min(...yearsActive) : currentYear;

  // "Shipped" only covers items GitHub actually confirms merged — the
  // headline total (displayTotal) also includes open/unmerged work, so
  // "shipped" would overclaim if applied to it directly.
  const shippedCount = allItems.filter((item) => Boolean(item.mergedAt)).length;

  const getStats = (count) => {
    if (grandTotal === 0) return { pct: 0, pctStr: '0%' };
    const pct = (count / grandTotal) * 100;
    return { pct, pctStr: pct.toFixed(1) + '%' };
  };

  const meterRows = [
    { label: 'Merged PRs', count: prCount },
    { label: 'Issues', count: issueCount },
    { label: 'Reviewed PRs', count: reviewedPrCount },
    { label: 'Co-authored PRs', count: coAuthoredPrCount },
    { label: 'Collaborations', count: collaborationCount },
  ].map((row) => ({ ...row, ...getStats(row.count) }));

  // The impact band is lifetime, so its project/organization counts come
  // from the full contribution history rather than anything computed by the
  // workbench merge (which is scoped to what's currently open or to the
  // current month — right for that board, wrong under a "lifetime" heading).
  const uniqueRepos = new Set(allItems.map((item) => item.repo).filter(Boolean));
  const uniqueOrgs = new Set([...uniqueRepos].map((repo) => String(repo).split('/')[0]));

  const repoActivity = allItems.reduce((acc, item) => {
    acc[item.repo] = (acc[item.repo] || 0) + 1;
    return acc;
  }, {});

  const topThreeRepos = Object.entries(repoActivity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const chosenPersona = determinePersona(countsDict);
  const { title: personaTitle, desc: personaDesc } = chosenPersona;

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Open Source Portfolio | ${GITHUB_USERNAME}</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      ${getThemeInitScript()}
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      ${getThemeStyleVariant()}
      <style>${LANDING_CSS}${SHARED_CHROME_CSS}</style>
    </head>
    <body style="background-color: var(--t-surface); color: var(--t-ink);" class="antialiased flex flex-col h-full min-h-full">
      ${createSkipToContentHtml('main')}
      ${navHtml}
      <main id="main" class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-6xl mx-auto">
            <div class="mt-16">
              ${renderHero()}
            </div>

            ${renderImpact({
              displayTotal,
              earliestYear,
              shippedCount,
              helpedShipCount: impact.helpedShipCount || 0,
              articleCount,
              repoCount: uniqueRepos.size,
              orgCount: uniqueOrgs.size,
            })}

            <div class="lp-cols">
              <section aria-labelledby="lp-mix">
                <h2 id="lp-mix" class="lp-h3">Contribution mix</h2>
                ${renderMeters(meterRows)}
                <h2 class="lp-h3" style="margin-top:26px">Primary focus</h2>
                ${renderFocus(topThreeRepos)}
              </section>
              <section aria-labelledby="lp-persona">
                <h2 id="lp-persona" class="lp-h3">Collaboration profile</h2>
                ${renderPersona(personaTitle, personaDesc)}
              </section>
            </div>

            <nav class="lp-index" aria-labelledby="lp-index-h">
              <h2 id="lp-index-h" class="lp-h3">See also</h2>
              ${renderIndexRow()}
            </nav>
          </div>
        </div>
      </main>
      <script>
        (function () {
          var el = document.querySelector('.lp-live[data-build-ts]');
          if (!el) return;
          var textEl = el.querySelector('.lp-live-text');
          var built = new Date(el.getAttribute('data-build-ts'));
          if (!textEl || isNaN(built.getTime())) return;
          var diffH = (Date.now() - built.getTime()) / 3600000;
          var diffD = Math.floor(diffH / 24);
          el.classList.toggle('lp-live--stale', diffH >= 24);
          if (diffH < 24) {
            if (diffH < 1 / 60) textEl.textContent = 'Updated just now';
            else if (diffH < 1) textEl.textContent = 'Updated ' + Math.max(1, Math.round(diffH * 60)) + 'm ago';
            else textEl.textContent = 'Updated ' + Math.floor(diffH) + 'h ago';
          } else if (diffD === 1) {
            textEl.textContent = 'Updated yesterday';
          } else if (diffD < 7) {
            textEl.textContent = 'cached · ' + diffD + 'd old';
          }
          // Beyond 7 days the server-rendered absolute date stays as-is.
        })();
      </script>
      ${footerHtml}
      ${createBackToTopHtml()}
      ${getBackToTopScript()}
    </body>
    </html>
  `;

  const formattedContent = await prettier.format(htmlContent, { parser: 'html' });
  await fs.writeFile(HTML_OUTPUT_PATH, formattedContent, 'utf8');

  console.log('Generated landing page successfully at: ' + HTML_OUTPUT_PATH);
}

module.exports = { createIndexHtml, determinePersona, personaInitials, renderHeroName };
