/**
 * Open Source projects you built and maintain, shown on the Journey
 * milestones timeline with a 🛠 Project tag.
 *
 * Fields: title (req), org (req — 'Personal' for your own repos), year (req),
 *         yearEnd (optional: a year, or 'present' for ongoing work),
 *         url (req), description (optional)
 */
module.exports = [
  {
    title: 'OSS Portfolio',
    org: 'Personal',
    year: 2025,
    yearEnd: 'present',
    url: 'https://github.com/adiati98/oss-portfolio',
    highlight: true,
    description:
      'Built a self-hosted portfolio generator that pulls GitHub activity via the API and turns it into a static site — with a PR-triage engine that ranks what needs attention now, a theme system that enforces accessible contrast at build time, and auto-generated contribution reports.',
  },
  {
    title: 'Mautic Docs PRs Tracker',
    org: 'Personal / Mautic',
    year: 2026,
    yearEnd: 'present',
    url: 'https://github.com/adiati98/mautic-docs-prs-tracker',
    highlight: true,
    description:
      'Built a GitHub Actions pipeline that refreshes a live Mautic docs PR dashboard roughly every 30 minutes during work hours, sorting each PR into one of four priority groups by what needs action, with a companion reminder page to prompt code PR authors to review the docs PR against their own changes.',
  },
  {
    title: 'OSS Portfolio Template',
    org: 'Personal',
    year: 2026,
    yearEnd: 'present',
    url: 'https://github.com/adiati98/oss-portfolio-template',
    description:
      'Extracted the OSS Portfolio engine into a template repo — same GitHub API pipeline and dual Markdown/HTML output, reduced to one config value (a GitHub username) so anyone can stand up their own.',
  },
];
