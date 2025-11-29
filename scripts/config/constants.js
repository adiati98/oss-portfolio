/**
 * Shared SVG definitions for consistent styling across multiple report pages.
 */
const LEFT_ARROW_SVG = `
    <svg class="w-4 h-4" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 17L13 12L18 7M11 17L6 12L11 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`;

const RIGHT_ARROW_SVG = `
    <svg class="w-4 h-4" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 17L11 12L6 7M13 17L18 12L13 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`;

/**
 * SVG for the Search icon (used in table filter inputs).
 * Class w-5 h-5 for sizing, stroke-width 2 for boldness.
 */
const SEARCH_SVG = `
  <svg class="w-5 h-5" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19ZM21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

// Define the raw SVG for the favicon
// The fill color will be replaced with the primary color from COLOR_PALETTE dynamically
const FAVICON_SVG_RAW_TEMPLATE = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
  <path fill='{{COLOR}}' fill-rule='evenodd' d='M5.75 21a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 19.25a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM5.75 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM18.25 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM15 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0z'/>
  <path fill='{{COLOR}}' fill-rule='evenodd' d='M5.75 16.75A.75.75 0 006.5 16V8A.75.75 0 005 8v8c0 .414.336.75.75.75z'/>
  <path fill='{{COLOR}}' fill-rule='evenodd' d='M17.5 8.75v-1H19v1a3.75 3.75 0 01-3.75 3.75h-7a1.75 1.75 0 00-1.75 1.75H5A3.25 3.25 0 018.25 11h7a2.25 2.25 0 002.25-2.25z'/>
</svg>
`
  .replace(/\s+/g, ' ') // Remove extra whitespace/newlines for cleaner encoding
  .trim();

/**
 * Generates the favicon SVG with the specified color.
 * @param {string} colorHex The hex color to use for the favicon
 * @returns {string} The SVG string with the color applied
 */
function generateFaviconSvg(colorHex) {
  return FAVICON_SVG_RAW_TEMPLATE.replace(/{{COLOR}}/g, colorHex);
}

// Function to safely encode the SVG for use in a data URI
function encodeSvg(svgString) {
  // 1. URL-encode reserved characters (%, #, etc.)
  let encoded = encodeURIComponent(svgString);
  // 2. Fix characters that should NOT be encoded for data URIs (but encodeURIComponent does)
  encoded = encoded
    .replace(/'/g, '%27') // Single quotes
    .replace(/"/g, '%22'); // Double quotes

  // 3. Fix characters that should be encoded for HTML attributes (but encodeURIComponent does not)
  encoded = encoded
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/&/g, '%26')
    .replace(/#/g, '%23');

  return encoded;
}

// This will be set after COLOR_PALETTE is defined
let FAVICON_SVG_ENCODED = null;

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
 * CENTRALIZED COLOR CONFIGURATION
 * ================================
 *
 * This object defines all colors used throughout the generated HTML reports.
 * ONLY MODIFY THE HEX VALUES BELOW - all opacity variants are automatically generated.
 */
const COLOR_PALETTE = {
  primary: '#4338CA', // Indigo - for main UI elements, headers, buttons
  primary900: '#312E81', // Dark indigo - for darker background
  neutral: '#6b7280', // Gray - for neutral elements, borders
  success: '#10b981', // Green - for OPEN status
  merged: '#8b5cf6', // Purple - for MERGED status
  error: '#ef4444', // Red - for CLOSED status
  textPrimary: '#1f2937', // Dark gray - for main text and headings
  textSecondary: '#374151', // Darker gray - for descriptions
  textMuted: '#6b7280', // Medium gray - for timestamps and muted info
};

/**
 * Generates the final COLORS object with all opacity variants.
 * This replaces manual color definitions with auto-generated variants.
 */
function generateColorsObject() {
  const primaryVariants = generateColorVariants(COLOR_PALETTE.primary);
  const primary900Variants = generateColorVariants(COLOR_PALETTE.primary900);
  const neutralVariants = generateColorVariants(COLOR_PALETTE.neutral);
  const successVariants = generateColorVariants(COLOR_PALETTE.success);
  const mergedVariants = generateColorVariants(COLOR_PALETTE.merged);
  const errorVariants = generateColorVariants(COLOR_PALETTE.error);
  const textPrimaryVariants = generateColorVariants(COLOR_PALETTE.textPrimary);
  const textSecondaryVariants = generateColorVariants(COLOR_PALETTE.textSecondary);
  const textMutedVariants = generateColorVariants(COLOR_PALETTE.textMuted);

  return {
    // Primary accent color
    primary: primaryVariants,
    // Dark primary color
    primary900: primary900Variants,
    // Neutral grays
    gray: neutralVariants,
    // Status badge colors
    status: {
      green: {
        bg: successVariants[10], // 10% opacity for background
        text: successVariants.rgb, // 100% opacity for text
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
    // Link colors
    link: {
      text: primaryVariants.rgb,
      textHover: primaryVariants[75],
    },
    // Background colors
    background: {
      white: 'rgb(255, 255, 255)',
      altRows: neutralVariants[5],
      light: primaryVariants[5], // Light primary background
      lightGray: neutralVariants[5], // Light gray background
    },
    // Border colors
    border: {
      default: neutralVariants[15],
      section: neutralVariants[15],
      bottomAccent: primaryVariants[15],
      light: neutralVariants[10],
    },
    // Text colors - multiple variants
    text: {
      primary: textPrimaryVariants.rgb,
      secondary: textSecondaryVariants.rgb,
      muted: textMutedVariants.rgb,
      white: 'rgb(255, 255, 255)',
    },
    // Accent borders for section headings
    sectionAccent: {
      green: successVariants.rgb,
      yellow: '#eab308',
      indigo: primaryVariants.rgb,
    },
    // Navigation and header colors
    nav: {
      bg: primaryVariants.rgb, // Navigation background
      bgDark: primary900Variants.rgb, // Darker shade for mobile menu
      bgHover: primaryVariants[75], // Hover state
      text: 'rgb(255, 255, 255)', // Navigation text
    },
  };
}

const COLORS = generateColorsObject();

// Initialize favicon after COLOR_PALETTE is defined
FAVICON_SVG_ENCODED = encodeSvg(generateFaviconSvg(COLOR_PALETTE.primary));

/**
 * Generates CSS with custom properties for hover effects.
 * This approach ensures hover effects work correctly with the generated colors.
 *
 * Returns: <style> tag with CSS rules for safe hover effects
 */
function getHoverStyles() {
  const primaryVariants = generateColorVariants(COLOR_PALETTE.primary);
  const neutralVariants = generateColorVariants(COLOR_PALETTE.neutral);

  return `
    <style>
      /* CSS Custom Properties for easy customization */
      :root {
        --primary-50: ${primaryVariants[5]};
        --primary-600: ${primaryVariants.rgb};
        --gray-50: ${neutralVariants[5]};
      }
      
      /* Safe hover effect for metric cards */
      .metric-card-hover:hover {
        background-color: var(--primary-50);
        border-color: var(--primary-600);
      }
      
      /* Safe hover effect for table rows */
      .table-row-hover:hover {
        background-color: var(--primary-50);
      }
    </style>
  `;
}

module.exports = {
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  SEARCH_SVG,
  FAVICON_SVG_ENCODED,
  COLORS,
  getHoverStyles,
  hexToRgb,
  rgbToRgba,
  generateColorVariants,
  COLOR_PALETTE,
};
