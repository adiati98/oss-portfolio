/**
 * THEME SEEDS — the only file a fork edits to re-brand the entire portfolio.
 *
 * Five required seed colors. Every tint, wash, hairline, dark-mode variant,
 * and status color across the site is DERIVED from these at build time
 * (see theme-engine.js), and every derived text/surface pairing is checked
 * against WCAG AA. If a seed can't produce readable derivatives, the build
 * fails and names the offending seed — a fork cannot ship an unreadable theme.
 *
 *   brand    — identity: nav, links, timeline spine, focus rings, meters
 *   positive — merged, approved, active roles, "your court is clear"
 *   caution  — take action, aging reviews, rate-limit banners
 *   critical — blocked, failed fetches, destructive states
 *   neutral  — seeds the gray family: muted text, hairlines, stale items
 *
 * Optional overrides (omit them and they are derived from the five seeds):
 *   accent   — playful highlight (persona seal, org names); defaults to a
 *              hue-rotated brand
 *   surface  — light-theme page background; defaults to a 2% brand-biased
 *              off-white
 *   ink      — light-theme text color; defaults to a brand-biased near-black
 */
module.exports = {
  brand: '#4338CA',
  positive: '#0F8A63',
  caution: '#A16207',
  critical: '#B3323F',
  neutral: '#5D6172',

  // accent: '#A23E68',
  // surface: '#F6F6F9',
  // ink: '#1B1D28',
};
