/**
 * Utility function to dedent a multiline string.
 * This removes leading whitespace equivalent to the shortest common indentation
 * of the content lines, ensuring clean HTML insertion.
 * @param {string[]} callSite The template literal string array
 * @param {any[]} substitutions The template literal substitution values
 * @returns {string} The dedented string.
 */
function dedent(callSite, ...substitutions) {
  // 1. Convert the first argument (string array) into a single string.
  let text = callSite.map((s, i) => s + (substitutions[i] || '')).join('');

  // 2. Split the string into lines, excluding lines that are just whitespace.
  const lines = text.split('\n');

  // 3. Find the minimum common indentation.
  let minIndentation = Infinity;
  for (const line of lines) {
    if (line.trim().length > 0) {
      const leadingSpaces = line.match(/^(\s*)/)[0].length;
      if (leadingSpaces < minIndentation) {
        minIndentation = leadingSpaces;
      }
    }
  }

  // 4. Remove the common indentation from each line.
  const dedentedText = lines
    .map((line) => (line.length >= minIndentation ? line.substring(minIndentation) : line))
    .join('\n');

  // 5. Trim leading/trailing whitespace (including empty lines) from the whole string.
  return dedentedText.trim();
}

module.exports = {
  dedent,
};
