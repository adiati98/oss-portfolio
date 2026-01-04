const { generateColorsObject } = require('../utils/color-helpers');
const { generateFaviconSvg, encodeSvg } = require('../utils/icon-processor');
const {
  LANDING_PAGE_ICONS,
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  SEARCH_SVG,
  PULL_REQUEST_LARGE_SVG,
  INFO_ICON_SVG,
  FAVICON_SVG_RAW_TEMPLATE,
} = require('./icons');

/**
 * CENTRALIZED COLOR CONFIGURATION
 * Only modify the hex values below to change the theme.
 */
const COLOR_PALETTE = {
  primary: '#4338CA',
  primary900: '#312E81',
  neutral: '#6b7280',
  success: '#10b981',
  merged: '#8b5cf6',
  error: '#ef4444',
  textPrimary: '#1f2937',
  textSecondary: '#374151',
  textMuted: '#6b7280',
};

// Generate theme-ready colors
const COLORS = generateColorsObject(COLOR_PALETTE);

// Generate browser-ready favicon
const FAVICON_SVG_ENCODED = encodeSvg(
  generateFaviconSvg(FAVICON_SVG_RAW_TEMPLATE, COLOR_PALETTE.primary)
);

/**
 * Generates CSS for dynamic hover effects.
 */
function getHoverStyles() {
  return `
    <style>
      :root {
        --primary-50: ${COLORS.primary[5]};
        --primary-600: ${COLORS.primary.rgb};
        --gray-50: ${COLORS.gray[5]};
      }
      .metric-card-hover:hover {
        background-color: var(--primary-50);
        border-color: var(--primary-600);
      }
      .table-row-hover:hover {
        background-color: var(--primary-50);
      }
    </style>
  `;
}

module.exports = {
  LANDING_PAGE_ICONS,
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  SEARCH_SVG,
  FAVICON_SVG_ENCODED,
  PULL_REQUEST_LARGE_SVG,
  INFO_ICON_SVG,
  COLORS,
  getHoverStyles,
  COLOR_PALETTE,
};
