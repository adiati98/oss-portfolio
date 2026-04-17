/**
 * Centralizes all dynamic, color-dependent styling logic for HTML reports.
 */

const { dedent } = require('../../utils/dedent');
const { COLORS } = require('../../config/constants');

// --- 1. BASE STYLES (Shared by all pages) ---

/**
 * Generates the common foundational CSS (font, body reset, navbar buttons).
 * @returns {string} The CSS string.
 */
function getCommonBaseCss() {
  return dedent`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
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
      border: 1px solid ${COLORS.border.light} !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .nav-report-button:hover {
      border-color: ${COLORS.primary.rgb} !important;
    }
    .nav-report-button:focus-visible {
      border-color: ${COLORS.primary.rgb};
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }
        
    .nav-contribution-button {
      border: 1px solid ${COLORS.border.light} !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .nav-contribution-button:hover {
      border-color: ${COLORS.primary.rgb} !important;
    }
    .nav-contribution-button:focus-visible { 
      border-color: ${COLORS.primary.rgb};
      outline: 2px solid ${COLORS.primary.rgb};
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
        font-size: 0.7rem !important; /* slightly smaller than xs */
      }
    }
  `;
}

// --- 2. FUNCTIONS FOR EACH HTML GENERATOR ---

/**
 * Generates the CSS block for the Community & Activity page.
 */
function getCommunityStyleCss() {
  return dedent`
    ${getCommonBaseCss()}
    
    /* Achievement Cards */
    .metric-card-hover {
      transition: all 0.2s ease-in-out;
    }
    .metric-card-hover:hover {
      transform: translateY(-4px);
      border-color: ${COLORS.primary.rgb} !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }

    /* Table & Row Hovers */
    .table-row-hover {
      transition: background-color 0.15s ease-in-out;
    }
    .table-row-hover:hover {
      background-color: ${COLORS.primary[5]} !important;
    }

    /* Workbench Table custom scrollbar for mobile */
    .overflow-x-auto {
      scrollbar-width: thin;
      scrollbar-color: ${COLORS.border.light} transparent;
    }
  `;
}

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
      color: ${COLORS.primary.rgb};
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
      text-decoration-color: ${COLORS.primary.rgb};
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
      color: ${COLORS.text.primary};
      transition: background-color 0.15s ease-in-out;
    }
    summary:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }

    details[open] {
      background-color: ${COLORS.primary[5]};
    }
    details[open] summary {
      background-color: ${COLORS.primary[5]};
      border-radius: 0.5rem 0.5rem 0 0;
      color: ${COLORS.primary.rgb};
    }
    details[open] summary:hover,
    details[open] summary:focus-visible {
      background-color: ${COLORS.primary[10]};
    }
    details:not([open]) {
      background-color: ${COLORS.background.altRows};
    }
    details:not([open]) summary {
      border-bottom: none;
      border-radius: 0.5rem;
    }
    details:not([open]) summary:hover,
    details:not([open]) summary:focus-visible {
      background-color: ${COLORS.primary[5]};
    }

    .report-card-link {
      border: 1px solid ${COLORS.border.light} !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .report-card-link:hover {
      border-color: ${COLORS.primary.rgb} !important;
    }
    .report-card-link:focus-visible {
      border-color: ${COLORS.primary.rgb};
      outline: 2px solid ${COLORS.primary.rgb};
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
    
    summary {
      cursor: pointer;
      outline: none;
      margin: 0.5em 0;
      padding: 0.5em 0;
      color: #1f2937;
      display: list-item;
      white-space: nowrap;
    }
    summary:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }

    summary .inline-flex {
      display: inline-flex;
      align-items: center;
      flex-wrap: nowrap;
      vertical-align: middle;
    }

    .details-section {
      background-color: ${COLORS.primary[5]};
    }
    .details-section details:open summary {
      color: ${COLORS.primary.rgb};
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
      background-color: #ffffff;
      background-image: linear-gradient(${COLORS.primary[5]}, ${COLORS.primary[5]});
      font-weight: 700;
      padding: 12px;
      text-align: left;
      border-bottom: none;
      box-shadow: inset 0 -1px 0 0 ${COLORS.primary.rgb};
    }

    .report-table td {
      background-color: #ffffff;
    }

    .report-table th,
    .report-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
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
      background-color: ${COLORS.primary[10]} !important;
    }

    .table-row-hover:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: -2px;
    }

    .report-table tbody tr.bg-white { background-color: #ffffff; }
    .report-table tbody tr.bg-gray-50 { background-color: #f9fafb; }

    .th-content {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      vertical-align: middle;
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
      color: ${COLORS.primary.rgb} !important;
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
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    /* Target the text inside to ensure monospace inheritance */
    .glossary-code-block .text-sm {
      font-family: inherit;
    }

    /* Bold text: Clean, high-contrast, no background color */
    .glossary-content strong {
      color: #3730a3; /* text-indigo-800 */
      font-weight: 900;
      background-color: transparent !important;
      padding: 0;
    }

    /* Highlight the section when navigating via URL hash (#) */
    :target {
      background-color: ${COLORS.primary[5]};
      border-radius: 1rem;
      transition: background-color 0.5s ease;
      padding: 1rem;
      margin: -1rem;
      scroll-margin-top: 100px;
    }

    :target h3 {
      color: ${COLORS.primary.rgb} !important;
    }
  `;
}

module.exports = {
  getReportStyleCss,
  getIndexStyleCss,
  getReportsListStyleCss,
  getBlogStyleCss,
  getCommunityStyleCss,
  getGlossaryStyleCss,
};
