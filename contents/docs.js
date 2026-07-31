/**
 * Documentation programs and overhauls — bodies of writing work too large to
 * read as single pull requests. Shown on the Journey milestones timeline with
 * a 📚 Docs tag.
 *
 * `url` points at the published result where one exists (that's what a reader
 * wants to see), and at the pull request only when there's no live page.
 *
 * Fields: title (req), org (req), year (req),
 *         yearEnd (optional: a year, or 'present' for ongoing work),
 *         url (req), description (optional),
 *         highlight (optional: shows before the "show more" control)
 */
module.exports = [
  {
    title: 'Mautic contributing guidelines: overhaul and migration',
    org: 'Mautic',
    year: 2025,
    yearEnd: 2026,
    url: 'https://contribute.mautic.org/en/latest/contributing/contributing_docs.html',
    highlight: true,
    description:
      "Rewrote Mautic's contributing guidelines, then moved them onto the Community Handbook site so all three documentation projects point at one set of instructions instead of keeping their own.",
  },
  {
    title: 'Mautic Community Handbook reStructuredText conversion',
    org: 'Mautic',
    year: 2025,
    url: 'https://contribute.mautic.org/',
    highlight: true,
    description:
      'Rebuilt the whole Community Handbook in reStructuredText, the format Mautic publishes its documentation from — every section, from contributing and testing through to policies and the style guide.',
  },
  {
    title: 'Mautic Tester documentation overhaul',
    org: 'Mautic',
    year: 2026,
    url: 'https://contribute.mautic.org/en/latest/contributing/tester.html',
    description:
      'Reworked the Tester guide so it starts with setting Mautic up on your own machine rather than in the cloud, rewriting about half the page.',
  },
  {
    title: 'Virtual Coffee Handbook',
    org: 'Virtual Coffee',
    year: 2021,
    yearEnd: 2025,
    url: 'https://virtualcoffee.io/resources/virtual-coffee-handbook',
    highlight: true,
    description:
      "Created and looked after Virtual Coffee's handbook — from how to join through to finding your way around Slack — including a 2023 reorganization of every community resource on the site.",
  },
  {
    title: 'Virtual Coffee Monthly Challenges documentation',
    org: 'Virtual Coffee',
    year: 2024,
    yearEnd: 2025,
    url: 'https://vc-community-docs.netlify.app/docs/monthly-challenges/',
    description:
      'Wrote the facilitator handbook and a guide for every Monthly Challenge, so the volunteers running them had something to follow instead of working it out each time.',
  },
  {
    title: 'Virtual Coffee docs migration to Docusaurus',
    org: 'Virtual Coffee',
    year: 2025,
    url: 'https://vc-community-docs.netlify.app/docs/',
    highlight: true,
    description:
      "Moved Virtual Coffee's documentation onto Docusaurus on my own — 192 files rebuilt and delivered as a single piece of work.",
  },
];
