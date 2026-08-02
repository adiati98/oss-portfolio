/**
 * External recognition for individual pieces of writing — top-of-the-week
 * picks, challenge wins, editor's choice, etc. Shown at the top of the
 * Writing page, above the article lists.
 *
 * Fields: title (req — the recognized piece's title, or the recognition
 *         itself), org (req — the platform/publication that recognized it),
 *         month (req — 1–12), year (req), url (req — link to the piece or
 *         the recognition), description (optional — may include a raw <a>
 *         link to the specific article that was selected), highlight
 *         (optional: renders with a ★ marker for a standout entry)
 */
module.exports = [
  {
    title: 'Top 7 Featured DEV Posts of the Week',
    org: 'DEV Community',
    month: 11,
    year: 2021,
    url: 'https://dev.to/devteam/top-7-featured-dev-posts-from-the-past-week-35fb',
    description:
      'Featured for <a href="https://dev.to/adiatiayu/contributing-to-open-source-101-2dnm" target="_blank" rel="noopener noreferrer">"Contributing to Open Source 101"</a>.',
  },
  {
    title: 'OSS Grant Badge Winners',
    org: 'Hashnode',
    month: 11,
    year: 2021,
    url: 'https://townhall.hashnode.com/oss-grant-badge-winners',
    description:
      "Placed 2nd for the OSS Documentarian badge and was recognized among the OSS Mentor badge winners, as part of Hashnode's Open Source October.",
  },
  {
    title: 'Top 7 Featured DEV Posts of the Week',
    org: 'DEV Community',
    month: 9,
    year: 2022,
    url: 'https://dev.to/devteam/top-7-featured-dev-posts-from-the-past-week-4phi',
    description:
      'Featured for <a href="https://dev.to/adiatiayu/mini-portfolio-bring-your-github-profile-to-the-next-level-5c8n" target="_blank" rel="noopener noreferrer">"Mini Portfolio: Bring Your GitHub Profile to the Next Level"</a>.',
  },
  {
    title: 'Top Featured CodeNewbie Posts',
    org: 'CodeNewbie',
    month: 8,
    year: 2023,
    url: 'https://dev.to/codenewbieteam/top-featured-codenewbie-posts-81723-48i4',
    description:
      'Featured for <a href="https://dev.to/adiatiayu/how-to-communicate-better-in-open-source-3hdj" target="_blank" rel="noopener noreferrer">"How to Communicate Better in Open Source"</a>.',
  },
  {
    title: "Quincy Larson's Weekly Email — Sep 22, 2023",
    org: 'freeCodeCamp',
    month: 9,
    year: 2023,
    url: 'https://github.com/freeCodeCamp/awesome-quincy-larson-emails#sep-22-2023',
    description:
      'Recommended in the newsletter for <a href="https://www.freecodecamp.org/news/how-to-contribute-to-open-source/" target="_blank" rel="noopener noreferrer">"How to Contribute to Open Source Projects – Non-Technical Things You Should Know"</a>.',
  },
  {
    title: 'Top Open Source Contributors 2023',
    org: 'freeCodeCamp',
    month: 11,
    year: 2023,
    url: 'https://www.freecodecamp.org/news/top-open-source-contributors-2023/',
    description: "Listed among freeCodeCamp's top publication contributors of the year.",
  },
  {
    title: 'Top 7 Featured DEV Posts of the Week',
    org: 'DEV Community',
    month: 4,
    year: 2026,
    url: 'https://dev.to/devteam/top-7-featured-dev-posts-of-the-week-4idc',
    description:
      'Featured for <a href="https://dev.to/adiatiayu/the-curated-automated-open-source-portfolio-how-its-going-5f98" target="_blank" rel="noopener noreferrer">"The Curated, Automated Open Source Portfolio: How It\'s Going"</a>.',
  },
  {
    title: 'Top 7 Featured DEV Posts of the Week',
    org: 'DEV Community',
    month: 10,
    year: 2025,
    url: 'https://dev.to/devteam/top-7-featured-dev-posts-of-the-week-53an',
    description:
      'Featured for <a href="https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0" target="_blank" rel="noopener noreferrer">"How I Built a Curated, Automated Open Source Portfolio"</a>.',
  },
  {
    title: '2025 Hacktoberfest Writing Challenge Winners',
    org: 'DEV Community',
    month: 11,
    year: 2025,
    url: 'https://dev.to/devteam/congrats-to-the-2025-hacktoberfest-writing-challenge-winners-1hpn/#open-source-reflections-winners',
    highlight: true,
    description:
      'Winner in the Open Source Reflections category for <a href="https://dev.to/adiatiayu/beyond-hacktoberfest-building-a-true-open-source-journey-3pci" target="_blank" rel="noopener noreferrer">"Beyond Hacktoberfest: Building a True Open Source Journey"</a>.',
  },
];
