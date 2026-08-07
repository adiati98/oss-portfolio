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
      'Awarded by the Mautic community at Mautic World Conference 2025 in recognition of outstanding individual contribution and dedication to the open-source project.',
  },
];
