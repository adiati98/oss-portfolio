const { dedent } = require('../utils/dedent');
const { GITHUB_USERNAME } = require('../config/config');
const { COLORS } = require('../config/constants');
const { GITHUB_ICON, NAV_ICONS } = require('../config/icons');

const GITHUB_REPO_URL = `https://github.com/${GITHUB_USERNAME}/oss-portfolio`;

function createNavHtml(relativePath = './') {
  const base = relativePath.endsWith('/') ? relativePath : `${relativePath}/`;

  return dedent`
    <nav style="background-color: ${COLORS.nav.bg};" class="fixed top-0 left-0 right-0 z-50 text-white shadow-lg">
      <div class="mx-auto max-w-7xl h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center space-x-4">
          <a href="${base}index.html" 
            class="nav-link nav-desktop-link nav-home-link text-md font-extrabold tracking-wider uppercase py-1">
            <span class="md:hidden">OSS Portfolio</span>
            <span class="hidden md:inline">Open Source Portfolio</span>
          </a>
        </div>
        
        <div class="flex items-center">
          <div class="hidden lg:flex items-center space-x-3">
            <a href="${base}all-contributions.html" style="background-color: ${COLORS.primary[10]};" 
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">All-Time Stats</a>
            <a href="${base}reports.html" style="background-color: ${COLORS.primary[10]};" 
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Quarterly Reports</a>
            <a href="${base}community-activity.html" style="background-color: ${COLORS.primary[10]};" 
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Community & Activity</a>
            <a href="${base}blog.html" style="background-color: ${COLORS.primary[10]};" 
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Articles</a>

            <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" 
              class="nav-link nav-desktop-link nav-github-link flex items-center"
              title="View Repository">
              <span class="w-7 h-7 inline-block">${GITHUB_ICON}</span>
            </a>
          </div>

          <button id="menu-button" style="background-color: ${COLORS.nav.bgHover}; cursor: pointer;" 
            class="lg:hidden w-10 h-10 flex items-center justify-center rounded-md transition duration-150" 
            aria-expanded="false" aria-controls="mobile-menu" aria-label="Toggle navigation menu">
            <span id="menu-open-icon" class="w-6 h-6 block">${NAV_ICONS.menuOpen}</span>
            <span id="menu-close-icon" class="w-6 h-6 hidden">${NAV_ICONS.menuClose}</span>
          </button>
        </div>
      </div>
      
      <div id="mobile-menu" style="background-color: ${COLORS.nav.bgDark};" class="hidden lg:hidden absolute top-16 left-0 right-0 shadow-lg p-4">
        <div class="flex flex-col space-y-2">          
          <a href="${base}all-contributions.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">All-Time Stats</a>
          <a href="${base}reports.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Quarterly Reports</a>
          <a href="${base}community-activity.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Community & Activity</a>
          <a href="${base}blog.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Articles</a>
        </div>
        
        <div class="mt-3 pt-3" style="border-top-color: ${COLORS.nav.bg}; border-top-width: 1px;">
          <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" 
            class="nav-link nav-mobile-github-link block w-fit hover:text-gray-200 transition duration-150 ml-3" 
            title="View Repository">
            <span class="w-6 h-6 inline-block">${GITHUB_ICON}</span>
          </a>
        </div>
      </div>

      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const button = document.getElementById('menu-button');
          const menu = document.getElementById('mobile-menu');
          const openIcon = document.getElementById('menu-open-icon');
          const closeIcon = document.getElementById('menu-close-icon');

          if (button && menu) {
            button.addEventListener('click', () => {
              const isExpanded = button.getAttribute('aria-expanded') === 'true';
              button.setAttribute('aria-expanded', String(!isExpanded));
              menu.classList.toggle('hidden');
              // Ensure we toggle the "hidden" class accurately
              openIcon.classList.toggle('hidden', !isExpanded);
              closeIcon.classList.toggle('hidden', isExpanded);
            });
          }
        });
      </script>
    </nav>
    <style>
      .nav-link { transition: all 0.15s ease-in-out; border: 2px solid transparent; border-radius: 0.375rem; display: inline-flex; align-items: center; }
      .nav-link:hover { border-color: white !important; background-color: ${COLORS.primary[25]} !important; }
      .nav-home-link { padding: 0.5rem; }
      .nav-desktop-link { border-width: 1px; padding: 0.5rem; }
      .nav-github-link { padding: 0.5rem; }
      .nav-mobile-link { padding: 0.5rem 0.75rem; background-color: ${COLORS.nav.bgDark}; width: 100%; }
      #menu-button span svg { width: 1.5rem; height: 1.5rem; }
      .nav-github-link svg, .nav-mobile-github-link svg { width: 100%; height: 100%; }
    </style>
  `;
}

module.exports = { createNavHtml };
