/**
 * THEME ENGINE — expands the five seeds in theme.js into the full token set
 * both themes run on, and gates every derived pairing through WCAG checks.
 *
 * Derivation strategy (all in build-time JS so the output is plain hex —
 * no runtime color-mix() dependency, and every value is testable):
 *
 *   surfaces   light: user override or a 2% brand-biased off-white.
 *              dark:  same hue family, lightness 8/12/14 (page/card/card-2).
 *   inks       light: user override or brand-biased near-black, plus two
 *              muted steps. dark: derived from the dark card via
 *              ensureReadableOn so any hue stays readable.
 *   per seed   text  — the seed itself (light) / ensureReadableOn(seed,
 *                      darkCard, 4.5) (dark)
 *              wash  — seed mixed into the card at low opacity; the mix
 *                      ratio is *searched* until the seed text clears 3:1
 *                      on top of it (pills = large/bold text, AA large)
 *              line  — a stronger mix for borders/hairlines
 *   accent     defaults to brand hue-rotated -55° (an analogous warm)
 *   on-brand   text color for solid brand fills: white if it clears 4.5,
 *              else the dark ink; checked per theme.
 *
 * The WCAG gate runs at require time. A failing seed throws with the seed
 * name and a concrete suggestion, so `npm run build` fails loudly instead
 * of shipping unreadable pills.
 */
const {
  hexToHsl,
  hslToHex,
  hexToRgb,
  getContrastRatio,
  ensureReadableOn,
} = require('../utils/color-helpers');
const SEEDS = require('./theme');

const REQUIRED_SEEDS = ['brand', 'positive', 'caution', 'critical', 'neutral'];
const OPTIONAL_SEEDS = ['accent', 'surface', 'ink'];

// ---------------------------------------------------------------------------
// Small color math (hex in, hex out)
// ---------------------------------------------------------------------------

/** Linear-RGB-ish mix of two hex colors; t = share of `a` (0..1). */
function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const ch = (x, y) =>
    Math.round(x * t + y * (1 - t))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(ca.r, cb.r)}${ch(ca.g, cb.g)}${ch(ca.b, cb.b)}`.toUpperCase();
}

/** Darkens `hex` in HSL space until it clears `minRatio` against `bgHex`. */
function ensureReadableDarkOn(hex, bgHex, minRatio = 4.5) {
  const { h, s, l } = hexToHsl(hex);
  let lightness = l;
  let candidate = hex;
  let iterations = 0;
  while (getContrastRatio(candidate, bgHex) < minRatio && lightness > 4 && iterations < 25) {
    lightness -= 4;
    candidate = hslToHex(h, s, lightness);
    iterations++;
  }
  return candidate;
}

/**
 * Finds the strongest wash (highest seed share) that still leaves `textHex`
 * readable on top of it at `minRatio`. Starts rich and backs off toward the
 * plain card, so failure is impossible as long as text-on-card passes.
 */
function deriveWash(seedHex, cardHex, textHex, start = 0.14, minRatio = 3.0) {
  let t = start;
  let wash = mixHex(seedHex, cardHex, t);
  while (getContrastRatio(textHex, wash) < minRatio && t > 0.02) {
    t -= 0.02;
    wash = mixHex(seedHex, cardHex, t);
  }
  return wash;
}

// ---------------------------------------------------------------------------
// Validation of the seed file itself
// ---------------------------------------------------------------------------

function validateSeeds(seeds) {
  for (const name of REQUIRED_SEEDS) {
    if (!seeds[name]) {
      throw new Error(
        `[theme] Missing required seed "${name}" in scripts/config/theme.js. ` +
          `Required seeds: ${REQUIRED_SEEDS.join(', ')}.`
      );
    }
  }
  for (const [name, value] of Object.entries(seeds)) {
    if (![...REQUIRED_SEEDS, ...OPTIONAL_SEEDS].includes(name)) {
      throw new Error(
        `[theme] Unknown seed "${name}" in theme.js. ` +
          `Allowed: ${[...REQUIRED_SEEDS, ...OPTIONAL_SEEDS].join(', ')}.`
      );
    }
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value))) {
      throw new Error(`[theme] Seed "${name}" is not a valid hex color: ${value}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

