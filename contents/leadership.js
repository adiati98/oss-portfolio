/**
 * Professional roles and community milestones.
 */
module.exports = {
  // Milestones render as the Journey timeline (design blueprint §03).
  // `url` links the title; `description` gives one or two sentences of
  // context (clamped to three lines in the timeline, never truncated in data).
  achievements: [
    {
      title: 'Mautician of the Year',
      year: 2025,
      org: 'Mautic',
      url: 'https://mautic.org/', // TODO(adiati98): link the award announcement
      description:
        'Recognized by the Mautic community for sustained leadership of the documentation program — reviews, releases, and mentoring across both user and developer docs.',
    },
    {
      title: 'Course Creator: Becoming a Maintainer',
      year: 2024,
      org: 'Open Source Communities',
      url: 'https://github.com/OpenSource-Communities', // TODO(adiati98): link the course
      description:
        'Authored and shipped a full course walking contributors through the path from first PR to co-maintainership: triage, review etiquette, and community health.',
    },
  ],
  roles: [
    {
      title: 'Education Team Lead',
      org: 'Mautic',
      orgUrl: 'https://mautic.org/leadership/',
      period: 'January 2026 - Present',
      active: true,
    },
    {
      title: 'Documentation Team Lead',
      org: 'Virtual Coffee',
      orgUrl: 'https://virtualcoffee.io',
      period: 'December 2021 - Present',
      active: true,
    },
    {
      title: 'Co-Maintainer',
      org: 'Open Source Communities',
      orgUrl: 'https://github.com/OpenSource-Communities',
      period: 'June 2025 - Present',
      active: true,
    },
    {
      title: 'Monthly Challenge Team Lead',
      org: 'Virtual Coffee',
      orgUrl: 'https://virtualcoffee.io',
      period: 'December 2023 - Present',
      active: true,
    },
    {
      title: 'Community Advisor',
      org: 'Virtual Coffee',
      orgUrl: 'https://virtualcoffee.io',
      period: 'April 2022 - Present',
      active: true,
    },
    {
      title: 'Assistant Team Lead, Education Team',
      org: 'Mautic',
      orgUrl: 'https://mautic.org/leadership/',
      period: 'June 2025 - December 2025',
      active: false,
    },
    {
      title: 'Docs Maintainer',
      org: 'OpenSauced',
      orgUrl: 'https://github.com/open-sauced',
      period: 'October 2023 - November 2024',
      active: false,
    },
    {
      title: 'Hacktoberfest Support',
      org: 'SheSharp',
      orgUrl: 'https://www.shesharp.co',
      period: 'September 2023 - November 2023',
      active: false,
    },
  ],
};
