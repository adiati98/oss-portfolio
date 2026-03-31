/**
 * Sanitizes a string for safe use in HTML attributes (e.g., prevents double quotes from breaking attributes).
 * @param {string} str - The string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitizeAttribute(str) {
  if (str === null || str === undefined) return ''; // Return empty string instead of null/undefined
  if (typeof str !== 'string') return String(str); // Convert numbers/booleans to string

  return str
    .trim() // Remove unnecessary whitespace
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  sanitizeAttribute,
};
