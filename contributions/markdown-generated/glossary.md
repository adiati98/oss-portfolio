# 📖 Glossary

A comprehensive explanation of the terms and categories used to track open source impact, detailing how contribution data is collected, sorted, and calculated within Open Source Portfolio.

## Portfolio-wide Metrics

_Terms used on the main page and README to show the total work done across the full span of open source activity._

| Metric                    | Description                                                                        | Calculation Logic                                                                                                                                        |
| :------------------------ | :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total Impact**          | The total number of all recorded contributions made since the portfolio started.   | This value is the grand total of merged PRs, issues, reviews, co-authored PRs, and community collaborations.                                             |
| **Active Since**          | The year of the first recorded contribution in this portfolio.                     | This shows the date of the very first event found in the data, setting the starting point for the history.                                               |
| **Impacted Repos**        | The total number of different open source projects with at least one contribution. | This counts every separate repository owned by others that has at least one tracked action.                                                              |
| **Collaboration Profile** | An identity assigned based on the primary way of contributing to the community.    | The system analyzes which type of work is performed most frequently. For example, a high volume of reviewed PRs results in a "Community Mentor" profile. |

## Quarterly Reports

_How the data is organized into seasons to make it easy to find and read._

| Metric            | Description                                                                                                                   | Data Source                                                                                                                                |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Reports Index** | The main list of the portfolio. It organizes all work into separate pages grouped by year and three-month periods (quarters). | The **Quarterly Reports** page works like a folder, displaying the total activity for each year and its corresponding three-month periods. |

## Quarterly Report Metrics

_Terms used inside individual reports to explain work done during a specific three-month window._

| Metric                   | Description                                                                                                           | Calculation Logic                                                                                                                                                                                                                                                                                             |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Quarterly Statistics** | A short summary that shows the total work and the projects involved during a specific three-month period.             | The system adds up all types of work and the number of repositories involved to show the total amount of activity for that quarter.                                                                                                                                                                           |
| **Top 3 Repositories**   | The projects that received the most work and attention.                                                               | The system ranks repositories by the amount of activity to show where the most effort was spent.                                                                                                                                                                                                              |
| **Merged PRs**           | A record of PRs that were accepted and added to projects owned by others.                                             | This shows all work that was finalized (merged). The **Review Period** shows the time from the first proposal to the final acceptance.                                                                                                                                                                        |
| **Issues**               | A record of technical discoveries, bug reports, and feature proposals created on projects owned by others.            | This includes all authored issue threads regardless of who is assigned to resolve them. The **Closing Period** shows the time from the opening of an issue until it is finished.                                                                                                                              |
| **Reviewed PRs**         | A record of formal reviews on PRs where technical feedback or code quality was evaluated on projects owned by others. | This tracks formal reviews. The **Review Period** shows the time from when the PR was created until it was finished. This highlights the speed and efficiency of the review process. The **Status** shows the current state, and **Last Update** shows the most recent activity.                              |
| **Co-Authored PRs**      | A record of PRs where work was performed directly on the code with others.                                            | This identifies work credited via co-author commit information. The **Commit Period** shows the time from when the PR was created until the first code contribution, showing when the actual work started. The **Status** shows the standing of the work, and **Last Update** shows when it was last changed. |
| **Collaborations**       | A record of joining discussions and conversations within issues or PRs owned by others.                               | This tracks talking with other contributors and maintainers to help move a task toward completion.                                                                                                                                                                                                            |

## Community & Leadership

_A record of honors, active and past roles, alongside real-time community work._

| Metric                         | Description                                                                                          | Entry Method                                                                                                                                             |
| :----------------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Milestones and Awards**      | A showcase of ecosystem honors and significant achievements earned within the open source community. | Entries are manually maintained in a metadata file. Each record includes the achievement title, the granting organization, and the year it was received. |
| **Ecosystem Advocacy & Roles** | A record of formal positions held within open source organizations.                                  | Entries come from a manually maintained metadata file. Roles are marked as **Active** or **Past** based on the recorded dates.                           |
| **Active Workbench**           | A live dashboard of work currently in progress.                                                      | Tasks are fetched from GitHub and sorted into groups:                                                                                                    |

- **To do issues:** Assigned issues
- **Request review:** PRs waiting for a review
- **Review in progress:** Reviews currently being done
- **Bot request review:** Automated bot requests waiting for a review

Only **open** items are shown; they are removed once they are merged or closed. |

## Community Engagement

_Work that supports the growth and leadership of the open source community outside of writing code._

| Metric               | Description                                                                                               | Entry Method                                                                                                                                            |
| :------------------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Articles Written** | Blog posts and articles around open source written to support and advocate for the open source ecosystem. | Data is aggregated from Dev.to (via automated API fetches) and freeCodeCamp (via manual curation). All entries are combined and sorted chronologically. |

---

[← Back to Summary](./README.md) | _Last updated: 4/13/2026, 1:42:18 AM_
