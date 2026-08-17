/**
 * Awards and recognition from others, shown on the Journey milestones
 * timeline with a 🏆 Award tag.
 *
 * Fields: title (req), org (req), year (req),
 *         yearEnd (optional: a year, or 'present'),
 *         url (req), description (optional),
 *         highlight (optional: shows before the "show more" control)
 */
module.exports = [
  {
    title: 'Mautician of the Year',
    org: 'Mautic',
    year: 2025,
    url: 'https://mautic.org/blog/learnings-from-mautic-world-conference-2025/',
    highlight: true,
    description:
      "Won Mautic's 2025 Mautician of the Year award, selected by a panel from the year's active contributors for exceptional support, ideas, and dedication to the community.",
  },
];