function deriveTheme(seeds = SEEDS) {
  validateSeeds(seeds);

  const brandHsl = hexToHsl(seeds.brand);
  const neutralHsl = hexToHsl(seeds.neutral);

  // Accent: hue-rotated brand unless overridden.
  const accent =
    seeds.accent || hslToHex(brandHsl.h - 55, Math.min(brandHsl.s, 55), Math.min(brandHsl.l, 45));

  // --- Light theme grounds ---
  const surface = seeds.surface || hslToHex(brandHsl.h, 22, 97);
  const card = '#FFFFFF';
  const card2 = mixHex(surface, card, 0.35);
  const ink = seeds.ink || hslToHex(brandHsl.h, 20, 13);
  const ink2 = mixHex(ink, seeds.neutral, 0.45);
  const ink3 = mixHex(seeds.neutral, card, 0.82);
  const line = mixHex(seeds.neutral, card, 0.18);
  const line2 = mixHex(seeds.neutral, card, 0.3);

  // --- Dark theme grounds (same hue family, deep lightness steps) ---
  const dSurface = hslToHex(brandHsl.h, Math.min(brandHsl.s, 28), 9);
  const dCard = hslToHex(brandHsl.h, Math.min(brandHsl.s, 26), 13);
  const dCard2 = hslToHex(brandHsl.h, Math.min(brandHsl.s, 24), 16);
  const dInk = ensureReadableOn(hslToHex(brandHsl.h, 25, 88), dCard, 7);
  const dInk2 = ensureReadableOn(hslToHex(neutralHsl.h, neutralHsl.s, 68), dCard, 4.5);
  const dInk3 = mixHex(dInk2, dCard, 0.7);
  const dLine = mixHex(seeds.neutral, dSurface, 0.28);
  const dLine2 = mixHex(seeds.neutral, dSurface, 0.42);

  // --- Per-seed ladders ---
  const semantic = {};
  const familyOf = { brand: seeds.brand, accent, ...pickSeeds(seeds) };
  for (const [name, hex] of Object.entries(familyOf)) {
    // Text steps are derived readable in BOTH directions: darkened until AA
    // on the light card, lightened until AA on the dark card. The seed itself
    // stays untouched for fills; only its text step shifts.
    const text = ensureReadableDarkOn(hex, card, 4.5);
    const textDark = ensureReadableOn(hex, dCard, 4.5);
    semantic[name] = {
      light: {
        text,
        wash: deriveWash(hex, card, text),
        line: mixHex(hex, card, 0.32),
        strong: hslToHex(hexToHsl(hex).h, hexToHsl(hex).s, Math.max(hexToHsl(hex).l - 12, 8)),
      },
      dark: {
        text: textDark,
        wash: deriveWash(textDark, dCard, textDark, 0.2),
        line: mixHex(textDark, dSurface, 0.38),
        strong: textDark,
      },
    };
  }

  // --- on-brand: text sitting on a solid brand fill ---
  const onBrandLight = getContrastRatio('#FFFFFF', seeds.brand) >= 4.5 ? '#FFFFFF' : ink;
  const dBrandFill = semantic.brand.dark.text;
  const onBrandDark =
    getContrastRatio(dSurface, dBrandFill) >= 4.5
      ? dSurface
      : ensureReadableDarkOn(dBrandFill, dBrandFill, 4.5);

  const theme = {
    seeds: { ...seeds, accent },
    light: {
      surface,
      card,
      card2,
      ink,
      ink2,
      ink3,
      line,
      line2,
      onBrand: onBrandLight,
    },
    dark: {
      surface: dSurface,
      card: dCard,
      card2: dCard2,
      ink: dInk,
      ink2: dInk2,
      ink3: dInk3,
      line: dLine,
      line2: dLine2,
      onBrand: onBrandDark,
    },
    semantic,
  };

  runWcagGate(theme);
  return theme;
}

function pickSeeds(seeds) {
  return {
    positive: seeds.positive,
    caution: seeds.caution,
    critical: seeds.critical,
    neutral: seeds.neutral,
  };
}

