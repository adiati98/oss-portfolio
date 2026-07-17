const { dedent } = require('../utils/dedent');
const { GITHUB_USERNAME } = require('../config/config');
const { COLORS } = require('../config/constants');
const { GITHUB_ICON, NAV_ICONS, THEME_ICONS } = require('../config/icons');

const THEME_OPTIONS = [
  { choice: 'light', label: 'Light', icon: THEME_ICONS.sun },
  { choice: 'dark', label: 'Dark', icon: THEME_ICONS.moon },
  { choice: 'system', label: 'System', icon: THEME_ICONS.system },
];

function createThemeDropdownHtml(extraClass = '') {
  const triggerIcons = THEME_OPTIONS.map(
    ({ choice, icon }) =>
      `<span data-theme-icon-for="${choice}" class="theme-dropdown-trigger-icon hidden">${icon}</span>`
  ).join('');

  const menuItems = THEME_OPTIONS.map(
    ({ choice, label, icon }) => dedent`
      <button type="button" role="menuitemradio" data-theme-choice="${choice}" class="theme-dropdown-item" aria-checked="false">
        <span class="theme-dropdown-item-icon">${icon}</span>
        <span>${label}</span>
        <span class="theme-dropdown-check" aria-hidden="true">✓</span>
      </button>
    `
  ).join('');

  return dedent`
    <div class="theme-dropdown relative ${extraClass}" data-theme-dropdown>
      <button type="button" class="theme-dropdown-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Change theme">
        ${triggerIcons}
      </button>
      <div class="theme-dropdown-menu hidden" role="menu">
        ${menuItems}
      </div>
    </div>
  `;
}

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
          <div class="hidden min-[1025px]:flex items-center space-x-3">
            <a href="${base}journey.html" style="background-color: ${COLORS.primary[10]};"
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Journey</a>
            <a href="${base}workbench.html" style="background-color: ${COLORS.primary[10]};"
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Workbench</a>
            <a href="${base}writing.html" style="background-color: ${COLORS.primary[10]};"
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Writing</a>
            <a href="${base}reports.html" style="background-color: ${COLORS.primary[10]};"
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Reports</a>
            <a href="${base}glossary.html" style="background-color: ${COLORS.primary[10]};"
              class="nav-link nav-desktop-link text-sm font-semibold p-2 rounded-md">Glossary</a>

            <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer"
              class="nav-link nav-desktop-link nav-github-link flex items-center"
              title="View Repository">
              <span class="w-7 h-7 inline-block">${GITHUB_ICON}</span>
            </a>

            ${createThemeDropdownHtml()}
          </div>

          <button id="menu-button" style="background-color: ${COLORS.nav.bgHover}; cursor: pointer;" 
            class="min-[1025px]:hidden w-10 h-10 flex items-center justify-center rounded-md transition duration-150" 
            aria-expanded="false" aria-controls="mobile-menu" aria-label="Toggle navigation menu">
            <span id="menu-open-icon" class="w-6 h-6 block">${NAV_ICONS.menuOpen}</span>
            <span id="menu-close-icon" class="w-6 h-6 hidden">${NAV_ICONS.menuClose}</span>
          </button>
        </div>
      </div>
      
      <div id="mobile-menu" style="background-color: ${COLORS.nav.bgDark};" class="hidden min-[1025px]:hidden absolute top-16 left-0 right-0 shadow-lg p-4">
        <div class="flex flex-col space-y-2">
          <a href="${base}journey.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Journey</a>
          <a href="${base}workbench.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Workbench</a>
          <a href="${base}writing.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Writing</a>
          <a href="${base}reports.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Quarterly Reports</a>
          <a href="${base}glossary.html" class="nav-link nav-mobile-link block px-3 py-2 text-base font-medium rounded-md">Glossary</a>
        </div>
        
        <div class="mt-3 pt-3 flex items-center justify-between" style="border-top-color: ${COLORS.nav.bg}; border-top-width: 1px;">
          <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer"
            class="nav-link nav-mobile-github-link block w-fit hover:text-gray-200 transition duration-150 ml-3"
            title="View Repository">
            <span class="w-6 h-6 inline-block">${GITHUB_ICON}</span>
          </a>

          ${createThemeDropdownHtml('mr-3')}
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
              openIcon.classList.toggle('hidden', !isExpanded);
              closeIcon.classList.toggle('hidden', isExpanded);
            });
          }

          const dropdowns = document.querySelectorAll('[data-theme-dropdown]');

          function closeAllDropdowns() {
            dropdowns.forEach((dropdown) => {
              dropdown.querySelector('.theme-dropdown-menu').classList.add('hidden');
              dropdown.querySelector('.theme-dropdown-trigger').setAttribute('aria-expanded', 'false');
            });
          }

          function setTheme(choice) {
            if (choice === 'system') {
              localStorage.removeItem('theme');
            } else {
              localStorage.setItem('theme', choice);
            }
            const isDark =
              choice === 'dark' ||
              (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.toggle('dark', isDark);
            reflectActiveChoice();
          }

          function reflectActiveChoice() {
            const current = localStorage.getItem('theme') || 'system';
            dropdowns.forEach((dropdown) => {
              dropdown.querySelectorAll('[data-theme-icon-for]').forEach((icon) => {
                icon.classList.toggle('hidden', icon.dataset.themeIconFor !== current);
              });
              dropdown.querySelectorAll('[data-theme-choice]').forEach((item) => {
                item.setAttribute('aria-checked', String(item.dataset.themeChoice === current));
              });
            });
          }

          dropdowns.forEach((dropdown) => {
            const trigger = dropdown.querySelector('.theme-dropdown-trigger');
            const menu = dropdown.querySelector('.theme-dropdown-menu');

            trigger.addEventListener('click', (e) => {
              e.stopPropagation();
              const isOpen = !menu.classList.contains('hidden');
              closeAllDropdowns();
              if (!isOpen) {
                menu.classList.remove('hidden');
                trigger.setAttribute('aria-expanded', 'true');
              }
            });

            dropdown.querySelectorAll('[data-theme-choice]').forEach((item) => {
              item.addEventListener('click', () => {
                setTheme(item.dataset.themeChoice);
                closeAllDropdowns();
              });
            });
          });

          document.addEventListener('click', closeAllDropdowns);
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllDropdowns();
          });

          reflectActiveChoice();
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
      
      #menu-button span svg { width: 1.5rem; height: 1.5rem; display: block; }
      .nav-github-link svg, .nav-mobile-github-link svg { width: 100%; height: 100%; }

      .theme-dropdown-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.375rem;
        color: rgba(255, 255, 255, 0.85);
        cursor: pointer;
        border: none;
        background-color: ${COLORS.nav.bgHover};
        transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
      }
      .theme-dropdown-trigger:hover,
      .theme-dropdown-trigger[aria-expanded='true'] { color: white; }
      .theme-dropdown-trigger-icon svg { width: 1.15rem; height: 1.15rem; display: block; }

      .theme-dropdown-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 0.5rem);
        min-width: 9.5rem;
        background-color: var(--c-bg-surface);
        border: 1px solid ${COLORS.border.light};
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
        padding: 0.25rem;
        z-index: 60;
      }
      .theme-dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.5rem 0.625rem;
        border-radius: 0.375rem;
        border: none;
        background: transparent;
        color: ${COLORS.text.secondary};
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s ease-in-out;
      }
      .theme-dropdown-item:hover,
      .theme-dropdown-item:focus-visible { background-color: ${COLORS.primary[10]}; outline: none; }
      .theme-dropdown-item-icon { display: inline-flex; }
      .theme-dropdown-item-icon svg { width: 1rem; height: 1rem; display: block; }
      .theme-dropdown-check { margin-left: auto; opacity: 0; color: ${COLORS.primaryText}; font-weight: 700; }
      .theme-dropdown-item[aria-checked='true'] .theme-dropdown-check { opacity: 1; }
    </style>
  `;
}

module.exports = { createNavHtml };
