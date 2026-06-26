const { dedent } = require('../utils/dedent');

/**
 * Inline, synchronous script that applies the saved theme (or the OS
 * preference, when no explicit choice was made) before the page paints, to
 * avoid a flash of the wrong theme. Must be placed in <head> ahead of the
 * Tailwind CDN <script> tag.
 */
function getThemeInitScript() {
  return dedent`
    <script>
      (function () {
        try {
          var mq = window.matchMedia('(prefers-color-scheme: dark)');

          function isDark() {
            var stored = localStorage.getItem('theme'); // 'light' | 'dark' | null ('system')
            if (stored === 'dark') return true;
            if (stored === 'light') return false;
            return mq.matches;
          }

          document.documentElement.classList.toggle('dark', isDark());

          // Re-reads localStorage on every change instead of caching it, so a
          // theme choice made via the navbar toggle (after this script ran)
          // is respected rather than overridden by a stale snapshot.
          mq.addEventListener('change', function () {
            document.documentElement.classList.toggle('dark', isDark());
          });
        } catch (e) {}
      })();
    </script>
  `;
}

/**
 * Registers Tailwind v4's class-based dark variant so `.dark` on <html>
 * drives `dark:` utilities instead of the OS `prefers-color-scheme` media
 * query. Must come after the Tailwind CDN <script> tag.
 */
function getThemeStyleVariant() {
  return `<style type="text/tailwindcss">@custom-variant dark (&:where(.dark, .dark *));</style>`;
}

module.exports = { getThemeInitScript, getThemeStyleVariant };
