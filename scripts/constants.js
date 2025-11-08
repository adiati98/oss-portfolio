// constants.js

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

module.exports = {
  LEFT_ARROW_SVG,
  RIGHT_ARROW_SVG,
};
