# 📖 Glossary

A comprehensive explanation of the terms and categories used to track open source impact, detailing how contribution data is collected, sorted, and calculated within Open Source Portfolio.

## Portfolio-wide Metrics

_Terms used on the main page and README to show the total work done across the full span of open source activity._

| Metric                     | Description                                                                                                    | Calculation Logic                                                                                                           |
| :------------------------- | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **Total Impact**           | The total number of all recorded contributions since the very first activity on GitHub.                        | Adds the grand total of merged PRs, issues, reviewed PRs, co-authored PRs, and community collaborations.                    |
| **Active Since**           | The year of the first recorded contribution found on GitHub.                                                   | Identifies the date of the very first contribution found in the data to set the starting point for the history.             |
| **Impacted Repos**         | The total number of open source projects with at least one contribution.                                       | Identifies every unique external repository containing at least one recorded contribution.                                  |
| **Primary Focus Projects** | The top three repositories where the highest contributions have occurred since the first year of contribution. | Ranks all tracked repositories by lifetime contribution volume and selects the top three.                                   |
| **Collaboration Profile**  | A role assigned based on the primary way of contributing to the community.                                     | Analyzes contribution frequency across all categories to assign a role, such as "Community Mentor" for high review volumes. |

## Quarterly Reports

_How the data is organized into quarters to make it easy to find and read._

| Metric            | Description                                                                                                                   | Data Source                                                                                                                                     |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reports Index** | The main list of the portfolio. It organizes all work into separate pages grouped by year and three-month periods (quarters). | The **Quarterly Reports** page works like a folder, displaying the total contributions for each year and its corresponding three-month periods. |

## Quarterly Report Metrics

_Terms used inside individual reports to explain work done during a specific three-month window._

| Metric                   | Description                                                                                                | Calculation Logic                                                                                                                                                                                                                                                                       |
| :----------------------- | :--------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quarterly Statistics** | A summary that shows the total work and the projects involved during a specific three-month period.        | Aggregates all contribution types and unique repositories involved within a specific three-month window.                                                                                                                                                                                |
| **Top 3 Repositories**   | The projects that received the most work and attention within each quarter.                                | Ranks repositories by the volume of contributions performed during the quarter.                                                                                                                                                                                                         |
| **Merged PRs**           | A record of PRs that were accepted and added to external repositories.                                     | Identifies PRs with a merged status and calculates the **Review Period** as the time from the first proposal to final acceptance.                                                                                                                                                       |
| **Issues**               | A record of technical discoveries, bug reports, and feature proposals created on external repositories.    | Collects all authored issues regardless of assignment. It calculates the **Closing Period** as the time from the initial opening until the issue is finished.                                                                                                                           |
| **Reviewed PRs**         | A record of formal reviews provided on PRs within external repositories.                                   | Measures the **Review Period** from the creation of the PR to the submission of the formal review, while tracking the **Status** and **Last Update** columns for the current state and the most recent activity.                                                                        |
| **Co-Authored PRs**      | A record of PRs where contributions were made directly to the code alongside other developers.             | Identifies credit via co-author commit information. The **Commit Period** spans from the creation of the PR to the first code contribution to indicate when the collaboration started. The **Status** and **Last Update** columns track the current state and the most recent activity. |
| **Collaborations**       | A record of participation in discussions within issues or PRs authored by others in external repositories. | Tracks comments on PRs and issues unless or until they are officially reviewed.                                                                                                                                                                                                         |

## Community & Leadership

_A record of honors, active and past roles, alongside real-time community work._

| Metric                         | Description                                                                                          | Entry Method                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :----------------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Milestones and Awards**      | A showcase of ecosystem honors and significant achievements earned within the open source community. | Entries are manually maintained in files within the contents folder. Each record includes the achievement title, the granting organization, and the year it was received.                                                                                                                                                                                                                                                                                                              |
| **Ecosystem Advocacy & Roles** | A record of formal positions held within open source organizations.                                  | Entries originate from files within the contents folder. Roles are marked as **Active** or **Past** based on the recorded dates.                                                                                                                                                                                                                                                                                                                                                       |
| **Active Workbench**           | A live dashboard of work currently in progress.                                                      | Fetches open tasks from GitHub and filters for active priorities, excluding legacy projects where maintenance is no longer performed. Tasks are sorted into groups:<br><br>• **To do issues:** Assigned issues<br>• **Request review:** PRs waiting for a review<br>• **Review in progress:** Reviews currently being done<br>• **Bot request review:** Automated bot requests waiting for a review<br><br>Only open items are shown; they are removed once they are merged or closed. |

## Community Engagement

_Work that supports the growth and leadership of the open source community outside of writing code._

| Metric               | Description                                                                                               | Entry Method                                                                                                                                                                                             |
| :------------------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Articles Written** | Blog posts and articles around open source written to support and advocate for the open source ecosystem. | Data is aggregated from Dev.to via automated API fetches and combined with manual entries (such as freeCodeCamp) maintained in the contents folder. All entries are combined and sorted chronologically. |

---

[← Back to Summary](./README.md) | _Last updated: 4/22/2026, 1:41:39 AM_
