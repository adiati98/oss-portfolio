/**
 * Escapes a string for safe interpolation into HTML text content or a
 * quoted HTML attribute (including href/src URLs — this only neutralizes
 * the characters that break markup, it never percent-encodes the URL, so
 * the link keeps working). Third-party-controlled strings (PR titles,
 * labels, article titles, feed error text, repo names) must go through
 * this before they land in a template literal.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') return String(str);

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { escapeHtml };
