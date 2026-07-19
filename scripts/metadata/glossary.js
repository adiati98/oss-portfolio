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
        'Terms used in this portfolio to show the total work done across the full span of open source activity.',
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
          description:
            'The total number of open source projects — and the distinct organizations they belong to — with at least one contribution.',
          howItIsCalculated:
            'Identifies every unique external repository containing at least one recorded contribution. Each project\'s organization is identified by the account name that owns it — for example, "octocat" in octocat/Hello-World.',
        },
        {
          id: 'helpedShip',
          title: 'Helped Ship',
          description:
            "How many pull requests were reviewed or co-authored that a maintainer actually merged — work that helped land someone else's contribution, not solo PRs.",
          howItIsCalculated:
            'Counts every reviewed or co-authored PR that was actually merged, across the full contribution history. One that is still open, or that closed without merging, does not count yet.',
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
          id: 'quarterInBrief',
          title: 'Quarter in brief',
          description:
            'A plain-language summary at the top of each quarterly report: a sentence or two on what happened, which organizations were worked with, and a few highlighted contributions.',
          howItIsCalculated:
            'Composed from the same counts as the tables below (merged, reviewed, and co-authored PRs, issues) into narrative sentences, a "Worked with" row of organization names, and up to three highlighted contributions. The Markdown version of each report shows the same underlying counts as a **Quarterly Statistics** table instead, within Markdown\'s styling limits.',
        },
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
          title: 'Co-authored PRs',
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
      id: 'journey',
      title: 'Journey',
      description:
        'Terms used on the Journey page — milestones, talks, expertise, and the roles behind them.',
      items: [
        {
          id: 'milestonesAwards',
          title: 'Milestones, Awards & Talks',
          description:
            'A showcase of ecosystem honors, significant achievements, and speaking engagements within the open source community, on one continuous timeline.',
          entryMethod:
            'Achievements are manually maintained in files within the contents folder — each record includes the title, the granting organization, and the year it was received. Talks join the same timeline from a separate contents file, tagged **🎤 Talk**, and carry the event name, year, and a short blurb in place of an organization and description. An empty talks list simply contributes nothing — no placeholder or empty section appears.',
        },
        {
          id: 'expertise',
          title: 'Expertise, Tools & Skills',
          description:
            'The named competency areas behind the work, plus the tools and languages used to do it — no self-graded proficiency bars, since the rest of the portfolio is the evidence.',
          entryMethod:
            'Expertise areas are manually maintained in a contents file as a title and a short blurb. Tools and skills each render as their own list only when non-empty — an empty list hides its whole heading rather than showing it bare. A small set of entries can be marked for a highlighted (bolded / accented) treatment to call out the two or three most identity-defining items.',
        },
        {
          id: 'advocacyRoles',
          title: 'Experience & Roles',
          description: 'A record of formal positions held within open source organizations.',
          entryMethod:
            'Entries originate from files within the contents folder. Roles are marked as **Active** or **Past** based on the recorded dates.',
        },
      ],
    },
    {
      id: 'workbench',
      title: 'Active Workbench',
      description:
        'Terms used on the Active Workbench page — the live board of maintainer and contribution work in progress.',
      items: [
        {
          id: 'activeWorkbench',
          title: 'Board & Lanes',
          description:
            'A live triage board of maintainer and contribution work in progress, organized by what happens next.',
          entryMethod: `Open pull requests, assigned issues, and review requests are combined with a live external status feed into a single board, then sorted into five lanes, ordered by what happens next:

* **Needs your action:** Feedback to address, a review still pending, or a note left after approval.
* **Approved — bring it home:** Reviewed and approved, but not shipped yet — something still needs to happen first, like a final check or a reminder to a maintainer.
* **Waiting on others:** That side of the work is done — awaiting review, or blocked on a linked code PR.
* **Stalled · 30+ days:** No movement in a month — each needs a decision: nudge or close.
* **Automated:** Automatic updates from bots, like routine dependency or security updates — grouped together and kept out of the way.

Only open items are shown; they are removed once they are merged or closed. An empty board reads "Your court is clear" — a positive state, not an error.

A freshness badge in the header reads "Updated Xh ago" (or "Updated just now" / "Updated yesterday") when the board's data loaded live, and "cached · Nd old" when that data is temporarily unavailable and the board is showing the last good saved copy — a banner explains why whenever that happens.`,
        },
        {
          id: 'workbenchStatus',
          title: 'Workbench Status & Ball Tracking',
          description:
            'Visual indicators on each Workbench row showing who needs to act next, whether it is a draft, and how long it has waited.',
          entryMethod: `Each task carries a "ball" badge showing whose move it is:
* **Take Action:** New feedback to address, a requested review, or a reply that needs an answer.
* **To Write:** An issue that's assigned, with no pull request opened yet.
* **Approved:** The PR has a formal approval and is heading toward merge. An approval dismissed after a later push still counts — its note names the approver and adds "dismissed after update", asking for a fresh look rather than a from-scratch re-review.
* **Watching:** The ball is with another maintainer or contributor; participation continues in the background.
* **Waiting:** That side of the work is done, and the row is idle by design — a draft not yet marked ready, or work blocked on someone else.
* **Stale:** No substantive activity for 30+ days on a row where the next move belongs to someone else.
* **Bot:** An automatic update to a dependency or security patch, submitted by a bot, kept in its own lane.

A **Draft** chip marks a pull request still in draft state. **The day count** shown next to a Stalled (or otherwise long-idle) badge reflects the time elapsed since the last substantive update.

**Note on Timers:** "Idle" ignores noise such as labels, reviewer pings, or base-branch merges. The clock only resets on a new commit, a code review (human or bot), or a discussion comment.`,
        },
      ],
    },
    {
      id: 'writing',
      title: 'Writing',
      description:
        'Terms used on the Writing page, covering published articles and how they are grouped.',
      items: [
        {
          id: 'articles',
          title: 'Articles Written',
          description:
            'Blog posts and articles around open source written to support and advocate for the open source ecosystem.',
          entryMethod:
            'Data is aggregated from Dev.to via automated API fetches and combined with manual entries (such as freeCodeCamp) maintained in the contents folder. Pieces written for a specific organization are grouped under a **Written for organizations** heading, newest organization first; everything else lists as personal writing, newest article first.',
        },
      ],
    },
  ],
};

module.exports = { GLOSSARY_CONTENT };
