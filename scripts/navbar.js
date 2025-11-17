const { dedent } = require('./dedent');
const { GITHUB_USERNAME } = require('./config');
const { COLORS } = require('./constants');

const GITHUB_REPO_URL = `https://github.com/${GITHUB_USERNAME}/oss-portfolio`;

// SVG for GitHub icon - now contains only the path data to allow dynamic sizing in navHtml.
const GITHUB_ICON_PATH_DATA = dedent`
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
`;
const GITHUB_ICON_PATH = GITHUB_ICON_PATH_DATA.replace(/\n\s*/g, '');

// Navbar HTML
const navHtml = dedent`
    <nav style="background-color: ${COLORS.nav.bg};" class="fixed top-0 left-0 right-0 z-50 text-white shadow-lg">
        <div class="mx-auto max-w-7xl h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <!-- Left Side: Title -->
            <div class="flex items-center space-x-4">
                <a href="./" 
                   style="border: 2px solid transparent; padding: 0.5rem; border-radius: 0.375rem; transition: all 0.15s ease-in-out; display: inline-block;"
                   onmouseover="this.style.backgroundColor = '${COLORS.primary[10]}'; this.style.borderColor = '${COLORS.primary.rgb}';"
                   onmouseout="this.style.backgroundColor = 'transparent'; this.style.borderColor = 'transparent';"
                   onkeydown="if(event.key==='Enter'){this.click();}"
                   tabindex="0"
                   class="text-md font-extrabold tracking-wider uppercase py-1">
                    <span class="sm:hidden">OSS Portfolio</span>
                    <span class="hidden sm:inline">Open Source Portfolio</span>
                </a>
            </div>
            
            <!-- Right Side Container (Desktop Links & Mobile Toggle) -->
            <div class="flex items-center">
                
                <!-- Desktop Navigation (Quarterly Reports + GitHub Icon) -->
                <div class="hidden sm:flex items-center space-x-4">
                    <!-- Quarterly Reports Link (Desktop) -->
                    <a href="reports.html" style="background-color: ${COLORS.primary[5]}; border: 1px solid ${COLORS.primary.rgb}; color: white; cursor: pointer; transition: all 0.15s ease-in-out;" 
                       class="text-sm font-semibold p-2 rounded-md"
                       onmouseover="this.style.backgroundColor = '${COLORS.primary[10]}'; this.style.color = 'white';"
                       onmouseout="this.style.backgroundColor = '${COLORS.primary[5]}'; this.style.color = 'white';"
                       onkeydown="if(event.key==='Enter'){this.click();}"
                       tabindex="0" role="button">Quarterly Reports
                    </a>

                    <!-- GitHub Icon Link (Desktop) -->
                    <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" 
                        style="border: 2px solid transparent; padding: 0.5rem; border-radius: 0.375rem; transition: all 0.15s ease-in-out; display: flex; align-items: center;"
                        onmouseover="this.style.backgroundColor = '${COLORS.primary[10]}'; this.style.borderColor = '${COLORS.primary.rgb}';"
                        onmouseout="this.style.backgroundColor = 'transparent'; this.style.borderColor = 'transparent';"
                        onkeydown="if(event.key==='Enter'){this.click();}"
                        tabindex="0"
                        title="View Repository">
                        <!-- Desktop Size: w-7 h-7 -->
                        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">${GITHUB_ICON_PATH}</svg>
                    </a>
                </div>

                <!-- Hamburger Button (Mobile Only) -->
                <button id="menu-button" style="background-color: ${COLORS.nav.bgHover};" class="sm:hidden p-2 rounded-md transition duration-150" aria-expanded="false" aria-controls="mobile-menu" aria-label="Toggle navigation menu">
                    <!-- Menu Open Icon (Hamburger) -->
                    <svg id="menu-open-icon" class="w-6 h-6 block" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M3.5,7 C3.22385763,7 3,6.77614237 3,6.5 C3,6.22385763 3.22385763,6 3.5,6 L20.5,6 C20.7761424,6 21,6.22385763 21,6.5 C21,6.77614237 20.7761424,7 20.5,7 L3.5,7 Z M3.5,12 C3.22385763,12 3,11.7761424 3,11.5 C3,11.2238576 3.22385763,11 3.5,11 L20.5,11 C20.7761424,11 21,11.2238576 21,11.5 C21,11.7761424 20.7761424,12 20.5,12 L3.5,12 Z M3.5,17 C3.22385763,17 3,16.7761424 3,16.5 C3,16.2238576 3.22385763,16 3.5,16 L20.5,16 C20.7761424,16 21,16.2238576 21,16.5 C21,16.7761424 20.7761424,17 20.5,17 L3.5,17 Z"/>
                    </svg>
                    <!-- Menu Close Icon (X) -->
                    <svg id="menu-close-icon" class="w-6 h-6 hidden" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M9.207 8.5l6.646 6.646-0.707 0.707-6.646-6.646-6.646 6.646-0.707-0.707 6.646-6.646-6.647-6.646 0.707-0.707 6.647 6.646 6.646-6.646 0.707 0.707-6.646 6.646z" />
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- Mobile Menu Panel (Hidden by default, shown by JS) -->
        <div id="mobile-menu" style="background-color: ${COLORS.nav.bgDark};" class="hidden sm:hidden absolute top-16 left-0 right-0 shadow-lg p-4">
            
            <!-- Quarterly Reports Link -->
            <div class="mb-4">
                <a href="reports.html" style="background-color: ${COLORS.nav.bg};" class="block px-3 py-2 text-base font-medium rounded-md hover:opacity-90" tabindex="0" role="button" onkeydown="if(event.key==='Enter'){this.click();}">Quarterly Reports</a>
            </div>
            
            <!-- GitHub Icon - Mobile (Left Side Bottom) -->
            <div class="mt-3 pt-3" style="border-top-color: ${COLORS.primary[25]}; border-top-width: 1px;">
                <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" 
                    class="block w-fit hover:text-gray-200 transition duration-150 ml-3" 
                    tabindex="0" role="button" onkeydown="if(event.key==='Enter'){this.click();}"
                    title="View Repository">
                    <!-- Mobile Size: w-6 h-6, ml-3 aligns with the start of 'Quarterly Reports' text -->
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">${GITHUB_ICON_PATH}</svg>
                </a>
            </div>
        </div>

        <!-- JavaScript for Mobile Menu Toggle -->
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const button = document.getElementById('menu-button');
                const menu = document.getElementById('mobile-menu');
                const openIcon = document.getElementById('menu-open-icon');
                const closeIcon = document.getElementById('menu-close-icon');

                if (button && menu) {
                    button.addEventListener('click', () => {
                        const isExpanded = button.getAttribute('aria-expanded') === 'true';

                        // Toggle ARIA attributes
                        button.setAttribute('aria-expanded', String(!isExpanded));
                        
                        // Toggle visibility of the menu (Tailwind's 'hidden' class)
                        menu.classList.toggle('hidden');
                        
                        // Toggle icons (Hamburger <-> X)
                        openIcon.classList.toggle('hidden');
                        closeIcon.classList.toggle('hidden');
                    });
                }

                // Add hover effects to nav buttons for dynamic color changes
                const navButtons = document.querySelectorAll('.nav-button');
                navButtons.forEach(btn => {
                  btn.addEventListener('mouseenter', function() {
                    this.style.borderColor = '${COLORS.primary.rgb}';
                  });
                  btn.addEventListener('mouseleave', function() {
                    this.style.borderColor = '${COLORS.border.light}';
                  });
                });
            });
        </script>
    </nav>
`;

module.exports = {
  navHtml,
};
