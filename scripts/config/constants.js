/**
 * Shared SVG definitions for consistent styling across multiple report pages.
 */
const LANDING_PAGE_ICONS = {
  stats: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 13.125C3 12.5037 3.50368 12 4.125 12H5.625C6.24632 12 6.75 12.5037 6.75 13.125V18.375C6.75 18.9963 6.24632 19.5 5.625 19.5H4.125C3.50368 19.5 3 18.9963 3 18.375V13.125Z"/><path d="M8.625 7.125C8.625 6.50368 9.12868 6 9.75 6H11.25C11.8713 6 12.375 6.50368 12.375 7.125V18.375C12.375 18.9963 11.8713 19.5 11.25 19.5H9.75C9.12868 19.5 8.625 18.9963 8.625 18.375V7.125Z"/><path d="M14.25 3.375C14.25 2.75368 14.7537 2.25 15.375 2.25H16.875C17.4963 2.25 18 2.75368 18 3.375V18.375C18 18.9963 17.4963 19.5 16.875 19.5H15.375C14.7537 19.5 14.25 18.9963 14.25 18.375V3.375Z"/>
    </svg>
  `,
  breakdown: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5M3.75 20.25h16.5M3.75 3.75h16.5M3.75 3.75v16.5m16.5-16.5v16.5" />
    </svg>
  `,
  topRepos: `
    <svg class="w-6 h-6" viewBox="0 0 15 15" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 0C3.67157 0 3 0.671573 3 1.5V2H2.5C1.11929 2 0 3.11929 0 4.5C0 5.88071 1.11929 7 2.5 7H3.25606C3.82053 8.59703 5.26092 9.78029 7 9.97254V14H4V15H11V14H8V9.97254C9.73908 9.78029 11.1795 8.59703 11.7439 7H12.5C13.8807 7 15 5.88071 15 4.5C15 3.11929 13.8807 2 12.5 2H12V1.5C12 0.671573 11.3284 0 10.5 0H4.5ZM12 3V5.5C12 5.669 11.9907 5.83583 11.9725 6H12.5C13.3284 6 14 5.32843 14 4.5C14 3.67157 13.3284 3 12.5 3H12ZM2.5 3H3V5.5C3 5.669 3.00932 5.83583 3.02746 6H2.5C1.67157 6 1 5.32843 1 4.5C1 3.67157 1.67157 3 2.5 3Z" />
    </svg>
  `,
  merged: `
    <svg class="w-6 h-6" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.308 14.459c-1.36 0-2.53 0.751-3.158 1.853-0.164-0.012-0.325-0.026-0.496-0.026-3.742 0-7.292-2.85-8.588-6.379 0.779-0.67 1.279-1.651 1.279-2.757 0-2.017-1.637-3.654-3.654-3.654s-3.654 1.637-3.654 3.654c0 1.348 0.738 2.514 1.827 3.148v11.975c-1.089 0.633-1.827 1.799-1.827 3.147 0 2.016 1.637 3.654 3.654 3.654s3.654-1.638 3.654-3.654c0-1.349-0.738-2.514-1.827-3.147v-6.574c2.403 2.542 5.72 4.24 9.135 4.24 0.182 0 0.332-0.012 0.496-0.018 0.632 1.097 1.802 1.845 3.158 1.845 2.016 0 3.654-1.638 3.654-3.654s-1.638-3.654-3.654-3.654zM8.692 27.248c-1.008 0-1.827-0.817-1.827-1.827 0-1.008 0.819-1.827 1.827-1.827 1.011 0 1.827 0.819 1.827 1.827 0 1.010-0.816 1.827-1.827 1.827zM8.692 8.977c-1.008 0-1.827-0.816-1.827-1.827s0.819-1.827 1.827-1.827c1.011 0 1.827 0.816 1.827 1.827s-0.816 1.827-1.827 1.827zM23.308 19.94c-1.008 0-1.827-0.817-1.827-1.827s0.819-1.827 1.827-1.827c1.010 0 1.827 0.816 1.827 1.827s-0.817 1.827-1.827 1.827z" />
    </svg>
  `,
  issues: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" d="M2.5 12a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm0 13a2 2 0 100-4 2 2 0 000 4z"/>
    </svg>
  `,
  reviewed: `
    <svg class="w-6 h-6" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M27,5H5C3.3,5,2,6.3,2,8v14c0,1.7,1.3,3,3,3h16.4l7,5.8c0.2,0.2,0.4,0.2,0.6,0.2c0.1,0,0.3,0,0.4-0.1 c0.4-0.2,0.6-0.5,0.6-0.9V8C30,6.3,28.7,5,27,5z M17.7,14.3l-2.1,2.1l0.5,2.9c0.1,0.4-0.1,0.8-0.4,1c-0.2,0.1-0.4,0.2-0.6,0.2 c-0.2,0-0.3,0-0.5-0.1L12,18.9l-2.6,1.4c-0.3,0.2-0.7,0.2-1.1-0.1c-0.3-0.2-0.5-0.6-0.4-1l0.5-2.9l-2.1-2.1C6,14,5.9,13.6,6,13.3 c0.1-0.4,0.4-0.6,0.8-0.7l2.9-0.4l1.3-2.7c0.3-0.7,1.5-0.7,1.8,0l1.3,2.7l2.9,0.4c0.4,0.1,0.7,0.3,0.8,0.7 C18.1,13.6,18,14,17.7,14.3z M25,18h-3c-0.6,0-1-0.4-1-1s0.4-1,1-1h3c0.6,0,1,0.4,1,1S25.6,18,25,18z M25,14h-5c-0.6,0-1-0.4-1-1 s0.4-1,1-1h5c0.6,0,1,0.4,1,1S25.6,14,25,14z"/>
    </svg>
  `,
  coAuthored: `
    <svg class="w-6 h-6" viewBox="0 0 964.07 964.07" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M850.662,877.56c-0.77,0.137-4.372,0.782-10.226,1.831c-230.868,41.379-273.337,48.484-278.103,49.037 c-11.37,1.319-19.864,0.651-25.976-2.042c-3.818-1.682-5.886-3.724-6.438-4.623c0.268-1.597,2.299-5.405,3.539-7.73 c1.207-2.263,2.574-4.826,3.772-7.558c7.945-18.13,2.386-36.521-14.51-47.999c-12.599-8.557-29.304-12.03-49.666-10.325 c-12.155,1.019-225.218,36.738-342.253,56.437l-57.445,45.175c133.968-22.612,389.193-65.433,402.622-66.735 c11.996-1.007,21.355,0.517,27.074,4.4c3.321,2.257,2.994,3.003,2.12,4.997c-0.656,1.497-1.599,3.264-2.596,5.135 c-3.835,7.189-9.087,17.034-7.348,29.229c1.907,13.374,11.753,24.901,27.014,31.626c8.58,3.78,18.427,5.654,29.846,5.654 c4.508,0,9.261-0.292,14.276-0.874c9.183-1.065,103.471-17.67,280.244-49.354c5.821-1.043,9.403-1.686,10.169-1.821 c9.516-1.688,15.861-10.772,14.172-20.289S860.183,875.87,850.662,877.56z"/>
      <path d="M231.14,707.501L82.479,863.005c-16.373,17.127-27.906,38.294-33.419,61.338l211.087-166.001 c66.081,29.303,118.866,38.637,159.32,38.637c71.073,0,104.065-28.826,104.065-28.826c-66.164-34.43-75.592-98.686-75.592-98.686 c50.675,21.424,156.235,46.678,156.235,46.678c140.186-93.563,213.45-296.138,213.45-296.138 c-14.515,3.99-28.395,5.652-41.475,5.652c-65.795,0-111-42.13-111-42.13l183.144-39.885C909.186,218.71,915.01,0,915.01,0 L358.176,495.258C295.116,551.344,250.776,625.424,231.14,707.501z"/>
    </svg>
  `,
  collaborations: `
    <svg class="w-6 h-6" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path d="M223.8,95.9c-0.4-0.2-1.5-0.2-1.9-0.4c-0.4-0.2-1.9-0.2-2.6-0.2c-4.3,0-7.4,1.7-9.1,4.7l-22.8,37.6l-28.7,0.5
          c-4.7,0-8.7,3.8-8.7,8.7c0,1.3,0.3,2.5,0.8,3.6h-46c0.5-1.1,0.8-2.3,0.8-3.6c0-4.9-4-8.7-8.7-8.7H68.2L45.4,100
          c-1.7-3-4.9-4.7-9.1-4.7c-0.6,0-2.1,0-2.6,0.2c-0.4,0.2-1.5,0.2-1.9,0.4c-29.2,6.7-29.3,69-29.1,80.9c0,10.9,3.8,15.7,11.7,18.7
          c1.9,0.9,4.3,1.3,6.2,1.3l50.2,0v43.4c0,6.4,4.9,11.3,11.3,11.3c6.4,0,11.3-4.9,11.3-11.3v-54.3c0-3-1.3-6.2-3.4-8.1
          c-2.3-2.3-5.3-3.6-8.1-3.6H48.4v-25.1L31,119.5c-0.9-1.3-0.4-2.8,0.6-3.4c1.3-0.9,2.8-0.4,3.4,0.6L55.2,151
          c0.1,0.2,0.3,0.4,0.4,0.7v15.7H200v-15.7c0.2-0.2,0.3-0.4,0.4-0.7l20.2-34.3c0.6-1.1,2.1-1.5,3.4-0.6c1.1,0.6,1.5,2.1,0.6,3.4
          l-17.4,29.6v25.1h-33.4c-2.8,0-5.7,1.3-8.1,3.6c-2.1,1.9-3.4,5.1-3.4,8.1v54.3c0,6.4,4.9,11.3,11.3,11.3c6.4,0,11.3-4.9,11.3-11.3
          v-43.4h50.2c1.9,0,4.3-0.4,6.2-1.3c7.9-3,11.7-7.8,11.7-18.7C253.2,165,253.1,102.6,223.8,95.9z"/>
        <ellipse cx="202.1" cy="74.4" rx="20.2" ry="20.2"/>
        <ellipse cx="53.5" cy="74.4" rx="20.2" ry="20.2"/>
        <path d="M114.7,67.8v0.6h11.2h3.9H141v-0.6c0-6.4,2.5-12.6,7-17.3c4.6-4.9,7.5-11.6,7.5-18.9c0-15.4-12.7-27.9-28.2-27.6
          c-15.1,0.4-27.1,13-26.9,28c0.1,7.1,2.9,13.6,7.5,18.4C112.1,55.2,114.7,61.3,114.7,67.8z"/>
        <rect x="114.7" y="72.3" width="26.3" height="5.2"/>
        <path d="M123.9,88.1h7.9c2.9,0,5.3-2.4,5.3-5.3v-1.3h-18.4v1.3C118.6,85.7,121,88.1,123.9,88.1z"/>
      </g>
    </svg>
  `,
};

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
  LANDING_PAGE_ICONS,
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
