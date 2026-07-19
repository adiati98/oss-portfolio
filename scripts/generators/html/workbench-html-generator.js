/**
 * WORKBENCH PAGE (workbench.html) — the unified triage board over the
 * merged local ⨝ tracker records (design blueprint §05).
 *
 * Layer 1: plain-language impact header (any recruiter can read it).
 * Layer 2: five lanes ordered by what happens next —
 *   Needs your action / Approved — bring it home  (open by default)
 *   Waiting on others / Stalled 30+ days / Automated (folded)
 *
 * "Approved is not done": every ready-lane row shows who approved and its
 * remaining step (final review, backport check, maintainer nudge).
 * Degraded tracker feed renders a cached-data banner; an empty board is a
 * positive state.
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

const LANES = [
  {
    id: 'action',
    title: 'Needs your action',
    explain: 'Your move — feedback to address, a review waiting on you, or a note left after approval.',
    open: true,
    stripe: 'var(--t-caution)',
  },
  {
    id: 'ready',
    title: 'Approved — bring it home',
    explain:
      'Reviewed and approved, but not done: each still needs a final review, a backport check, or a maintainer nudge before it ships.',
    open: true,
    stripe: 'var(--t-positive)',
  },
  {
    id: 'waiting',
    title: 'Waiting on others',
    explain: 'Your part is done — awaiting review, or blocked on a linked code PR.',
    open: false,
    stripe: 'var(--t-brand)',
  },
  {
    id: 'stalled',
    title: 'Stalled · 30+ days',
    explain: 'No movement in a month — each needs a decision: nudge or close.',
    open: false,
    stripe: 'var(--t-neutral)',
  },
  {
    id: 'bot',
    title: 'Automated',
    explain: 'Dependency and security bumps from bots — batchable, kept out of the way.',
    open: false,
    stripe: 'var(--t-line-2)',
  },
];

const PILL_CLASS = {
  'Take Action': 'wbx-pill--act',
  'To Write': 'wbx-pill--act',
  Approved: 'wbx-pill--ok',
  Watching: 'wbx-pill--watch',
  Waiting: 'wbx-pill--wait',
  Stale: 'wbx-pill--stale',
  Bot: 'wbx-pill--stale',
};

const WORKBENCH_CSS = `
  ${THEME_CSS_VARS}
  .wbx-impact{background:var(--t-card);border:1px solid var(--t-line);border-radius:14px;overflow:hidden;margin-bottom:18px;box-shadow:var(--t-shadow)}
  .wbx-impact-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--t-line);
    background:linear-gradient(120deg,var(--t-brand-wash),var(--t-card-2) 62%)}
  .wbx-impact-top h2{font-size:1.05rem;font-weight:800;margin:0;color:var(--t-ink)}
  .wbx-impact-top h2 span{color:var(--t-ink-2);font-weight:400;font-size:.86rem}
  .wbx-live{display:inline-flex;align-items:center;gap:7px;font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.09em;text-transform:uppercase;color:var(--t-positive)}
  .wbx-live i{width:8px;height:8px;border-radius:50%;background:var(--t-positive);position:relative}
  .wbx-live i::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--t-positive);animation:wbx-ping 2.4s ease-out infinite}
  @keyframes wbx-ping{0%{transform:scale(.6);opacity:.8}100%{transform:scale(1.6);opacity:0}}
  @media (prefers-reduced-motion: reduce){.wbx-live i::after{animation:none}}
  .wbx-tiles{display:grid;grid-template-columns:repeat(5,1fr)}
  @media (max-width:760px){.wbx-tiles{grid-template-columns:repeat(2,1fr)}}
  .wbx-tile{padding:15px 18px;border-right:1px solid var(--t-line);display:flex;flex-direction:column;gap:2px}
  .wbx-tile:last-child{border-right:0}
  @media (max-width:760px){.wbx-tile{border-top:1px solid var(--t-line)}.wbx-tile:nth-child(2n){border-right:0}}
  .wbx-tile .n{font-weight:800;font-size:2.05rem;line-height:1.08;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--t-ink)}
  .wbx-tile .c{font-size:.76rem;color:var(--t-ink-2);line-height:1.35}
  .wbx-tile--hero{background:linear-gradient(150deg,var(--t-brand-strong),var(--t-brand))}
  .wbx-tile--hero .n,.wbx-tile--hero .c{color:var(--t-on-brand)}
  .wbx-tile--hero .c{opacity:.85}
  .wbx-tile--hot .n{color:var(--t-caution)}
  .wbx-tile--good .n{color:var(--t-positive)}
  .wbx-banner{display:flex;gap:12px;align-items:flex-start;border-radius:10px;padding:13px 16px;font-size:.85rem;margin-bottom:16px;color:var(--t-ink-2)}
  .wbx-banner--warn{background:var(--t-caution-wash);border:1px solid var(--t-caution-line)}
  .wbx-banner--warn .ic{color:var(--t-caution);font-family:ui-monospace,monospace}
  .wbx-banner b{color:var(--t-ink)}
  .wbx-lanes{display:flex;flex-direction:column;gap:12px}
  .wbx-lane{background:var(--t-card-2);border:1px solid var(--t-line);border-left-width:4px;border-radius:10px;overflow:hidden}
  .wbx-lane summary{list-style:none;cursor:pointer;padding:13px 16px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .wbx-lane summary::-webkit-details-marker{display:none}
  .wbx-lane summary::after{content:"▸";margin-left:auto;color:var(--t-ink-3);font-size:.78rem;align-self:center;transition:transform .15s ease}
  .wbx-lane[open] summary::after{transform:rotate(90deg)}
  @media (prefers-reduced-motion: reduce){.wbx-lane summary::after{transition:none}}
  .wbx-lane-title{font-size:1.02rem;font-weight:800;color:var(--t-ink)}
  .wbx-lane-count{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);background:var(--t-surface);border:1px solid var(--t-line);border-radius:999px;padding:1px 9px}
  .wbx-lane-explain{flex-basis:100%;margin:2px 0 0;color:var(--t-ink-3);font-size:.82rem}
  .wbx-rows{border-top:1px solid var(--t-line)}
  .wbx-row{display:grid;grid-template-columns:150px 1fr;gap:6px 16px;padding:12px 16px;border-top:1px solid var(--t-line);align-items:start;background:var(--t-card)}
  .wbx-row:first-child{border-top:0}
  @media (max-width:620px){.wbx-row{grid-template-columns:1fr}}
  .wbx-pill{display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.05em;text-transform:uppercase;padding:2px 9px;border-radius:999px;border:1px solid var(--t-line);white-space:nowrap;align-self:start}
  .wbx-pill i{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
  .wbx-pill--act{color:var(--t-caution);border-color:var(--t-caution-line);background:var(--t-caution-wash)}.wbx-pill--act i{background:var(--t-caution)}
  .wbx-pill--ok{color:var(--t-positive);border-color:var(--t-positive-line);background:var(--t-positive-wash)}.wbx-pill--ok i{background:var(--t-positive)}
  .wbx-pill--watch{color:var(--t-brand);border-color:var(--t-brand-line);background:var(--t-brand-wash)}.wbx-pill--watch i{background:var(--t-brand)}
  .wbx-pill--wait{color:var(--t-positive);border-color:var(--t-positive-line);background:var(--t-positive-wash)}.wbx-pill--wait i{background:var(--t-positive)}
  .wbx-pill--stale{color:var(--t-neutral);background:var(--t-neutral-wash)}.wbx-pill--stale i{background:var(--t-neutral)}
  .wbx-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px}
  .wbx-repo{font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);background:var(--t-surface);border:1px solid var(--t-line);border-radius:5px;padding:1px 7px}
  .wbx-rel{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.05em;color:var(--t-ink-3)}
  .wbx-task{font-size:.92rem;line-height:1.4;overflow-wrap:anywhere}
  .wbx-task a{color:var(--t-ink);font-weight:600;text-decoration:none}
  .wbx-task a:hover{color:var(--t-brand)}
  .wbx-next{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;font-size:.78rem;color:var(--t-ink-2)}
  .wbx-step{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.05em;text-transform:uppercase;padding:1px 8px;border-radius:5px}
  .wbx-step--do{color:var(--t-caution);background:var(--t-caution-wash)}
  .wbx-step--ship{color:var(--t-positive);background:var(--t-positive-wash)}
  .wbx-empty{text-align:center;padding:44px 20px;color:var(--t-ink-2)}
  .wbx-empty .g{font-size:2rem;color:var(--t-positive);font-weight:800}
  .wbx-chip-draft{display:inline-flex;align-items:center;font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.03em;color:var(--t-neutral);background:var(--t-neutral-wash);border:1px solid var(--t-neutral-line);border-radius:999px;padding:1px 9px}
  .wbx-live--stale{color:var(--t-caution)}
  .wbx-live--stale i{background:var(--t-caution)}
  .wbx-live--stale i::after{content:none}
  .wbx-lane-index{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}
  .wbx-lane-index a{display:inline-flex;align-items:center;gap:5px;font-family:ui-monospace,monospace;font-size:.75rem;color:var(--t-ink-3);border:1px solid var(--t-line);border-radius:6px;padding:3px 10px;text-decoration:none;transition:border-color .15s ease,color .15s ease}
  .wbx-lane-index a:hover{color:var(--t-brand);border-color:var(--t-brand-line)}
  .wbx-lane-index-n{color:var(--t-ink-3)}
  @media (prefers-reduced-motion: reduce){.wbx-lane-index a{transition:none}}
`;

function relLabel(record) {
  const map = {
    authored: '✍ authored',
    'co-authoring': '🤝 co-authoring',
    reviewing: '👀 reviewing',
    'assigned issue': '📝 assigned issue',
  };
  return map[record.relationship] || escapeHtml(record.relationship) || '';
}

function renderRow(record) {
  const pillClass = PILL_CLASS[record.ball] || 'wbx-pill--stale';
  const idleBadge =
    record.lane === 'stalled' || record.idleDays >= 7
      ? ` · ${Math.floor(record.idleDays)}d`
      : '';
  const title = escapeHtml(record.title || record.key);
  const nextBits = [];
  if (record.approval && record.approval.by) {
    // An approval dismissed after a push is still worth surfacing — it just
    // needs a fresh look, not a re-review from scratch.
    const dismissedNote = record.approval.dismissed ? ' — dismissed after update' : '';
    nextBits.push(`approved by <b>${escapeHtml(record.approval.by)}</b>${dismissedNote}`);
  }
  if (record.reviewedNote && record.reviewedNote.by) {
    // Muted context: a human looked at this but didn't approve. Never a lane
    // change — just a hint of where the review stands.
    nextBits.push(`<span style="color:var(--t-ink-3)"><b>${escapeHtml(record.reviewedNote.by)}</b> reviewed this</span>`);
  }
  if (record.botPing && record.botPing.of) {
    nextBits.push(`<span style="color:var(--t-ink-3)">Promptless pinged <b>${escapeHtml(record.botPing.of)}</b></span>`);
  }
  if (record.linkedCodePr && record.linkedCodePr.ref) {
    const ref = record.linkedCodePr.ref;
    const refMatch = ref.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    const refHtml = refMatch
      ? `<a href="https://github.com/${escapeHtml(refMatch[1])}/pull/${refMatch[2]}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref)}</a>`
      : escapeHtml(ref);
    nextBits.push(`<span style="font-family:ui-monospace,monospace;font-size:.75rem">🔗 code PR <b>${refHtml}</b></span>`);
  }
  if (record.nextStep) {
    const stepClass = record.lane === 'ready' ? 'wbx-step--ship' : 'wbx-step--do';
    nextBits.push(`<span class="wbx-step ${stepClass}">${escapeHtml(record.nextStep)}</span>`);
  }
  const nextHtml = nextBits.length ? `<div class="wbx-next">${nextBits.join(' · ')}</div>` : '';

  return dedent`
    <div class="wbx-row">
      <span class="wbx-pill ${pillClass}"><i></i>${escapeHtml(record.ball)}${idleBadge}</span>
      <div>
        <div class="wbx-meta">
          <span class="wbx-repo">${escapeHtml(record.repo || '')}</span>
          <span class="wbx-rel">${relLabel(record)}</span>
          ${record.isDraft ? '<span class="wbx-chip-draft">Draft</span>' : ''}
        </div>
        <div class="wbx-task"><a href="${escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer">${title}</a></div>
        ${nextHtml}
      </div>
    </div>
  `;
}

function renderLane(lane, records) {
  const rows = records.map(renderRow).join('');
  const body =
    records.length > 0
      ? `<div class="wbx-rows">${rows}</div>`
      : '';
  return dedent`
    <details class="wbx-lane" id="wbx-lane-${lane.id}" style="border-left-color:${lane.stripe}" ${lane.open && records.length ? 'open' : ''}>
      <summary>
        <span class="wbx-lane-title">${lane.title}</span>
        <span class="wbx-lane-count">${records.length}</span>
        <p class="wbx-lane-explain">${lane.explain}</p>
      </summary>
      ${body}
    </details>
  `;
}

/** "Q3 2026" — matches workbench-merge.js's own UTC quarter boundary so the label never names a different quarter than the one the tile actually tallied. */
function currentQuarterLabel(now = new Date()) {
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `Q${q} ${now.getUTCFullYear()}`;
}

