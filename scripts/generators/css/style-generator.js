/**
 * Centralizes all dynamic, color-dependent styling logic for HTML reports.
 */

const { dedent } = require('../../utils/dedent');
const { COLORS, THEME_CSS_VARS } = require('../../config/constants');

// --- 1. BASE STYLES (Shared by all pages) ---

/**
 * Generates the common foundational CSS (font, body reset, navbar buttons).
 * @returns {string} The CSS string.
 */
function getCommonBaseCss() {
  return dedent`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
    ${THEME_CSS_VARS}
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      max-width: 100%;
      overflow-x: hidden;
      position: relative;
    }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 10vh;
      display: flex;
      flex-direction: column;
    }

    /* Navigation Buttons */
    .nav-report-button {
      border: 1px solid var(--t-line) !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .nav-report-button:hover {
      border-color: var(--t-brand) !important;
    }
    .nav-report-button:focus-visible {
      border-color: var(--t-brand);
      outline: 2px solid var(--t-brand);
      outline-offset: 2px;
    }

    .nav-contribution-button {
      border: 1px solid var(--t-line) !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .nav-contribution-button:hover {
      border-color: var(--t-brand) !important;
    }
    .nav-contribution-button:focus-visible {
      border-color: var(--t-brand);
      outline: 2px solid var(--t-brand);
      outline-offset: 2px;
    }

    /* Breakdown Icon Wrapper */
    .breakdown-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      width: 1rem;   /* default 16px */
      height: 1rem;
    }
    .breakdown-icon-wrapper svg {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }

    /* Breakdown Label text scaling */
    .breakdown-label {
      font-size: 0.875rem; /* default sm */
      font-weight: 500;
      white-space: nowrap;
    }

    /* Small Screen Adjustments for Breakdown Section */
    @media (max-width: 400px) {
      .breakdown-icon-wrapper {
        width: 0.75rem; /* shrinks to 12px */
        height: 0.75rem;
      }
      .breakdown-label {
        font-size: 0.75rem !important;
      }
    }
  `;
}

// --- 2. FUNCTIONS FOR EACH HTML GENERATOR ---

/**
 * Generates the CSS block for the blog page (blog.html).
 */
function getBlogStyleCss() {
  return dedent`
    ${getCommonBaseCss()}
    .article-card {
      border-bottom: 1px solid ${COLORS.border.light};
      padding: 1.5rem 0;
      transition: background-color 0.2s;
    }
    .article-card:last-child {
      border-bottom: none;
    }
    .article-card h3 a {
      color: ${COLORS.primaryText};
      text-decoration: none;
      font-weight: 700;
    }
    .article-card h3 a:hover {
      text-decoration: underline;
      text-underline-offset: 4px;
    }
    .article-meta {
      color: ${COLORS.text.secondary};
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .platform-tag {
      font-weight: 600;
      color: ${COLORS.text.primary};
    }
  `;
}

/**
 * Generates the CSS block for the Landing Page head.
 */
function getIndexStyleCss() {
  return dedent`
    ${getCommonBaseCss()}

    /* Custom font size between md and lg */
    .text-md-lg {
      font-size: 1.0625rem;
      line-height: 1.625rem;
    }

    /* Hover state for links using the secondary text color */
    .hover-underline-primary:hover {
      text-decoration: underline;
      text-underline-offset: 4px;
      text-decoration-color: ${COLORS.primaryText};
    }

    /* Animation for the Contribution Bars */
    @keyframes loadBar {
      from { width: 0; }
    }
    .progress-bar {
      animation: loadBar 1s ease-out forwards;
    }
  `;
}

/**
 * Generates the CSS block for the Quarterly Reports List (reports.html) HTML head.
 */
