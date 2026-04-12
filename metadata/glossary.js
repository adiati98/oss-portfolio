/**
 * Metadata for the Glossary page.
 */
const GLOSSARY_CONTENT = {
  title: 'Glossary',
  subtitle: `A comprehensive explanation of the terms and categories used to track open source impact, detailing how contribution data is collected, sorted, and calculated within Open Source Portfolio.`,

  sections: [
    {
      id: 'portfolioWide',
      title: 'Portfolio-wide Metrics',
      description:
        'Terms used on the main page and README to show the total work done across the full span of open source activity.',
      items: [
        {
          id: 'totalImpact',
          title: 'Total Impact',
          description:
            'The total number of all recorded contributions made since the portfolio started.',
          howItIsCalculated:
            'This value is the grand total of merged PRs, issues, reviews, co-authored PRs, and community collaborations.',
        },
        {
          id: 'activeSince',
          title: 'Active Since',
          description: 'The year of the first recorded contribution in this portfolio.',
          source:
            'This shows the date of the very first event found in the data, setting the starting point for the history.',
        },
        {
          id: 'totalImpactedRepos',
          title: 'Impacted Repos',
          description:
            'The total number of different open source projects with at least one contribution.',
          howItIsCalculated:
            'This counts every separate repository owned by others that has at least one tracked action.',
        },
        {
          id: 'persona',
          title: 'Collaboration Profile',
          description:
            'An identity assigned based on the primary way of contributing to the community.',
          howItIsCalculated:
            'The system analyzes which type of work is performed most frequently. For example, a high volume of reviewed PRs results in a "Community Mentor" profile.',
        },
      ],
    },
    {
      id: 'quarterlyReports',
      title: 'Quarterly Reports',
      description: 'How the data is organized into seasons to make it easy to find and read.',
      items: [
        {
          id: 'reportsIndex',
          title: 'Reports Index',
          description:
            'The main list of the portfolio. It organizes all work into separate pages grouped by year and three-month periods (quarters).',
          source:
            'The **Quarterly Reports** page works like a folder, displaying the total activity for each year and its corresponding three-month periods.',
        },
      ],
    },
    {
      id: 'quarterlyMetrics',
      title: 'Quarterly Report Metrics',
      description:
        'Terms used inside individual reports to explain work done during a specific three-month window.',
      items: [
        {
          id: 'stats',
          title: 'Quarterly Statistics',
          description:
            'A short summary that shows the total work and the projects involved during a specific three-month period.',
          howItIsCalculated:
            'The system adds up all types of work and the number of repositories involved to show the total amount of activity for that quarter.',
        },
        {
          id: 'focusProjects',
          title: 'Top 3 Repositories',
          description: 'The projects that received the most work and attention.',
          howItIsCalculated:
            'The system ranks repositories by the amount of activity to show where the most effort was spent.',
        },
        {
          id: 'merged',
          title: 'Merged PRs',
          description: 'A record of PRs that were accepted and added to projects owned by others.',
          howItIsCalculated:
            'This shows all work that was finalized (merged). The **Review Period** shows the time from the first proposal to the final acceptance.',
        },
        {
          id: 'issues',
          title: 'Issues',
          description:
            'A record of technical discoveries, bug reports, and feature proposals created on projects owned by others.',
          howItIsCalculated:
            'This includes all authored issue threads regardless of who is assigned to resolve them. The **Closing Period** shows the time from the opening of an issue until it is finished.',
        },
        {
          id: 'reviewed',
          title: 'Reviewed PRs',
          description:
            'A record of formal reviews on PRs where technical feedback or code quality was evaluated on projects owned by others.',
          howItIsCalculated:
            'This tracks formal reviews. The **Review Period** shows the time from when the PR was created until it was finished. This highlights the speed and efficiency of the review process. The **Status** shows the current state, and **Last Update** shows the most recent activity.',
        },
        {
          id: 'coAuthored',
          title: 'Co-Authored PRs',
          description: 'A record of PRs where work was performed directly on the code with others.',
          howItIsCalculated:
            'This identifies work credited via co-author commit information. The **Commit Period** shows the time from when the PR was created until the first code contribution, showing when the actual work started. The **Status** shows the standing of the work, and **Last Update** shows when it was last changed.',
        },
        {
          id: 'collaborations',
          title: 'Collaborations',
          description:
            'A record of joining discussions and conversations within issues or PRs owned by others.',
          howItIsCalculated:
            'This tracks talking with other contributors and maintainers to help move a task toward completion.',
        },
      ],
    },
    {
      id: 'communityLeadership',
      title: 'Community & Leadership',
      description: 'A record of honors, active and past roles, alongside real-time community work.',
      items: [
        {
          id: 'milestonesAwards',
          title: 'Milestones and Awards',
          description:
            'A showcase of ecosystem honors and significant achievements earned within the open source community.',
          entryMethod:
            'Entries are manually maintained in a metadata file. Each record includes the achievement title, the granting organization, and the year it was received.',
        },
        {
          id: 'advocacyRoles',
          title: 'Ecosystem Advocacy & Roles',
          description: 'A record of formal positions held within open source organizations.',
          entryMethod:
            'Entries come from a manually maintained metadata file. Roles are marked as **Active** or **Past** based on the recorded dates.',
        },
        {
          id: 'activeWorkbench',
          title: 'Active Workbench',
          description: 'A live dashboard of work currently in progress.',
          entryMethod: `Tasks are fetched from GitHub and sorted into groups:

* **To do issues:** Assigned issues
* **Request review:** PRs waiting for a review
* **Review in progress:** Reviews currently being done
* **Bot request review:** Automated bot requests waiting for a review

Only **open** items are shown; they are removed once they are merged or closed.`,
        },
      ],
    },
    {
      id: 'engagement',
      title: 'Community Engagement',
      description:
        'Work that supports the growth and leadership of the open source community outside of writing code.',
      items: [
        {
          id: 'articles',
          title: 'Articles Written',
          description:
            'Blog posts and articles around open source written to support and advocate for the open source ecosystem.',
          entryMethod:
            'Data is aggregated from Dev.to (via automated API fetches) and freeCodeCamp (via manual curation). All entries are combined and sorted chronologically.',
        },
      ],
    },
  ],
};

module.exports = { GLOSSARY_CONTENT };
