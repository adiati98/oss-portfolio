const { generateColorsObject } = require('../utils/color-helpers');
const { generateFaviconSvg, encodeSvg } = require('../utils/icon-processor');
const {
  LANDING_PAGE_ICONS,
  SPARKLES_SVG,
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  SEARCH_SVG,
  PULL_REQUEST_LARGE_SVG,
  INFO_ICON_SVG,
  FAVICON_SVG_RAW_TEMPLATE,
} = require('./icons');

/**
 * CENTRALIZED COLOR CONFIGURATION
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
  highlightBg: '#eef2ff',
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

/**
 * WORKBENCH STATUS CONFIGURATION
 * Specific color pairs for the Active Workbench dashboard
 */
const WORKBENCH_STATUS_COLORS = {
  ongoing: {
    bg: '#ecfeff',
    text: '#086788',
    border: '#a5f3fc',
  },
  todo: {
    bg: '#fff7ed',
    text: '#c2410c',
    border: '#fdba74',
  },
  bot: {
    bg: '#f8fafc',
    text: '#475569',
    border: '#e2e8f0',
  },
  emptyMessage: {
    text: '#991b1b',
  },
};

/**
 * WORKBENCH BALL-TRACKING CONFIGURATION
 */
const WORKBENCH_BALL_STATUS = {
  waiting: {
    dot: '#84cc16',
    text: '#4d7c0f',
    label: 'Waiting',
  },
  takeAction: {
    dot: '#d946ef',
    text: '#a21caf',
    label: 'Take Action',
  },
  watching: {
    dot: '#0ea5e9',
    text: '#0369a1',
    label: 'Watching',
  },
  approved: {
    dot: COLORS.primary[500],
    text: COLORS.primary[700],
    label: 'Approved',
  },
  stale: {
    dot: '#94a3b8',
    text: '#64748b',
    label: 'Stale',
  },
};

module.exports = {
  LANDING_PAGE_ICONS,
  SPARKLES_SVG,
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  SEARCH_SVG,
  FAVICON_SVG_ENCODED,
  PULL_REQUEST_LARGE_SVG,
  INFO_ICON_SVG,
  COLORS,
  getHoverStyles,
  COLOR_PALETTE,
  WORKBENCH_STATUS_COLORS,
  WORKBENCH_BALL_STATUS,
};