function getReportsListStyleCss() {
  return dedent`
    ${getCommonBaseCss()}
    .report-list {
      list-style: none;
    }
    .report-list a {
      text-decoration: none;
    }
        
    details summary {
      cursor: pointer;
      outline: none;
      color: var(--t-ink);
      transition: background-color 0.15s ease-in-out;
    }
    summary:focus-visible {
      outline: 2px solid var(--t-brand);
      outline-offset: 2px;
    }

    details[open] {
      background-color: var(--t-brand-wash);
    }
    details[open] summary {
      background-color: var(--t-brand-wash);
      border-radius: 0.5rem 0.5rem 0 0;
      color: var(--t-brand);
    }
    details[open] summary:hover,
    details[open] summary:focus-visible {
      background-color: var(--t-brand-line);
    }
    details:not([open]) {
      background-color: var(--t-card-2);
    }
    details:not([open]) summary {
      border-bottom: none;
      border-radius: 0.5rem;
    }
    details:not([open]) summary:hover,
    details:not([open]) summary:focus-visible {
      background-color: var(--t-brand-wash);
    }

    .report-card-link {
      border: 1px solid var(--t-line) !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .report-card-link:hover {
      border-color: var(--t-brand) !important;
    }
    .report-card-link:focus-visible {
      border-color: var(--t-brand);
      outline: 2px solid var(--t-brand);
      outline-offset: 2px;
    }
  `;
}

/**
 * Generates the CSS block for the Quarterly Report HTML head.
 */
