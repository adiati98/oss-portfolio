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

// Define the raw SVG for the favicon
const FAVICON_SVG_RAW = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
  <path fill='#4338CA' fill-rule='evenodd' d='M5.75 21a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 19.25a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM5.75 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM2.5 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0zM18.25 6.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM15 4.75a3.25 3.25 0 106.5 0 3.25 3.25 0 00-6.5 0z'/>
  <path fill='#4338CA' fill-rule='evenodd' d='M5.75 16.75A.75.75 0 006.5 16V8A.75.75 0 005 8v8c0 .414.336.75.75.75z'/>
  <path fill='#4338CA' fill-rule='evenodd' d='M17.5 8.75v-1H19v1a3.75 3.75 0 01-3.75 3.75h-7a1.75 1.75 0 00-1.75 1.75H5A3.25 3.25 0 018.25 11h7a2.25 2.25 0 002.25-2.25z'/>
</svg>
`
  .replace(/\s+/g, ' ') // Remove extra whitespace/newlines for cleaner encoding
  .trim();

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

const FAVICON_SVG_ENCODED = encodeSvg(FAVICON_SVG_RAW);

/**
 * CENTRALIZED COLOR CONFIGURATION
 * ================================
 *
 * This object defines all colors used throughout the generated HTML reports.
 * To customize colors, update the values below using Tailwind CSS color names.
 *
 * Color Properties:
 * - Primary: Used for headers, accents, and main buttons (default: indigo)
 * - Gray: Used for neutral elements (backgrounds, borders, text)
 * - Status: Used for PR/Issue status badges
 * - Link: Used for hyperlinks
 * - Background: Page and section backgrounds
 * - Border: Border colors for various elements
 * - SectionAccent: Left borders for section headings
 *
 * IMPORTANT NOTES:
 * 1. Hover effects use pure CSS (not Tailwind) to avoid specificity issues
 * 2. Colors are hardcoded in template literals - changes here affect new generations
 * 3. For custom color schemes, modify the Tailwind class names below
 * 4. Always test hover effects after changing colors
 */
const COLORS = {
  // Primary accent color (used for main UI elements)
  primary: {
    50: 'indigo-50',
    100: 'indigo-100',
    500: 'indigo-500',
    600: 'indigo-600',
    700: 'indigo-700',
  },
  // Neutral grays
  gray: {
    50: 'gray-50',
    100: 'gray-100',
    200: 'gray-200',
    500: 'gray-500',
    600: 'gray-600',
    700: 'gray-700',
    800: 'gray-800',
  },
  // Status badge colors (for PR/Issue states)
  status: {
    green: {
      bg: 'green-100',
      text: 'green-700',
    },
    purple: {
      bg: 'purple-100',
      text: 'purple-700',
    },
    red: {
      bg: 'red-100',
      text: 'red-700',
    },
    gray: {
      bg: 'gray-100',
      text: 'gray-700',
    },
  },
  // Link colors
  link: {
    text: 'blue-600',
    textHover: 'blue-800',
  },
  // Background colors
  background: {
    white: 'white',
    altRows: 'gray-50',
  },
  // Border colors
  border: {
    default: 'border-gray-200',
    section: 'border-gray-200',
    bottomAccent: 'border-indigo-100',
  },
  // Accent borders for section headings
  sectionAccent: {
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    indigo: 'border-indigo-500',
  },
};

/**
 * Generates CSS with custom properties for hover effects.
 * This approach ensures hover effects work correctly without relying on Tailwind's
 * hover: prefixed classes in template literals, which can have specificity issues.
 *
 * Returns: <style> tag with CSS rules for safe hover effects
 */
function getHoverStyles() {
  return `
    <style>
      /* CSS Custom Properties for easy customization */
      :root {
        --primary-50: rgb(238, 242, 255);
        --primary-600: rgb(79, 70, 229);
        --gray-50: rgb(249, 250, 251);
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
  FAVICON_SVG_ENCODED,
  COLORS,
  getHoverStyles,
};
