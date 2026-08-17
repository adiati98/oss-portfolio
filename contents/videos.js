/**
 * Video content (recordings, YouTube, course walkthroughs, etc.) shown on
 * the Journey milestones timeline with a 🎥 Video tag — same shape as
 * contents/talks.js, kept in its own file so talks.js stays talks-only.
 *
 * Fields: title (req), event (req), year (req), url (req),
 *         length (e.g. '12 min', optional), blurb (optional)
 */
module.exports = [
  {
    title: 'Setting up your local environment to work with the Mautic Documentation',
    event: 'Mautic',
    year: 2025,
    url: 'https://www.youtube.com/watch?v=Hnzp-aJ4NWA',
    length: '11 min',
    blurb:
      "As Assistant Team Lead for Mautic's Education Team, walked contributors through setting up a local environment to contribute, test, and review documentation PRs.",
  },
  {
    title:
      'How to create a PR in the low and no code repository for your contribution to be counted',
    event: 'Mautic',
    year: 2025,
    url: 'https://www.youtube.com/watch?v=jP-7LEyNo_k',
    length: '6 min',
    blurb:
      "As Assistant Team Lead for Mautic's Education Team, explained how to file a PR for low/no-code contributions so they count toward Hacktoberfest and other contribution tracking.",
  },
];
