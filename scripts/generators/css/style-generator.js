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
 * Generates the CSS block for the <style> tag in the All-Time Contributions and Landing Page head.
 * @returns {string} The CSS string.
 */
function getIndexStyleCss() {
  return dedent`
    ${getCommonBaseCss()}
    /* Feature card specific overrides at landing page*/
    .feature-card:hover { 
      border-color: ${COLORS.primary.rgb} !important; 
      box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1); 
    }
    .feature-card svg { 
      width: 1.75rem; 
      height: 1.75rem; 
      display: block; 
    }

    /* Base styles for the link */
    a.browse-reports {
      color: ${COLORS.text.secondary};
      text-decoration: none;
    }

    /* Hover state */
    a.browse-reports:hover {
      color: ${COLORS.text.primary};
      text-decoration: underline;
      text-decoration-color: ${COLORS.primary.rgb};
      transition: color 0.2s ease-in-out, text-decoration-color 0.2s ease-in-out;
    }

    .index-report-link {
      border: 1px solid ${COLORS.border.light} !important;
      transition: border-color 0.15s ease-in-out, box-shadow 0.2s;
    }
    .index-report-link:hover {
      border-color: ${COLORS.primary.rgb} !important;
    }

    .index-report-link svg { 
      transition: transform 0.2s; 
    }
    .index-report-link:hover svg { 
      transform: translateX(4px); 
    }

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
      display: list-item;
      white-space: nowrap;
    }
    summary:focus-visible {
      outline: 2px solid ${COLORS.primary.rgb};
      outline-offset: 2px;
    }

    /* Keeps icon and text aligned horizontally inside summary */
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

    /* Table Header Sorting Alignment */
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

    /* Highlight the arrow for standard and custom status sorts */
    th.sort-asc .sort-icon,
    th.sort-desc .sort-icon,
    th.sort-custom1 .sort-icon,
    th.sort-custom2 .sort-icon {
      opacity: 1 !important;
      color: ${COLORS.primary.rgb} !important;
      font-weight: bold;
    }

    /* Search Bar Icon Positioning */
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

    /* Mobile Screen Optimization (320px screens) */
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

module.exports = {
  getReportStyleCss,
  getIndexStyleCss,
  getReportsListStyleCss,
};
