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
      "Rewrote Mautic's contributing guidelines and consolidated three separate per-repo CONTRIBUTING files into one shared source on the Community Handbook.",
  },
  {
    title: 'Mautic Community Handbook reStructuredText conversion',
    org: 'Mautic',
    year: 2025,
    url: 'https://contribute.mautic.org/',
    highlight: true,
    description:
      "Converted the Community Handbook's content into reStructuredText across roughly 20 sections — one merged PR per role and policy area, from Designer and Translator guides through Governance and Financial Policy.",
  },
  {
    title: 'Mautic Tester documentation overhaul',
    org: 'Mautic',
    year: 2026,
    url: 'https://contribute.mautic.org/en/latest/contributing/tester.html',
    description:
      'Rewrote the Tester guide twice: first replacing sunset Gitpod instructions with GitHub Codespaces setup written from scratch, then restructuring the page to lead with local (DDEV) setup over Codespaces.',
  },
  {
    title: 'Virtual Coffee Handbook',
    org: 'Virtual Coffee',
    year: 2021,
    yearEnd: 2025,
    url: 'https://virtualcoffee.io/resources/virtual-coffee-handbook',
    highlight: true,
    description:
      "Created and still maintain Virtual Coffee's handbook — onboarding, Slack navigation, glossary — including a 2023 reorg of every community resource on the site.",
  },
  {
    title: 'Virtual Coffee Monthly Challenges documentation',
    org: 'Virtual Coffee',
    year: 2024,
    yearEnd: 2025,
    url: 'https://vc-community-docs.netlify.app/docs/monthly-challenges/',
    description:
      'Wrote a facilitator handbook plus individual guides for 15+ Monthly Challenges, replacing ad hoc volunteer knowledge with a documented process.',
  },
  {
    title: 'Virtual Coffee docs migration to Docusaurus',
    org: 'Virtual Coffee',
    year: 2025,
    url: 'https://vc-community-docs.netlify.app/docs/',
    highlight: true,
    description:
      "Migrated Virtual Coffee's documentation to Docusaurus solo — full information architecture and content rebuilt from scratch, not a lift-and-shift.",
  },
];
