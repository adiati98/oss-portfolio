/**
 * OSS talks shown on the Journey milestones timeline with a 🎤 Talk tag
 * (design blueprint §02–§03) — see contents/videos.js for the same shape
 * with a 🎥 Video tag.
 *
 * Where a talk is one segment inside a longer recording, `url` carries the
 * timestamp that jumps straight to it and `length` is left off, since the
 * recording's runtime isn't the talk's.
 *
 * Fields: title (req), event (req), year (req), url (req),
 *         length (e.g. '32 min', optional), blurb (optional)
 */
module.exports = [
  {
    title: 'From Notes to Leadership: My Tech Writing Evolution',
    event: 'Women Techmakers Vienna — IWD 2025',
    year: 2025,
    url: 'https://www.youtube.com/watch?v=aAXkw1UaEtg&t=4877s',
    blurb:
      'How keeping notes for myself turned into writing for communities, and then into leading the teams that maintain the docs.',
  },
  {
    title: 'Intro to Open Source Workshop',
    event: 'Virtual Coffee',
    year: 2024,
    url: 'https://www.youtube.com/watch?v=KoVX3kGMn3c',
    length: '57 min',
    blurb:
      "Co-hosted with Bekah HW: what open source is, why it's worth contributing to, and how to start making an impact.",
  },
  {
    title: 'Becoming an Open Source Maintainer Workshop',
    event: 'Virtual Coffee',
    year: 2024,
    url: 'https://www.youtube.com/watch?v=a-wrAFiBqFI',
    length: '53 min',
    blurb:
      'Co-hosted with Bekah HW: the path from regular contributor to maintainer, and what changes once you are the one deciding what gets accepted.',
  },
  {
    title: 'Building Bridges, Not Walls: The Importance of Documentation in Open Source Projects',
    event: 'Virtual Coffee Lightning Talks',
    year: 2024,
    url: 'https://www.youtube.com/live/pzLXQYZpOPU?t=5368',
    highlight: true,
    blurb:
      'Gave a lightning talk explaining documentation is conversion infrastructure, not a nice-to-have. Clear docs mean faster reviews, quicker-merging PRs, and contributors who come back.',
  },
];
