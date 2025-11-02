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

const GITHUB_REPO_URL = 'https://github.com/adiati98/oss-portfolio';

// SVG for GitHub icon - dedented and forced onto one line to prevent indentation issues.
const GITHUB_ICON_SVG_RAW = dedent`
    <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
    </svg>
`;
const GITHUB_ICON_SVG = GITHUB_ICON_SVG_RAW.replace(/\n\s*/g, '');

// Navbar HTML
const navHtml = dedent`
    <nav class="fixed top-0 left-0 right-0 z-50 bg-[#4338CA] text-white shadow-lg h-16">
        <div class="mx-auto max-w-7xl h-full flex items-center justify-between px-4 sm:px-8">
            <!-- Left Side: Title -->
            <div class="flex items-center space-x-4">
                <a href="./" class="text-md font-extrabold tracking-wider uppercase">
                		Open Source Portfolio
            		</a>
            </div>
            
            <!-- Right Side: GitHub Icon Link -->
            <div>
                <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" 
                   class="p-2 transition duration-150 hover:text-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#4338CA]" 
                   title="View Repository">
                    ${GITHUB_ICON_SVG}
                </a>
            </div>
        </div>
    </nav>
`;

module.exports = {
  navHtml,
};
