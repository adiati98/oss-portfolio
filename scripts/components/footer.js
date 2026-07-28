const { dedent } = require('../utils/dedent');
const { GITHUB_USERNAME, PROFILE } = require('../config/config');
const { COLORS } = require('../config/constants');

/**
 * Generates the common HTML footer for all report pages.
 *
 * @returns {string} The final, fully rendered HTML string for the footer.
 */
function createFooterHtml() {
  // Get dynamic date information for the footer context
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentYear = now.getFullYear();

  return dedent`
    <footer style="border-top-color: ${COLORS.border.light}; color: ${COLORS.text.secondary};" class="mt-16 py-8 border-t text-center text-sm">
      <div class="mb-1">
        &copy; ${currentYear} 
        <a href="https://github.com/${GITHUB_USERNAME}"
           target="_blank" rel="noopener noreferrer"
           style="color: ${COLORS.primaryText};"
           class="hover:opacity-80 font-semibold transition duration-150">
            ${GITHUB_USERNAME}
        </a>'s open source contributions,
        generated on ${currentDate}.
      </div>

      <div class="text-xs mt-1">
          Made with 💙 by
          <a href="https://github.com/adiati98" target="_blank" rel="noopener noreferrer" style="color: ${COLORS.primaryText};" class="hover:opacity-80 font-semibold transition duration-150">
              Ayu Adiati
          </a>
      </div>
      ${
        PROFILE.linkedIn
          ? `<div class="text-sm mt-3">
          <a href="${PROFILE.linkedIn}" target="_blank" rel="noopener noreferrer" style="color: ${COLORS.primaryText};" class="hover:opacity-80 font-semibold underline underline-offset-4 transition duration-150">
              Get in touch on LinkedIn
          </a>
      </div>`
          : ''
      }
    </footer>
  `;
}

// Export the function so pages can call it
module.exports = {
  createFooterHtml,
};
