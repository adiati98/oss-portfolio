/**
 * Metadata for the Glossary page.
 */
const GLOSSARY_CONTENT = {
  title: 'Glossary',
  subtitle: `Plain-English explanations of the terms used across this portfolio — what each one means, and how it's worked out from the underlying GitHub activity.`,

  sections: [
    {
      id: 'portfolioWide',
      title: 'Portfolio-wide Metrics',
      description:
        'Terms for the numbers that sum up all the open source work shown here, from the very first contribution to now.',
      items: [
        {
          id: 'totalImpact',
          title: 'Total Impact',
          description: 'Every contribution counted together, going back to the very first one on GitHub.',
          howItIsCalculated:
            'Adds up merged pull requests, issues, reviewed pull requests, co-authored pull requests, and collaborations.',
        },
        {
          id: 'shippedChanges',
          title: 'Shipped Changes',
          description:
            'How many of those contributions were actually finished and accepted — not just opened.',
          howItIsCalculated:
            'Counts only the contributions GitHub marked as merged. Total Impact also includes work that\'s still open, so this number is smaller — it\'s what\'s actually done.',
        },
        {
          id: 'activeSince',
          title: 'Active Since',
          description: 'The year of the very first recorded contribution on GitHub.',
          howItIsCalculated:
            'Finds the earliest contribution in the data and uses its year as the starting point.',
        },
        {
          id: 'totalImpactedRepos',
          title: 'Impacted Repos',
          description:
            'How many different projects are represented here, and how many organizations those projects belong to.',
          howItIsCalculated:
            'Counts every different external repo with at least one recorded contribution. A project\'s organization is whoever owns the repo — the "octocat" in octocat/Hello-World, for example.',
        },
        {
          id: 'helpedShip',
          title: 'Helped Ship',
          description:
            "How many reviewed or co-authored pull requests actually got merged — work that helped someone else's contribution land, not solo PRs.",
          howItIsCalculated:
            "Counts every reviewed or co-authored pull request that got merged, across the full contribution history. One that's still open, or was closed without merging, doesn't count yet.",
        },
        {
          id: 'primaryFocusProjects',
          title: 'Primary Focus Projects',
          description: 'The three projects with the most contributions, over the full history.',
          howItIsCalculated:
            'Sorts every tracked repo by how many contributions it has, and picks the top three.',
        },
        {
          id: 'persona',
          title: 'Collaboration Profile',
          description: 'A label for the primary way of contributing to the community.',
          howItIsCalculated:
            'Looks at contribution frequency across every category, then picks the label that fits best — for example, "Community Mentor" for a high volume of reviews.',
        },
      ],
    },
    {
      id: 'journey',
      title: 'Journey',
      description: 'Terms used on the Journey page — selected work, talks, expertise, and the roles behind them.',
      items: [
        {
          id: 'milestonesAwards',
          title: 'Selected Work, Awards & Talks',
          description:
            'A showcase of notable work and recognition within the open source community, on one continuous timeline.',
          entryMethod:
            'Each one is added manually. What can be found here: awards, courses and certifications, projects, documentation work, talks, and videos — each one tagged for quick identification.',
        },
        {
          id: 'expertise',
          title: 'Expertise, Tools & Skills',
          description:
            'The skill areas behind the work, plus the tools and languages used to do it. No self-rated skill bars — the rest of the portfolio is the proof.',
          entryMethod:
            'Expertise areas are entered manually in a contents file, each with a title and a short blurb. Tools and skills each show as their own list, but only if there\'s something in it — an empty list just doesn\'t show, heading and all. A few entries can be marked to stand out (bold, in the accent color) to call out the two or three that matter most.',
        },
        {
          id: 'advocacyRoles',
          title: 'Experience & Roles',
          description: 'A record of official roles held within open source organizations.',
          entryMethod:
            'Each role is added by hand in a contents file, along with its dates. Whether it shows as **Active** or **Past** is worked out automatically from those dates.',
        },
      ],
    },
    {
      id: 'workbench',
      title: 'Active Workbench',
      description: 'Terms used on the Active Workbench page — the live board of maintainer and contribution work in progress.',
      items: [
        {
          id: 'activeWorkbench',
          title: 'Board & Lanes',
          description: 'A live board of work in progress, organized by what happens next.',
          entryMethod: `Open pull requests, assigned issues, and review requests are pulled together with live status updates into one board, then sorted into five lanes, ordered by what happens next:

* **Needs your action:** Feedback to address, a review still pending, or a note left after approval.
* **Approved — bring it home:** Reviewed and approved, but not shipped yet — something still needs to happen first, like a final check or a reminder to a maintainer.
* **Waiting on others:** That side of the work is done — awaiting review, or blocked on a linked code PR.
* **Stalled · 30+ days:** No movement in a month — each needs a decision: nudge or close.
* **Automated:** Automatic updates from bots, like routine dependency or security updates — grouped together and kept out of the way.

Only open items are shown; they're removed once they're merged or closed. An empty board reads "Your court is clear" — a good sign, not an error.

A freshness badge in the header reads "Updated Xh ago" (or "Updated just now" / "Updated yesterday") when the board's data loaded live, and "cached · Nd old" when that data isn't available right now and the board is showing the last good saved copy — a banner explains why whenever that happens.`,
        },
        {
          id: 'workbenchStatus',
          title: 'Workbench Status & Ball Tracking',
          description: "A badge on each row showing whose turn it is, whether it's a draft, and how long it's been waiting.",
          entryMethod: `Each task carries a "ball" badge showing whose move it is:
* **Take Action:** New feedback to address, a requested review, or a reply that needs an answer.
* **To Write:** An issue that's assigned, with no pull request opened yet.
* **Approved:** The PR has a formal approval and is heading toward merge. An approval dismissed after a later push still counts — its note names the approver and adds "dismissed after update", asking for a fresh look rather than a from-scratch re-review.
* **Watching:** The ball is with another maintainer or contributor; participation continues in the background.
* **Waiting:** That side of the work is done, and the row is idle by design — a draft not yet marked ready, or work blocked on someone else.
* **Stale:** No real activity for 30+ days on a row where the next move belongs to someone else.
* **Bot:** An automatic update to a dependency or security patch, submitted by a bot, kept in its own lane.

A **Draft** chip marks a pull request still in draft state. **The day count** shown next to a Stalled (or otherwise long-idle) badge is the time since the last real update.

**Note on Timers:** "Idle" ignores noise such as labels, reviewer pings, or base-branch merges. The clock only resets on a new commit, a code review (human or bot), or a discussion comment.`,
        },
      ],
    },
    {
      id: 'writing',
      title: 'Writing',
      description: 'Terms used on the Writing page, covering recognitions and published articles and how they are grouped.',
      items: [
        {
          id: 'recognitions',
          title: 'Recognitions',
          description:
            'External recognition for individual pieces of writing — top-of-the-week picks, challenge wins, and similar mentions. Shown at the top of the page, above the article lists, and only when at least one exists.',
          entryMethod:
            'Each one is added manually in a contents file, with a title, the platform that gave it, and a link. A standout entry can be marked with a star.',
        },
        {
          id: 'articles',
          title: 'Articles Written',
          description:
            'Blog posts and articles about open source, written to support and promote the community. Grouped into **Written for organizations**, for pieces written for a specific org, and **Personal writing**, for everything else.',
          entryMethod:
            'Articles are pulled in automatically from Dev.to, plus added directly for other platforms (like freeCodeCamp) in the contents folder. Pieces written for a specific organization are grouped under **Written for organizations**, newest organization first; everything else is listed under **Personal writing**, newest first.',
        },
      ],
    },
    {
      id: 'quarterlyReports',
      title: 'Quarterly Reports',
      description: 'How contributions are grouped into three-month periods, making them easier to find and read.',
      items: [
        {
          id: 'reportsIndex',
          title: 'Reports Index',
          description:
            'The main list of the portfolio. It organizes all work into separate pages grouped by year and three-month periods (quarters).',
          source:
            'The **Quarterly Reports** page works like a folder, showing every year and, inside each year, its three-month periods.',
        },
      ],
    },
    {
      id: 'quarterlyMetrics',
      title: 'Quarterly Report Metrics',
      description: 'Terms used inside a single report, covering the work done in that three-month period.',
      items: [
        {
          id: 'quarterInBrief',
          title: 'Quarter in brief',
          description:
            'A plain-language summary at the top of each quarterly report: a sentence or two on what happened, which organizations were worked with, and a few highlighted contributions.',
          howItIsCalculated:
            'Built from the same counts as the tables below — merged, reviewed, and co-authored pull requests, and issues — turned into a few sentences, a list of organizations worked with, and up to three highlighted contributions. The Markdown version of the report shows the same numbers as a **Quarterly Statistics** table instead, since Markdown can\'t do the same layout.',
        },
        {
          id: 'stats',
          title: 'Quarterly Statistics',
          description: 'A summary that shows the total work and the projects involved during a specific three-month period.',
          howItIsCalculated:
            'Adds up every type of contribution and every different repo touched during that three-month period.',
        },
        {
          id: 'focusProjects',
          title: 'Top 3 Repositories',
          description: 'The projects that received the most work and attention within each quarter.',
          howItIsCalculated: 'Sorts repos by how many contributions happened in them that quarter.',
        },
        {
          id: 'merged',
          title: 'Merged PRs',
          description: 'A record of pull requests that got accepted and merged into other people\'s repos.',
          howItIsCalculated:
            'Finds every pull request marked as merged, and works out the **Review Period** — the time from opening it to it being accepted.',
        },
        {
          id: 'issues',
          title: 'Issues',
          description: 'A record of bugs, ideas, and problems reported on other people\'s repos.',
          howItIsCalculated:
            'Collects every issue opened, whether or not it was assigned. Works out the **Closing Period** — the time from opening to closing.',
        },
        {
          id: 'reviewed',
          title: 'Reviewed PRs',
          description: 'A record of formal reviews left on other people\'s pull requests.',
          howItIsCalculated:
            'Works out the **Review Period** — from the pull request opening to the formal review being submitted — and tracks its current **Status** and **Last Update**.',
        },
        {
          id: 'coAuthored',
          title: 'Co-authored PRs',
          description: 'A record of pull requests where code was contributed alongside other developers.',
          howItIsCalculated:
            'Finds commits credited to a co-author. The **Commit Period** is the time from the pull request opening to the first commit on it — showing when the collaboration started. **Status** and **Last Update** track where it stands now.',
        },
        {
          id: 'collaborations',
          title: 'Collaborations',
          description: 'A record of comments left on issues or pull requests opened by other people.',
          howItIsCalculated:
            'Tracks comments on pull requests and issues, up until one gets a formal review.',
        },
      ],
    },
  ],
};

module.exports = { GLOSSARY_CONTENT };