function renderLaneIndex(records) {
  if (records.length === 0) return '';
  const links = LANES.map((lane) => {
    const count = records.filter((r) => r.lane === lane.id).length;
    return `<a href="#wbx-lane-${lane.id}">${lane.title} <span class="wbx-lane-index-n">(${count})</span></a>`;
  }).join('');
  return `<nav class="wbx-lane-index" aria-label="Jump to lane">${links}</nav>`;
}

function renderImpact(impact, feed) {
  // Captions carry the scope explicitly because they don't all share
  // one: the hero is quarter-scoped, "approved" and "need your action"
  // describe the board's state right now (not a time window), and the
  // last two are calendar-month scoped. That mix is deliberate — this
  // board answers "what's happening right now," not a running lifetime
  // total (that's Home's job) — but two tiles reading "this month" next
  // to a differently-scoped "this quarter" hero needs each caption to say
  // its own scope rather than relying on a shared, unstated one.
  const helpedTile = {
    n: `${impact.helpedShipThisMonth}`,
    c: 'contributions you helped ship this month',
  };
  // Server-rendered fallback is always the absolute build time — a static
  // page can be viewed long after generation, so "just now" would go stale
  // silently with no JS to correct it. The inline script below recomputes
  // relative freshness at view-time and only then swaps the text.
  const buildIso = new Date().toISOString();
  const buildAbsolute = buildIso.slice(0, 16).replace('T', ' ');
  const stale = Boolean(feed.degraded);
  const liveClass = stale ? 'wbx-live wbx-live--stale' : 'wbx-live';
  const liveText = stale ? `cached · ${buildAbsolute}` : `Updated ${buildAbsolute}`;
  return dedent`
    <div class="wbx-impact">
      <div class="wbx-impact-top">
        <h2>Active across open source <span>— live maintainer &amp; contribution activity</span></h2>
        <span class="${liveClass}" data-build-ts="${buildIso}" data-degraded="${stale ? '1' : '0'}">
          <i aria-hidden="true"></i><time class="wbx-live-text" datetime="${buildIso}">${liveText}</time>
        </span>
      </div>
      <div class="wbx-tiles">
        <div class="wbx-tile wbx-tile--hero"><span class="n">${impact.shippedThisQuarter}</span><span class="c">changes shipped in ${currentQuarterLabel()}</span></div>
        <div class="wbx-tile wbx-tile--good"><span class="n">${impact.approvedLanding}</span><span class="c">approved &amp; heading to merge — on the board now</span></div>
        <div class="wbx-tile wbx-tile--hot"><span class="n">${impact.needAction}</span><span class="c">need your action now</span></div>
        <div class="wbx-tile"><span class="n">${helpedTile.n}</span><span class="c">${helpedTile.c}</span></div>
        <div class="wbx-tile"><span class="n">${impact.projectsThisMonth}</span><span class="c">projects across ${impact.organizationsThisMonth} organization${impact.organizationsThisMonth === 1 ? '' : 's'} this month</span></div>
      </div>
    </div>
  `;
}