// ---------------------------------------------------------------------------
// WCAG gate
// ---------------------------------------------------------------------------

function runWcagGate(theme) {
  const failures = [];
  const check = (label, fg, bg, min) => {
    const ratio = getContrastRatio(fg, bg);
    if (ratio < min) {
      failures.push(
        `  ${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (needs ${min}:1)`
      );
    }
  };

  for (const mode of ['light', 'dark']) {
    const g = theme[mode];
    check(`${mode} ink/card`, g.ink, g.card, 4.5);
    check(`${mode} ink2/card`, g.ink2, g.card, 4.5);
    for (const [name, ladder] of Object.entries(theme.semantic)) {
      const l = ladder[mode];
      check(`${mode} ${name} text/card`, l.text, g.card, 4.5);
      check(`${mode} ${name} text/wash (pill)`, l.text, l.wash, 3.0);
    }
    const brandFill = mode === 'light' ? theme.seeds.brand : theme.semantic.brand[mode].text;
    check(`${mode} on-brand/brand fill`, g.onBrand, brandFill, 4.5);
  }

  if (failures.length > 0) {
    throw new Error(
      `[theme] WCAG gate failed — the configured seeds cannot produce readable derivatives:\n` +
        `${failures.join('\n')}\n` +
        `Fix: darken (light theme) or let the engine lighten (dark theme) the named seed in ` +
        `scripts/config/theme.js. Mid-lightness, moderately saturated seeds derive best.`
    );
  }
}

// ---------------------------------------------------------------------------
// CSS variable emission
// ---------------------------------------------------------------------------

/**
 * Emits the `:root { ... } html.dark { ... }` block for the new token names.
 * Naming: --t-surface / --t-card / --t-ink … and per seed
 * --t-<name> / --t-<name>-wash / --t-<name>-line / --t-<name>-strong.
 */
function buildThemeCssVars(theme) {
  const lines = { light: [], dark: [] };
  for (const mode of ['light', 'dark']) {
    const g = theme[mode];
    lines[mode].push(
      `--t-surface: ${g.surface};`,
      `--t-card: ${g.card};`,
      `--t-card-2: ${g.card2};`,
      `--t-ink: ${g.ink};`,
      `--t-ink-2: ${g.ink2};`,
      `--t-ink-3: ${g.ink3};`,
      `--t-line: ${g.line};`,
      `--t-line-2: ${g.line2};`,
      `--t-on-brand: ${g.onBrand};`
    );
    for (const [name, ladder] of Object.entries(theme.semantic)) {
      const l = ladder[mode];
      lines[mode].push(
        `--t-${name}: ${l.text};`,
        `--t-${name}-wash: ${l.wash};`,
        `--t-${name}-line: ${l.line};`,
        `--t-${name}-strong: ${l.strong};`
      );
    }
    const shadow =
      mode === 'light'
        ? `0 1px 2px rgba(20,20,30,.05), 0 4px 16px rgba(20,20,30,.05)`
        : `0 1px 2px rgba(0,0,0,.35), 0 4px 18px rgba(0,0,0,.3)`;
    const shadowLg =
      mode === 'light'
        ? `0 2px 4px rgba(20,20,30,.04), 0 22px 60px -24px ${hexToRgba(theme.seeds.brand, 0.22)}`
        : `0 2px 4px rgba(0,0,0,.4), 0 22px 60px -22px rgba(0,0,0,.6)`;
    lines[mode].push(`--t-shadow: ${shadow};`, `--t-shadow-lg: ${shadowLg};`);
  }

  return [
    ':root {',
    ...lines.light.map((l) => `  ${l}`),
    '}',
    'html.dark {',
    ...lines.dark.map((l) => `  ${l}`),
    '}',
  ].join('\n');
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const THEME = deriveTheme();
const THEME_TOKENS_CSS = buildThemeCssVars(THEME);

module.exports = {
  THEME,
  THEME_TOKENS_CSS,
  deriveTheme,
  buildThemeCssVars,
  mixHex,
};
