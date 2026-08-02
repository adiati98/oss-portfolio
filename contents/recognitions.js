/**
 * External recognition for individual pieces of writing — top-of-the-week
 * picks, challenge wins, editor's choice, etc. Shown at the top of the
 * Writing page, above the article lists.
 *
 * Fields: title (req — the recognized piece's title, or the recognition
 *         itself), org (req — the platform/publication that recognized it),
 *         month (req — 1–12), year (req), url (req — link to the piece or
 *         the recognition), description (optional — plain prose, no HTML),
 *         article (optional — URL of the specific article the recognition
 *         calls out; omitted when the recognition covers a body of work
 *         rather than one piece), articleTitle (optional — the linked
 *         article's title text, required alongside `article`), highlight
 *         (optional: renders with a ★ marker for a standout entry)
 */
module.exports = [
  {
    title: 'Top 7 Featured DEV Posts of the Week',
    org: 'DEV Community',
    month: 11,
    year: 2021,
    url: 'https://dev.to/devteam/top-7-featured-dev-posts-from-the-past-week-35fb',
    article: 'https://dev.to/adiatiayu/contributing-to-open-source-101-2dnm',
    articleTitle: 'Contributing to Open Source 101',
    description: 'Featured for "Contributing to Open Source 101".',
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
    article:
      'https://dev.to/adiatiayu/mini-portfolio-bring-your-github-profile-to-the-next-level-5c8n',
    articleTitle: 'Mini Portfolio: Bring Your GitHub Profile to the Next Level',
    description:
      'Featured for "Mini Portfolio: Bring Your GitHub Profile to the Next Level".',
  },
  {
    title: 'Top Featured CodeNewbie Posts',
    org: 'CodeNewbie',
    month: 8,
    year: 2023,
    url: 'https://dev.to/codenewbieteam/top-featured-codenewbie-posts-81723-48i4',
    article: 'https://dev.to/adiatiayu/how-to-communicate-better-in-open-source-3hdj',
    articleTitle: 'How to Communicate Better in Open Source',
    description: 'Featured for "How to Communicate Better in Open Source".',
  },
  {
    title: "Quincy Larson's Weekly Email — Sep 22, 2023",
    org: 'freeCodeCamp',
    month: 9,
    year: 2023,
    url: 'https://github.com/freeCodeCamp/awesome-quincy-larson-emails#sep-22-2023',
    article: 'https://www.freecodecamp.org/news/how-to-contribute-to-open-source/',
    articleTitle:
      'How to Contribute to Open Source Projects – Non-Technical Things You Should Know',
    description:
      'Recommended in the newsletter for "How to Contribute to Open Source Projects – Non-Technical Things You Should Know".',
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
    article:
      'https://dev.to/adiatiayu/the-curated-automated-open-source-portfolio-how-its-going-5f98',
    articleTitle: "The Curated, Automated Open Source Portfolio: How It's Going",
    description:
      'Featured for "The Curated, Automated Open Source Portfolio: How It\'s Going".',
  },
  {
    title: 'Top 7 Featured DEV Posts of the Week',
    org: 'DEV Community',
    month: 10,
    year: 2025,
    url: 'https://dev.to/devteam/top-7-featured-dev-posts-of-the-week-53an',
    article:
      'https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0',
    articleTitle: 'How I Built a Curated, Automated Open Source Portfolio',
    description: 'Featured for "How I Built a Curated, Automated Open Source Portfolio".',
  },
  {
    title: '2025 Hacktoberfest Writing Challenge Winners',
    org: 'DEV Community',
    month: 11,
    year: 2025,
    url: 'https://dev.to/devteam/congrats-to-the-2025-hacktoberfest-writing-challenge-winners-1hpn/#open-source-reflections-winners',
    highlight: true,
    article: 'https://dev.to/adiatiayu/beyond-hacktoberfest-building-a-true-open-source-journey-3pci',
    articleTitle: 'Beyond Hacktoberfest: Building a True Open Source Journey',
    description:
      'Winner in the Open Source Reflections category for "Beyond Hacktoberfest: Building a True Open Source Journey".',
  },
];