function getReportStyleCss() {
  return dedent`
    ${getCommonBaseCss()}

    /* Quarterly impact band — same tile pattern as the workbench board
       (renderImpact), scoped to a single closed quarter instead of live
       activity. */
    .qr-impact{background:var(--t-card);border:1px solid var(--t-line);border-radius:14px;overflow:hidden;margin-bottom:32px;box-shadow:var(--t-shadow)}
    .qr-impact-top{padding:14px 18px;border-bottom:1px solid var(--t-line);background:linear-gradient(120deg,var(--t-brand-wash),var(--t-card-2) 62%)}
    .qr-impact-top h2{font-size:1.05rem;font-weight:800;margin:0;color:var(--t-ink)}
    .qr-impact-top h2 span{color:var(--t-ink-3);font-weight:400;font-size:.86rem}
    .qr-tiles{display:grid;grid-template-columns:repeat(5,1fr)}
    @media (max-width:760px){.qr-tiles{grid-template-columns:repeat(2,1fr)}}
    .qr-tile{padding:15px 18px;border-right:1px solid var(--t-line);display:flex;flex-direction:column;gap:2px;text-decoration:none;transition:background .15s ease}
    .qr-tile:last-child{border-right:0}
    a.qr-tile:hover{background:var(--t-card-2)}
    @media (max-width:760px){.qr-tile{border-top:1px solid var(--t-line)}.qr-tile:nth-child(2n){border-right:0}}
    .qr-tile .n{font-weight:800;font-size:2.05rem;line-height:1.08;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--t-ink)}
    .qr-tile .c{font-size:.76rem;color:var(--t-ink-2);line-height:1.35}
    .qr-tile--hero{background:linear-gradient(150deg,var(--t-brand-strong),var(--t-brand))}
    .qr-tile--hero .n,.qr-tile--hero .c{color:var(--t-on-brand)}
    .qr-tile--hero .c{opacity:.85}
    a.qr-tile--hero:hover{background:linear-gradient(150deg,var(--t-brand-strong),var(--t-brand))}
    .qr-tile--good .n{color:var(--t-positive)}

    summary {
      cursor: pointer;
      outline: none;
      margin: 0.5em 0;
      padding: 0.5em 0;
      color: var(--t-ink);
      display: list-item;
      white-space: nowrap;
    }
    summary:focus-visible {
      outline: 2px solid var(--t-brand);
      outline-offset: 2px;
    }

    summary .inline-flex {
      display: inline-flex;
      align-items: center;
      flex-wrap: nowrap;
      vertical-align: middle;
    }

    .details-section {
      background-color: var(--t-brand-wash);
    }
    .details-section details:open summary {
      color: var(--t-brand);
    }

    .report-table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
    }

    .report-table th {
      position: sticky;
      top: 0;
      z-index: 10;
      background-color: var(--t-card);
      background-image: linear-gradient(var(--t-brand-wash), var(--t-brand-wash));
      font-weight: 700;
      padding: 12px;
      text-align: left;
      border-bottom: none;
      box-shadow: inset 0 -1px 0 0 var(--t-brand);
    }

    .report-table td {
      background-color: var(--t-card);
    }

    .report-table th,
    .report-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--t-line);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .report-table tbody tr:last-child td {
      border-bottom: none;
    }

    .table-row-hover {
      background-color: inherit;
    }

    .table-row-hover:hover,
    .table-row-hover:focus-visible {
      background-color: var(--t-brand-wash) !important;
    }

    .table-row-hover:focus-visible {
      outline: 2px solid var(--t-brand);
      outline-offset: -2px;
    }

    .report-table tbody tr.bg-white { background-color: var(--t-card); }
    .report-table tbody tr.bg-gray-50 { background-color: var(--t-card-2); }

    .th-content {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      vertical-align: middle;
    }

    .th-sort-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      margin: 0;
      padding: 2px 4px;
      font: inherit;
      font-weight: inherit;
      color: inherit;
      cursor: pointer;
      border-radius: 4px;
    }

    .th-sort-btn:focus-visible {
      outline: 2px solid var(--t-brand);
      outline-offset: 2px;
    }

    .sort-icon {
      display: inline-flex;
      align-items: center;
      font-size: 0.85em;
      opacity: 0.3;
      line-height: 1;
    }

    th.sort-asc .sort-icon,
    th.sort-desc .sort-icon,
    th.sort-custom1 .sort-icon,
    th.sort-custom2 .sort-icon {
      opacity: 1 !important;
      color: var(--t-brand) !important;
      font-weight: bold;
    }

    .icon-input-container {
      position: relative;
    }
    .icon-input-container input {
      padding-left: 36px !important;
    }
    .input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }

    .search-input {
      border-color: var(--t-brand);
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }
    .search-input:focus,
    .search-input:focus-visible {
      border-color: var(--t-brand-line) !important;
      box-shadow: 0 0 0 1px var(--t-brand-line);
      outline: none;
    }

    @media (max-width: 400px) {
      summary .text-xl {
        font-size: 1.1rem !important;
      }
      summary .w-6.h-6 {
        width: 1.25rem !important;
        height: 1.25rem !important;
      }
      summary .inline-flex {
        gap: 8px !important;
        margin-left: 4px !important;
      }
    }
  `;
}

/**
 * Generates the CSS block for the Glossary page (glossary.html).
 */
function getGlossaryStyleCss() {
  return dedent`
    ${getCommonBaseCss()}
    
    .glossary-content {
      line-height: 1.8;
    }

    /* The Block Code Look */
    .glossary-code-block {
      display: block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background-color: var(--t-card-2);
      border: 1px solid var(--t-line);
    }

    /* Target the text inside to ensure monospace inheritance */
    .glossary-code-block .text-sm {
      font-family: inherit;
    }

    /* Bold text: Clean, high-contrast, no background color */
    .glossary-content strong {
      color: var(--t-brand-strong);
      font-weight: 900;
      background-color: transparent !important;
      padding: 0;
    }

    /* Highlight the section when navigating via URL hash (#) */
    :target {
      background-color: var(--t-brand-wash);
      border-radius: 1rem;
      transition: background-color 0.5s ease;
      padding: 1rem;
      margin: -1rem;
      scroll-margin-top: 100px;
    }

    :target h3 {
      color: var(--t-brand) !important;
    }
  `;
}

module.exports = {
  getReportStyleCss,
  getIndexStyleCss,
  getReportsListStyleCss,
  getBlogStyleCss,
  getGlossaryStyleCss,
};
