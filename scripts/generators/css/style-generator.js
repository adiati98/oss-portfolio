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
  `;
}

// --- 2. FUNCTIONS FOR EACH HTML GENERATOR ---

/**
 * Generates the CSS block for the <style> tag in the Quarterly Report HTML head.
 * @returns {string} The CSS string.
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
    }
    /* summary:focus-visible uses the primary color for outline */
    summary:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }
    .report-table th,
    .report-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* .details-section and details:open summary use primary colors */
    .details-section {
      background-color: ${COLORS.primary[5]};
    }
    .details-section details:open summary {
      color: ${COLORS.primary.rgb};
    }
    .report-table tbody tr:last-child td {
      border-bottom: none;
    }
        
    /* Table Row Hover/Focus */
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
        
    /* Sorting Icons */
    th .sort-icon {
      margin-left: 5px;
      font-size: 0.8em;
      opacity: 0.5;
    }
    th.sort-asc .sort-icon,
    th.sort-desc .sort-icon {
      opacity: 1;
      font-weight: bold;
    }

    /* --- Icon Input Styles for Search Bar --- */
    /* Container holds the input and positions the icon */
    .icon-input-container {
      position: relative;
    }
    /* Style the input to push text away from the icon */
    .icon-input-container input {
      padding-left: 36px !important;
    }
    /* Position the icon absolutely inside the container */
    .input-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
  `;
}

/**
 * Generates the CSS block for the <style> tag in the All-Time/Index Report HTML head.
 * @returns {string} The CSS string.
 */
function getIndexStyleCss() {
  return dedent`
    ${getCommonBaseCss()}
    .report-list {
      list-style: none;
      padding: 0;
    }
    .report-list a {
      text-decoration: none;
    }
        
    .index-report-link {
      border: 1px solid ${COLORS.border.light} !important;
      transition: border-color 0.15s ease-in-out !important;
    }
    .index-report-link:hover {
      border-color: ${COLORS.primary.rgb} !important;
    }
    .index-report-link:focus-visible {
      border-color: ${COLORS.primary.rgb};
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }
        
    /* Animation for the progress bars */
    @keyframes loadBar {
      from { width: 0; }
    }
    .progress-bar {
      animation: loadBar 1s ease-out forwards;
    }
  `;
}

/**
 * Generates the CSS block for the <style> tag in the Quarterly Reports List (reports.html) HTML head.
 * @returns {string} The CSS string.
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
        
    /* --- Dynamic Styling for Collapsible Year (is-open) --- */
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

    /* Apply primary background to the entire details element when open */
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
    /* Accessible styles for report card links */
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

module.exports = {
  getReportStyleCss,
  getIndexStyleCss,
  getReportsListStyleCss,
};
