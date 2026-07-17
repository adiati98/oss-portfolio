const { generateColorsObject, buildFlatVarsBlock } = require('../utils/color-helpers');
const { THEME, THEME_TOKENS_CSS, mixHex } = require('./theme-engine');
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
 * LEGACY COLOR SURFACE — derived, not configured.
 *
 * Every value below comes from the five seeds in scripts/config/theme.js via
 * theme-engine.js (which also WCAG-gates the derivations). The exports keep
 * their historical names and shapes so existing generators continue to work
 * unchanged; new code should prefer the `--t-*` tokens in THEME_TOKENS_CSS.
 *
 * Semantic mapping (see design blueprint §01):
 *   primary            → brand seed
 *   success / merged   → positive ladder (the old violet "merged" is retired)
 *   error              → critical ladder
 *   take-action        → caution ladder      watching → brand ladder
 *   waiting / approved → positive ladder     stale/bot → neutral ladder
 */
const S = THEME.semantic;
const L = THEME.light;
const D = THEME.dark;

const COLOR_PALETTE = {
  primary: THEME.seeds.brand,
  primary900: S.brand.light.strong,
  neutral: THEME.seeds.neutral,
  success: THEME.seeds.positive,
  merged: THEME.seeds.positive,
  error: THEME.seeds.critical,
  textPrimary: L.ink,
  textSecondary: L.ink2,
  textMuted: mixHex(L.ink2, L.ink3, 0.5),
  highlightBg: S.brand.light.wash,
};

/**
 * Dark-mode counterparts. `primary` and `primary900` intentionally stay on
 * the light-theme values: both are used as solid fills paired with on-brand
 * text (nav bar, hero cards, progress bars), and brightening them would
 * break that contrast — same rule as before, now derived.
 */
const COLOR_PALETTE_DARK = {
  primary: THEME.seeds.brand,
  primary900: S.brand.light.strong,
  neutral: S.neutral.dark.text,
  success: S.positive.dark.text,
  merged: S.positive.dark.text,
  error: S.critical.dark.text,
  textPrimary: D.ink,
  textSecondary: D.ink2,
  textMuted: D.ink3,
  highlightBg: S.brand.dark.wash,
};

/**
 * Single-value (non-laddered) tokens. The old hand-picked values are now
 * ladder lookups; the yellow accent is retired in favor of the caution seed.
 */
const FLAT_COLOR_TOKENS = {
  'c-bg-surface': { light: L.card, dark: D.card },
  'c-accent-yellow': { light: S.caution.light.text, dark: S.caution.dark.text },
  'c-accent-strong': { light: S.brand.light.strong, dark: S.brand.dark.text },
  'c-primary-text': { light: S.brand.light.text, dark: S.brand.dark.text },
  'c-draft-bg': { light: S.neutral.light.wash, dark: S.neutral.dark.wash },
  'c-draft-text': { light: L.ink2, dark: D.ink },
  'c-draft-border': { light: L.line2, dark: D.line2 },
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
    dot: COLORS.primary[500] || COLORS.primary.rgb,
    text: COLORS.primaryText,
    label: 'Approved',
  },
  stale: {
    dot: 'var(--wb-stale-dot)',
    text: 'var(--wb-stale-text)',
    label: 'Stale',
  },
};

const WORKBENCH_CSS_VARS = buildFlatVarsBlock({
  'wb-ongoing-bg': { light: S.brand.light.wash, dark: S.brand.dark.wash },
  'wb-ongoing-text': { light: S.brand.light.text, dark: S.brand.dark.text },
  'wb-ongoing-border': { light: S.brand.light.line, dark: S.brand.dark.line },
  'wb-todo-bg': { light: S.caution.light.wash, dark: S.caution.dark.wash },
  'wb-todo-text': { light: S.caution.light.text, dark: S.caution.dark.text },
  'wb-todo-border': { light: S.caution.light.line, dark: S.caution.dark.line },
  'wb-bot-bg': { light: S.neutral.light.wash, dark: S.neutral.dark.wash },
  'wb-bot-text': { light: S.neutral.light.text, dark: S.neutral.dark.text },
  'wb-bot-border': { light: S.neutral.light.line, dark: S.neutral.dark.line },
  // Empty workbench = success framing ("your court is clear"), not an error.
  'wb-empty-text': { light: S.positive.light.text, dark: S.positive.dark.text },
  'wb-waiting-dot': { light: S.positive.light.text, dark: S.positive.dark.text },
  'wb-waiting-text': { light: S.positive.light.text, dark: S.positive.dark.text },
  'wb-takeaction-dot': { light: S.caution.light.text, dark: S.caution.dark.text },
  'wb-takeaction-text': { light: S.caution.light.text, dark: S.caution.dark.text },
  'wb-watching-dot': { light: S.brand.light.text, dark: S.brand.dark.text },
  'wb-watching-text': { light: S.brand.light.text, dark: S.brand.dark.text },
  'wb-stale-dot': { light: S.neutral.light.text, dark: S.neutral.dark.text },
  'wb-stale-text': { light: S.neutral.light.text, dark: S.neutral.dark.text },
});

/**
 * Combined `:root{...} html.dark{...}` CSS variable declarations for every
 * color token used across the site: the legacy laddered vars, the workbench
 * vars, and the new `--t-*` design tokens from the theme engine.
 */
const THEME_CSS_VARS = `${PALETTE_CSS_VARS}\n${WORKBENCH_CSS_VARS}\n${THEME_TOKENS_CSS}`;

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
  THEME,
};
