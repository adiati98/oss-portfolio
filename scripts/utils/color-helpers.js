/**
 * Converts a hex color to RGB object.
 * @param {string} hex The hex color (e.g., '#4338CA' or '#4f46e5')
 * @returns {object|null} Object with r, g, b properties or null if invalid
 */
function hexToRgb(hex) {
  // Remove '#' if present
  let cleanHex = hex.replace(/^#/, '');

  // Handle shorthand hex (e.g., #FFF -> #FFFFFF)
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  // Validate hex format
  if (!/^[0-9A-F]{6}$/i.test(cleanHex)) {
    console.error(`Invalid hex color: ${hex}`);
    return null;
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Converts RGB to rgba string with opacity.
 * @param {object} rgb Object with r, g, b properties
 * @param {number} opacity Opacity value (0-1, or 0-100 for percentage)
 * @returns {string} CSS rgba string (e.g., 'rgba(79, 70, 229, 0.1)')
 */
function rgbToRgba(rgb, opacity) {
  if (!rgb) return null;
  // Convert percentage (0-100) to decimal (0-1) if needed
  const alpha = opacity > 1 ? opacity / 100 : opacity;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Generates color variants with different opacity levels from a hex color.
 * @param {string} hex The hex color
 * @returns {object} Object with variants at different opacity levels
 */
function generateColorVariants(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return {};

  return {
    hex: hex,
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    5: rgbToRgba(rgb, 0.05),
    10: rgbToRgba(rgb, 0.1),
    15: rgbToRgba(rgb, 0.15),
    25: rgbToRgba(rgb, 0.25),
    50: rgbToRgba(rgb, 0.5),
    75: rgbToRgba(rgb, 0.75),
    100: rgbToRgba(rgb, 1.0),
  };
}

/**
 * Converts a hex color to HSL.
 * @param {string} hex The hex color
 * @returns {{h: number, s: number, l: number}} Hue (0-360), saturation/lightness (0-100)
 */
function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL back to a hex color.
 */
function hslToHex(h, s, l) {
  const hN = ((h % 360) + 360) % 360;
  const sN = Math.min(100, Math.max(0, s)) / 100;
  const lN = Math.min(100, Math.max(0, l)) / 100;

  if (sN === 0) {
    const v = Math.round(lN * 255);
    const hex = v.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`.toUpperCase();
  }

  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  const m = lN - c / 2;

  let [r, g, b] = [0, 0, 0];
  if (hN < 60) [r, g, b] = [c, x, 0];
  else if (hN < 120) [r, g, b] = [x, c, 0];
  else if (hN < 180) [r, g, b] = [0, c, x];
  else if (hN < 240) [r, g, b] = [0, x, c];
  else if (hN < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * WCAG relative luminance of a hex color.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * WCAG contrast ratio between two hex colors (1 to 21).
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function getContrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Lightens `hex` in HSL space (preserving its hue/saturation) until it
 * reaches at least `minRatio` WCAG contrast against `bgHex`. This is what
 * makes the dark-mode palette brand-agnostic: whatever `primary` color a
 * fork configures, its dark-mode text variant is derived to stay readable
 * on a dark background instead of relying on a hardcoded hex.
 * @param {string} hex - The color to adjust (e.g. the light-mode brand color)
 * @param {string} bgHex - The background it will be read against
 * @param {number} minRatio - Minimum WCAG contrast ratio to reach (4.5 = AA for normal text)
 * @returns {string} A hex color, lightened just enough to pass `minRatio`
 */
function ensureReadableOn(hex, bgHex, minRatio = 4.5) {
  const { h, s, l } = hexToHsl(hex);
  let lightness = l;
  let candidate = hex;
  let iterations = 0;

  // Step lightness up in small increments rather than jumping straight to
  // white, so the result still reads as "the brand color, brightened" and
  // not as a generic off-white.
  while (getContrastRatio(candidate, bgHex) < minRatio && lightness < 96 && iterations < 25) {
    lightness += 4;
    candidate = hslToHex(h, s, lightness);
    iterations++;
  }

  return candidate;
}

const OPACITY_LEVELS = [5, 10, 15, 25, 50, 75, 100];

/**
 * Theme-color tokens that get a full opacity ladder (hex, rgb, and each
 * OPACITY_LEVELS entry), keyed by their COLOR_PALETTE property name and
 * the CSS variable prefix they should be declared under.
 */
const LADDERED_TOKENS = {
  primary: 'c-primary',
  primary900: 'c-primary900',
  neutral: 'c-neutral',
  success: 'c-success',
  merged: 'c-merged',
  error: 'c-error',
  textPrimary: 'c-text-primary',
  textSecondary: 'c-text-secondary',
  textMuted: 'c-text-muted',
};

function varRef(name) {
  return `var(--${name})`;
}

/**
 * Builds the {hex, rgb, 5, 10, ...} shape for a token, but every leaf is a
 * CSS var() reference instead of a literal color.
 */
function buildVarRefs(varName) {
  const refs = { hex: varRef(`${varName}-hex`), rgb: varRef(`${varName}-rgb`) };
  OPACITY_LEVELS.forEach((level) => {
    refs[level] = varRef(`${varName}-${level}`);
  });
  return refs;
}

/**
 * Appends the literal `--name: value;` declarations for one token's full
 * opacity ladder into the given light/dark line buffers.
 */
function pushTokenDeclarations(varName, lightHex, darkHex, lightLines, darkLines) {
  const light = generateColorVariants(lightHex);
  const dark = generateColorVariants(darkHex);

  lightLines.push(`--${varName}-hex: ${light.hex};`, `--${varName}-rgb: ${light.rgb};`);
  darkLines.push(`--${varName}-hex: ${dark.hex};`, `--${varName}-rgb: ${dark.rgb};`);

  OPACITY_LEVELS.forEach((level) => {
    lightLines.push(`--${varName}-${level}: ${light[level]};`);
    darkLines.push(`--${varName}-${level}: ${dark[level]};`);
  });
}

/**
 * Generates the COLORS object (every leaf is a CSS var() reference) plus the
 * matching `:root { ... } html.dark { ... }` variable declarations needed to
 * make those references resolve correctly in each theme.
 *
 * @param {object} lightPalette - hex colors for the light theme (COLOR_PALETTE shape)
 * @param {object} darkPalette - hex colors for the dark theme (same shape)
 * @param {object} flatTokens - single-value (non-laddered) tokens, e.g.
 *   { 'c-bg-surface': { light: '#ffffff', dark: '#1e293b' } }
 * @returns {{colors: object, cssVarsBlock: string}}
 */
function generateColorsObject(lightPalette, darkPalette, flatTokens = {}) {
  const lightLines = [];
  const darkLines = [];
  const refs = {};

  Object.entries(LADDERED_TOKENS).forEach(([key, varName]) => {
    refs[key] = buildVarRefs(varName);
    pushTokenDeclarations(varName, lightPalette[key], darkPalette[key], lightLines, darkLines);
  });

  const flatRefs = {};
  Object.entries(flatTokens).forEach(([varName, { light, dark }]) => {
    flatRefs[varName] = varRef(varName);
    lightLines.push(`--${varName}: ${light};`);
    darkLines.push(`--${varName}: ${dark};`);
  });

  const colors = {
    primary: refs.primary,
    primary900: refs.primary900,
    // Same brand hue as `primary`, but lightened for dark mode so primary-
    // colored TEXT/icons/accents stay readable on a dark page. Use this
    // (not `primary`) for anything that ISN'T a solid fill with white text
    // on top — those must keep `primary` fixed or they lose contrast.
    primaryText: flatRefs['c-primary-text'] || refs.primary.rgb,
    gray: refs.neutral,
    status: {
      green: {
        bg: refs.success[10],
        text: refs.success.rgb,
        bgHex: refs.success.hex,
        textRgb: refs.success.rgb,
      },
      purple: {
        bg: refs.merged[10],
        text: refs.merged.rgb,
        bgHex: refs.merged.hex,
        textRgb: refs.merged.rgb,
      },
      red: {
        bg: refs.error[10],
        text: refs.error.rgb,
        bgHex: refs.error.hex,
        textRgb: refs.error.rgb,
      },
      gray: {
        bg: refs.neutral[10],
        text: refs.neutral.rgb,
        bgHex: refs.neutral.hex,
        textRgb: refs.neutral.rgb,
      },
    },
    link: {
      text: refs.primary.rgb,
      textHover: refs.primary[75],
    },
    background: {
      white: flatRefs['c-bg-surface'] || 'rgb(255, 255, 255)',
      altRows: refs.neutral[5],
      light: refs.primary[5],
      lightGray: refs.neutral[5],
    },
    border: {
      default: refs.neutral[15],
      section: refs.neutral[15],
      bottomAccent: refs.primary[15],
      light: refs.neutral[10],
    },
    text: {
      primary: refs.textPrimary.rgb,
      secondary: refs.textSecondary.rgb,
      muted: refs.textMuted.rgb,
      white: 'rgb(255, 255, 255)',
    },
    sectionAccent: {
      green: refs.success.rgb,
      yellow: flatRefs['c-accent-yellow'] || '#eab308',
      indigo: refs.primary.rgb,
    },
    nav: {
      bg: refs.primary.rgb,
      bgDark: refs.primary900.rgb,
      bgHover: refs.primary[75],
      text: 'rgb(255, 255, 255)',
    },
  };

  const cssVarsBlock = [
    ':root {',
    ...lightLines.map((line) => `  ${line}`),
    '}',
    'html.dark {',
    ...darkLines.map((line) => `  ${line}`),
    '}',
  ].join('\n');

  return { colors, cssVarsBlock };
}

/**
 * Builds a `:root { ... } html.dark { ... }` declarations block for a flat
 * set of single-value tokens that aren't part of the main palette/COLORS
 * object (e.g. workbench status colors).
 * @param {object} tokens - { varName: { light: value, dark: value } }
 */
function buildFlatVarsBlock(tokens) {
  const lightLines = [];
  const darkLines = [];
  Object.entries(tokens).forEach(([varName, { light, dark }]) => {
    lightLines.push(`--${varName}: ${light};`);
    darkLines.push(`--${varName}: ${dark};`);
  });
  return [
    ':root {',
    ...lightLines.map((line) => `  ${line}`),
    '}',
    'html.dark {',
    ...darkLines.map((line) => `  ${line}`),
    '}',
  ].join('\n');
}

/**
 * Safely extracts a color string from a potential color object or string.
 * This is useful for accessing the generated COLORS object which contains nested variants.
 * @param {string|object} color - The color entry (e.g., COLORS.primary or COLORS.text.secondary)
 * @param {string} fallback - A hex or rgb string if the color is undefined
 * @returns {string} The CSS color value
 */
function getColorValue(color, fallback = '#000000') {
  if (!color) return fallback;
  if (typeof color === 'string') return color;
  // Prioritize .rgb, then .hex, then the object itself if it happens to be a string
  return color.rgb || color.hex || (typeof color === 'object' ? fallback : color);
}

module.exports = {
  hexToRgb,
  rgbToRgba,
  hexToHsl,
  hslToHex,
  relativeLuminance,
  getContrastRatio,
  ensureReadableOn,
  generateColorVariants,
  generateColorsObject,
  buildFlatVarsBlock,
  getColorValue,
};
