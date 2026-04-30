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
            'The total number of all recorded contributions since the very first activity on GitHub.',
          howItIsCalculated:
            'Adds the grand total of merged PRs, issues, reviewed PRs, co-authored PRs, and community collaborations.',
        },
        {
          id: 'activeSince',
          title: 'Active Since',
          description: 'The year of the first recorded contribution found on GitHub.',
          howItIsCalculated:
            'Identifies the date of the very first contribution found in the data to set the starting point for the history.',
        },
        {
          id: 'totalImpactedRepos',
          title: 'Impacted Repos',
          description: 'The total number of open source projects with at least one contribution.',
          howItIsCalculated:
            'Identifies every unique external repository containing at least one recorded contribution.',
        },
        {
          id: 'primaryFocusProjects',
          title: 'Primary Focus Projects',
          description:
            'The top three repositories where the highest contributions have occurred since the first year of contribution.',
          howItIsCalculated:
            'Ranks all tracked repositories by lifetime contribution volume and selects the top three.',
        },
        {
          id: 'persona',
          title: 'Collaboration Profile',
          description: 'A role assigned based on the primary way of contributing to the community.',
          howItIsCalculated:
            'Analyzes contribution frequency across all categories to assign a role, such as "Community Mentor" for high review volumes.',
        },
      ],
    },
    {
      id: 'quarterlyReports',
      title: 'Quarterly Reports',
      description: 'How the data is organized into quarters to make it easy to find and read.',
      items: [
        {
          id: 'reportsIndex',
          title: 'Reports Index',
          description:
            'The main list of the portfolio. It organizes all work into separate pages grouped by year and three-month periods (quarters).',
          source:
            'The **Quarterly Reports** page works like a folder, displaying the total contributions for each year and its corresponding three-month periods.',
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
            'A summary that shows the total work and the projects involved during a specific three-month period.',
          howItIsCalculated:
            'Aggregates all contribution types and unique repositories involved within a specific three-month window.',
        },
        {
          id: 'focusProjects',
          title: 'Top 3 Repositories',
          description:
            'The projects that received the most work and attention within each quarter.',
          howItIsCalculated:
            'Ranks repositories by the volume of contributions performed during the quarter.',
        },
        {
          id: 'merged',
          title: 'Merged PRs',
          description: 'A record of PRs that were accepted and added to external repositories.',
          howItIsCalculated:
            'Identifies PRs with a merged status and calculates the **Review Period** as the time from the first proposal to final acceptance.',
        },
        {
          id: 'issues',
          title: 'Issues',
          description:
            'A record of technical discoveries, bug reports, and feature proposals created on external repositories.',
          howItIsCalculated:
            'Collects all authored issues regardless of assignment. It calculates the **Closing Period** as the time from the initial opening until the issue is finished.',
        },
        {
          id: 'reviewed',
          title: 'Reviewed PRs',
          description: 'A record of formal reviews provided on PRs within external repositories.',
          howItIsCalculated:
            'Measures the **Review Period** from the creation of the PR to the submission of the formal review, while tracking the **Status** and **Last Update** columns for the current state and the most recent activity.',
        },
        {
          id: 'coAuthored',
          title: 'Co-Authored PRs',
          description:
            'A record of PRs where contributions were made directly to the code alongside other developers.',
          howItIsCalculated:
            'Identifies credit via co-author commit information. The **Commit Period** spans from the creation of the PR to the first code contribution to indicate when the collaboration started. The **Status** and **Last Update** columns track the current state and the most recent activity.',
        },
        {
          id: 'collaborations',
          title: 'Collaborations',
          description:
            'A record of participation in discussions within issues or PRs authored by others in external repositories.',
          howItIsCalculated:
            'Tracks comments on PRs and issues unless or until they are officially reviewed.',
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
            'Entries are manually maintained in files within the contents folder. Each record includes the achievement title, the granting organization, and the year it was received.',
        },
        {
          id: 'advocacyRoles',
          title: 'Ecosystem Advocacy & Roles',
          description: 'A record of formal positions held within open source organizations.',
          entryMethod:
            'Entries originate from files within the contents folder. Roles are marked as **Active** or **Past** based on the recorded dates.',
        },
        {
          id: 'activeWorkbench',
          title: 'Active Workbench',
          description: 'A live dashboard of work currently in progress.',
          entryMethod: `Fetches open tasks from GitHub and filters for active priorities, excluding legacy projects where maintenance is no longer performed. Tasks are sorted into groups:

* **To do issues:** Assigned issues
* **Request review:** PRs waiting for a review
* **Review in progress:** Reviews currently being done
* **Bot request review:** Automated bot requests waiting for a review

Only open items are shown; they are removed once they are merged or closed.`,
        },
        {
          id: 'workbenchStatus',
          title: 'Workbench Status & Ball Tracking',
          description: 'Visual indicators used to track responsibility and activity.',
          entryMethod: `Each task features a "Ball Tracking" badge to show the current state of responsibility:
* **TAKE ACTION:** Indicates a response is required following the most recent substantive activity from another maintainer, contributor, or a bot review.
* **WAITING:** Confirms the last substantive action was performed by the user; awaiting a response from the PR author or a maintainer.
* **WATCHING:** Participation exists, but the current interaction is primarily between other maintainers or contributors.
* **APPROVED:** The PR has received a formal approval and is ready for the final merge process.
* **STALE:** No substantive activity (comments, code, or reviews) has occurred for 21 days. **The day count** on this badge reflects the time elapsed since the last substantive update, identifying tasks that may require a follow-up or a "nudge" to resume progress.

**Note on Timers:** The "Last Update" date ignores "noise" such as labels, reviewer pings, or base-branch merges. The activity clock only resets when a new commit, a code review (performed by a human or a bot), or a discussion comment is provided.`,
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
            'Data is aggregated from Dev.to via automated API fetches and combined with manual entries (such as freeCodeCamp) maintained in the contents folder. All entries are combined and sorted chronologically.',
        },
      ],
    },
  ],
};

module.exports = { GLOSSARY_CONTENT };
