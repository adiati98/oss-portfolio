const {
  generateColorsObject,
  buildFlatVarsBlock,
  ensureReadableOn,
} = require('../utils/color-helpers');
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

/**
 * DARK-MODE COUNTERPART PALETTE
 * `primary` and `primary900` are intentionally left unchanged: both are used
 * throughout the site as solid backgrounds paired with white text (nav bar,
 * hero stat cards, progress bars) and brightening them would break that
 * contrast. Every other token is brightened for legibility on dark surfaces.
 */
const COLOR_PALETTE_DARK = {
  primary: '#4338CA',
  primary900: '#312E81',
  neutral: '#94a3b8',
  success: '#34d399',
  merged: '#a78bfa',
  error: '#f87171',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  highlightBg: '#1e1b4b',
};

/**
 * The dark-mode surface that primary-colored text/icon colors get checked
 * against. Most of that text sits on `dark:bg-slate-800` cards rather than
 * directly on the `dark:bg-slate-900` page background — cards are the
 * lighter (harder-to-contrast-against) of the two surfaces, so deriving
 * against this one also guarantees AA against the darker page background.
 */
const DARK_CARD_BG = '#1e293b';

/**
 * Lightened, dark-mode-readable variants of brand colors, derived
 * programmatically (not hardcoded) so this stays correct for forks that
 * configure a different `COLOR_PALETTE.primary`. `ensureReadableOn` keeps
 * the same hue/saturation and only raises lightness until it clears WCAG AA
 * (4.5:1) against the dark page background.
 */
const PRIMARY_TEXT_DARK = ensureReadableOn(COLOR_PALETTE.primary, DARK_CARD_BG, 4.5);
const ACCENT_STRONG_DARK = ensureReadableOn(COLOR_PALETTE.primary900, DARK_CARD_BG, 4.5);

/**
 * Single-value (non-laddered) color tokens that aren't part of the main
 * opacity-variant system above.
 */
const FLAT_COLOR_TOKENS = {
  'c-bg-surface': { light: '#ffffff', dark: '#1e293b' }, // card/table surfaces
  'c-accent-yellow': { light: '#eab308', dark: '#facc15' },
  'c-accent-strong': { light: '#3730a3', dark: ACCENT_STRONG_DARK }, // glossary bold text
  'c-primary-text': { light: COLOR_PALETTE.primary, dark: PRIMARY_TEXT_DARK }, // primary-colored TEXT (not fills)
  'c-draft-bg': { light: '#f1f5f9', dark: '#334155' }, // lighter than the slate-800 card behind it
  'c-draft-text': { light: '#475569', dark: '#e2e8f0' },
  'c-draft-border': { light: '#cbd5e1', dark: '#64748b' },
};

// Generate theme-ready colors (every leaf is a CSS var() reference)
const { colors: COLORS, cssVarsBlock: PALETTE_CSS_VARS } = generateColorsObject(
  COLOR_PALETTE,
  COLOR_PALETTE_DARK,
  FLAT_COLOR_TOKENS
);

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
    bg: 'var(--wb-ongoing-bg)',
    text: 'var(--wb-ongoing-text)',
    border: 'var(--wb-ongoing-border)',
  },
  todo: {
    bg: 'var(--wb-todo-bg)',
    text: 'var(--wb-todo-text)',
    border: 'var(--wb-todo-border)',
  },
  bot: {
    bg: 'var(--wb-bot-bg)',
    text: 'var(--wb-bot-text)',
    border: 'var(--wb-bot-border)',
  },
  emptyMessage: {
    text: 'var(--wb-empty-text)',
  },
  draft: {
    bg: 'var(--c-draft-bg)',
    text: 'var(--c-draft-text)',
    border: 'var(--c-draft-border)',
  },
};

/**
 * WORKBENCH BALL-TRACKING CONFIGURATION
 */
const WORKBENCH_BALL_STATUS = {
  waiting: {
    dot: 'var(--wb-waiting-dot)',
    text: 'var(--wb-waiting-text)',
    label: 'Waiting',
  },
  takeAction: {
    dot: 'var(--wb-takeaction-dot)',
    text: 'var(--wb-takeaction-text)',
    label: 'Take Action',
  },
  watching: {
    dot: 'var(--wb-watching-dot)',
    text: 'var(--wb-watching-text)',
    label: 'Watching',
  },
  approved: {
    dot: COLORS.primary[500],
    text: COLORS.primary[700],
    label: 'Approved',
  },
  stale: {
    dot: 'var(--wb-stale-dot)',
    text: 'var(--wb-stale-text)',
    label: 'Stale',
  },
};

const WORKBENCH_CSS_VARS = buildFlatVarsBlock({
  'wb-ongoing-bg': { light: '#ecfeff', dark: '#083344' },
  'wb-ongoing-text': { light: '#086788', dark: '#67e8f9' },
  'wb-ongoing-border': { light: '#a5f3fc', dark: '#0e7490' },
  'wb-todo-bg': { light: '#fff7ed', dark: '#431407' },
  'wb-todo-text': { light: '#c2410c', dark: '#fdba74' },
  'wb-todo-border': { light: '#fdba74', dark: '#c2410c' },
  'wb-bot-bg': { light: '#f8fafc', dark: '#1e293b' },
  'wb-bot-text': { light: '#475569', dark: '#cbd5e1' },
  'wb-bot-border': { light: '#e2e8f0', dark: '#475569' },
  'wb-empty-text': { light: '#991b1b', dark: '#fca5a5' },
  'wb-waiting-dot': { light: '#84cc16', dark: '#a3e635' },
  'wb-waiting-text': { light: '#4d7c0f', dark: '#bef264' },
  'wb-takeaction-dot': { light: '#d946ef', dark: '#e879f9' },
  'wb-takeaction-text': { light: '#a21caf', dark: '#f0abfc' },
  'wb-watching-dot': { light: '#0ea5e9', dark: '#38bdf8' },
  'wb-watching-text': { light: '#0369a1', dark: '#7dd3fc' },
  'wb-stale-dot': { light: '#94a3b8', dark: '#cbd5e1' },
  'wb-stale-text': { light: '#64748b', dark: '#94a3b8' },
});

/**
 * Combined `:root{...} html.dark{...}` CSS variable declarations for every
 * color token used across the site. Interpolated once into the shared base
 * CSS (see getCommonBaseCss in style-generator.js) so every generated page
 * picks it up.
 */
const THEME_CSS_VARS = `${PALETTE_CSS_VARS}\n${WORKBENCH_CSS_VARS}`;

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
  THEME_CSS_VARS,
};
