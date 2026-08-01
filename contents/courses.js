/**
 * Courses — both ones you authored and ones you took — shown on the Journey
 * milestones timeline with a 🎓 Course tag.
 *
 * Fields: title (req), org (req), year (req),
 *         yearEnd (optional: a year, or 'present'),
 *         description (optional),
 *         highlight (optional: shows before the "show more" control)
 *
 * Links — pick whichever fits the entry, both are optional and either can
 * be left out without breaking anything:
 *   url               a single link (e.g. a course you authored — the
 *                      course page itself is the evidence)
 *   courseUrl /
 *   certificationUrl  for a course you took: the course page and the
 *                      certificate you earned for completing it. The title
 *                      links to whichever of the two exists; if both do,
 *                      the other shows as a small "Certificate" link next
 *                      to it.
 */
module.exports = [
  {
    title: 'Course Creator: Becoming a Maintainer',
    org: 'Open Source Communities',
    year: 2024,
    url: 'https://learn.osscommunities.com/becoming-a-maintainer/',
    description:
      "Wrote and published a full course taking contributors from their first change through to helping run a project — sorting incoming issues, reviewing other people's work, and keeping a community healthy.",
  },
  // Example of a course you took rather than authored — course and
  // certificate as two separate, both-optional links:
  // {
  //   title: 'Advanced Git',
  //   org: 'Some Learning Platform',
  //   year: 2025,
  //   courseUrl: 'https://example.com/courses/advanced-git',
  //   certificationUrl: 'https://example.com/certificates/abc123',
  // },
];
