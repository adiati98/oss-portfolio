// footer.js

const { dedent } = require('./dedent');
const { SINCE_YEAR, GITHUB_USERNAME } = require('./config');
const { COLORS } = require('./constants');

/**
 * Generates the common HTML footer for all report pages.
 *
 * @returns {string} The final, fully rendered HTML string for the footer.
 */
function createFooterHtml() {
  // Get dynamic date information for the footer context
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentYear = new Date().getFullYear();

  // New: Use a simpler inline structure
  return dedent`
    <footer style="border-top-color: ${COLORS.border.light}; color: ${COLORS.text.secondary};" class="mt-16 py-8 border-t text-center text-sm">
      <div class="mb-1">
        &copy; ${SINCE_YEAR}-${currentYear} 
        <a href="https://github.com/${GITHUB_USERNAME}" 
           target="_blank" 
           style="color: ${COLORS.primary.rgb};"
           class="hover:opacity-80 font-semibold transition duration-150">
            ${GITHUB_USERNAME}
        </a>'s open source contributions, 
        generated on ${currentDate}.
      </div>

      <div class="text-xs mt-1">
          Made with 💙 by 
          <a href="https://github.com/adiati98" target="_blank" style="color: ${COLORS.primary.rgb};" class="hover:opacity-80 font-semibold transition duration-150">
              Ayu Adiati
          </a>
      </div>
    </footer>
  `;
}

// Export the function so pages can call it
module.exports = {
  createFooterHtml,
};
