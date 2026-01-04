/**
 * Generates the favicon SVG with the specified color.
 * @param {string} rawTemplate The raw SVG string with {{COLOR}} placeholder
 * @param {string} colorHex The hex color to use for the favicon
 * @returns {string} The SVG string with the color applied
 */
function generateFaviconSvg(rawTemplate, colorHex) {
  return rawTemplate.replace(/{{COLOR}}/g, colorHex);
}

/**
 * Function to safely encode the SVG for use in a data URI
 * @param {string} svgString The raw SVG string
 * @returns {string} The URL-encoded string
 */
function encodeSvg(svgString) {
  // 1. URL-encode reserved characters (%, #, etc.)
  let encoded = encodeURIComponent(svgString);

  // 2. Fix characters that should NOT be encoded for data URIs
  encoded = encoded.replace(/'/g, '%27').replace(/"/g, '%22');

  // 3. Fix characters that should be encoded for HTML attributes
  encoded = encoded
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/&/g, '%26')
    .replace(/#/g, '%23');

  return encoded;
}

module.exports = {
  generateFaviconSvg,
  encodeSvg,
};