async function createWorkbenchHtml({ records, impact, feed }) {
  const htmlBaseDir = path.join(BASE_DIR, 'html-generated');
  const outputPath = path.join(htmlBaseDir, 'workbench.html');
  await fs.mkdir(htmlBaseDir, { recursive: true });

  const navHtml = createNavHtml('./');
  const footerHtml = createFooterHtml();

  const humanRecords = records.filter((r) => r.lane !== 'bot');
  // feed.reason comes back from a live tracker fetch, so it isn't
  // guaranteed to end in terminal punctuation — join it onto the next
  // sentence without one and the banner reads as a run-on.
  const rawReason = (feed.reason || 'Live fetch failed.').trim();
  const reasonSentence = /[.!?]$/.test(rawReason) ? rawReason : `${rawReason}.`;
  const banner = feed.degraded
    ? dedent`
      <div class="wbx-banner wbx-banner--warn">
        <span class="ic">▲</span>
        <div><b>Tracker feed degraded.</b> ${escapeHtml(reasonSentence)} Local records are current as of this build; lane placement keeps working from the last good data.</div>
      </div>`
    : '';

  const board =
    humanRecords.length === 0
      ? dedent`
        <div class="wbx-empty">
          <div class="g">✓</div>
          <h2 style="font-size:1.25rem;font-weight:800;margin-top:8px;color:var(--t-ink)">Your court is clear.</h2>
          <p style="max-width:44ch;margin:10px auto 0;font-size:.9rem">No open tasks locally, and the tracker has nothing waiting on you.</p>
        </div>`
      : `<div class="wbx-lanes">${LANES.map((lane) =>
          renderLane(lane, records.filter((r) => r.lane === lane.id))
        ).join('')}</div>`;

  const htmlContent = dedent`
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Active Workbench | ${GITHUB_USERNAME} Portfolio</title>
      <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${FAVICON_SVG_ENCODED}">
      ${getThemeInitScript()}
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      ${getThemeStyleVariant()}
      <style>${WORKBENCH_CSS}${SHARED_CHROME_CSS}</style>
    </head>
    <body style="background-color: var(--t-surface); color: var(--t-ink);" class="antialiased flex flex-col h-full min-h-full">
      ${createSkipToContentHtml('main')}
      ${navHtml}
      <main id="main" class="grow w-full">
        <div class="px-6 sm:px-12 lg:px-16 xl:px-32 py-10">
          <div class="max-w-6xl mx-auto">
            <header class="mt-16 mb-10">
              <p style="font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-ink-3)">active workbench</p>
              <h1 class="text-4xl sm:text-5xl font-extrabold mt-2 mb-4" style="color:var(--t-ink);letter-spacing:-.01em">Organized by what happens next</h1>
            </header>
            ${renderImpact(impact, feed)}
            ${humanRecords.length > 0 ? renderLaneIndex(records) : ''}
            ${banner}
            ${board}
          </div>
        </div>
      </main>
      <script>
        (function () {
          var el = document.querySelector('.wbx-live[data-build-ts]');
          if (!el) return;
          var textEl = el.querySelector('.wbx-live-text');
          var built = new Date(el.getAttribute('data-build-ts'));
          if (!textEl || isNaN(built.getTime())) return;
          var degraded = el.getAttribute('data-degraded') === '1';
          var diffH = (Date.now() - built.getTime()) / 3600000;
          var diffD = Math.floor(diffH / 24);
          el.classList.toggle('wbx-live--stale', degraded || diffH >= 24);
          if (degraded) {
            textEl.textContent = 'cached · ' + Math.max(diffD, 0) + 'd old';
          } else if (diffH < 24) {
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
  await fs.writeFile(outputPath, formattedContent, 'utf8');
  console.log(`Generated Workbench page at ${outputPath}`);
}

module.exports = { createWorkbenchHtml, LANES };
