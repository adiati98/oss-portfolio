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

module.exports = {
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
  FAVICON_SVG_ENCODED,
};
