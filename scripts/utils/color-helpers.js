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
 * Generates the final COLORS object with all opacity variants.
 * @param {object} palette The base hex colors
 */
function generateColorsObject(palette) {
  const primaryVariants = generateColorVariants(palette.primary);
  const primary900Variants = generateColorVariants(palette.primary900);
  const neutralVariants = generateColorVariants(palette.neutral);
  const successVariants = generateColorVariants(palette.success);
  const mergedVariants = generateColorVariants(palette.merged);
  const errorVariants = generateColorVariants(palette.error);
  const textPrimaryVariants = generateColorVariants(palette.textPrimary);
  const textSecondaryVariants = generateColorVariants(palette.textSecondary);
  const textMutedVariants = generateColorVariants(palette.textMuted);

  return {
    primary: primaryVariants,
    primary900: primary900Variants,
    gray: neutralVariants,
    status: {
      green: {
        bg: successVariants[10],
        text: successVariants.rgb,
        bgHex: successVariants.hex,
        textRgb: successVariants.rgb,
      },
      purple: {
        bg: mergedVariants[10],
        text: mergedVariants.rgb,
        bgHex: mergedVariants.hex,
        textRgb: mergedVariants.rgb,
      },
      red: {
        bg: errorVariants[10],
        text: errorVariants.rgb,
        bgHex: errorVariants.hex,
        textRgb: errorVariants.rgb,
      },
      gray: {
        bg: neutralVariants[10],
        text: neutralVariants.rgb,
        bgHex: neutralVariants.hex,
        textRgb: neutralVariants.rgb,
      },
    },
    link: {
      text: primaryVariants.rgb,
      textHover: primaryVariants[75],
    },
    background: {
      white: 'rgb(255, 255, 255)',
      altRows: neutralVariants[5],
      light: primaryVariants[5],
      lightGray: neutralVariants[5],
    },
    border: {
      default: neutralVariants[15],
      section: neutralVariants[15],
      bottomAccent: primaryVariants[15],
      light: neutralVariants[10],
    },
    text: {
      primary: textPrimaryVariants.rgb,
      secondary: textSecondaryVariants.rgb,
      muted: textMutedVariants.rgb,
      white: 'rgb(255, 255, 255)',
    },
    sectionAccent: {
      green: successVariants.rgb,
      yellow: '#eab308',
      indigo: primaryVariants.rgb,
    },
    nav: {
      bg: primaryVariants.rgb,
      bgDark: primary900Variants.rgb,
      bgHover: primaryVariants[75],
      text: 'rgb(255, 255, 255)',
    },
  };
}

module.exports = {
  hexToRgb,
  rgbToRgba,
  generateColorVariants,
  generateColorsObject,
};
