# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2026-04-30

### Added

- **Ball Tracking Logic**: Introduced a sophisticated status system for ongoing tasks to identify responsibility. Added badges for **TAKE ACTION** (response required), **WAITING** (awaiting PR author or maintainer), **WATCHING** (monitoring discussions or progress), **APPROVED** (ready for merge), and **STALE** (no substantive activity for 21 days).
- **Substantive Activity Filtering**: Implemented a "noise-filtering" activity clock that only resets on new commits, code reviews (human or bot), or discussion comments, explicitly ignoring metadata changes like labels or pings.
- **Idle Detection**: Add stale/idle timer to utilize the new **Last Substantive Date** logic. Tasks display a day count since the last meaningful contribution instead of the raw GitHub update timestamp.
- **Hybrid Review Logic**: Integrated bot reviews (e.g., copilot reviews) into the activity calculation, ensuring they are recognized as substantive events that reset the activity clock.
- **Enhanced Glossary Reference**: - **Glossary Expansion**: Expanded the **Community & Leadership** section with detailed definitions for Workbench categories, Ball Tracking states, and the specific logic governing activity timers.

## [2.4.2] - 2026-04-29

### Added

- **Linked Issue Deduplication**: Implemented logic to parse Pull Request descriptions for "closes/fixes" keywords. Issues linked to open PRs are now automatically removed from the "To do issues" section to prevent redundancy in the Workbench.
- **Priority-Based Sorting**: Reorganized the Active Workbench layout to prioritize "To-do" tasks (Issues and Manual Reviews) at the top, followed by "Ongoing" work and "Bot" requests.

### Changed

- **Transitioned to Issues API**: Switched authored PR fetching to the direct `/issues` endpoint to ensure Draft PRs and unindexed external contributions are accurately captured.
- **Human-Centric Review Logic**: Updated review tracking to only move tasks to "Review in progress" if a human maintainer (not a bot or the author) has interacted with the PR.
- **Refined Commit Attribution**: Updated attribution logic to ignore `web-flow` commits, ensuring Web UI suggestions or edits do not incorrectly trigger "Co-authored" status.
- **Dynamic Brand Alignment**: Refactored Workbench headers and labels to utilize centralized brand colors (`COLORS.primary`) instead of static CSS values.

### Fixed

- **Review Deduplication**: Implemented a priority check to ensure "Review in progress" takes precedence over "Request review" if both statuses are returned by the GitHub API.
- **Execution Order**: Adjusted the main data orchestration sequence to ensure Pull Request data is available before processing issue exclusions.

## [2.4.1] - 2026-04-28

### Changed

- **Status Badges**: Replaced previous "dot and text" indicators with high-visibility, border-rounded pill badges for **Draft**, **Pending Merge**, and **Blocked** states.
- **Optimized Table Layout**: Removed conditional row-level background colors to create a more professional and unified dashboard, focusing attention on the task data.
- **Visual Hierarchy Refinement**: Applied subtle opacity to badge borders and standardized typography to ensure legibility when managing high volumes of tasks.

## [2.4.0] - 2026-04-23

### Added

- **Co-authored Pull Request Tracking**: Introduced logic to detect and display ongoing Pull Requests in external repositories where the user is a co-author, ensuring collaborative contributions are visible.
- **Task Prioritization UI**: Standardized the Active Workbench color scheme to improve visual hierarchy. All ongoing work now uses a clean **Cyan** theme, while manual actions (Issues and Review Requests) utilize a high-contrast **Orange** "To Do" theme.

### Changed

- **Consolidated Categories**: Merged manual "Request review" tasks into the `todo` category to unify the "Action Required" workflow.

# [2.3.0] - 2026-04-22

### Added

- **Active Workbench Status Column**: Added a dedicated "Status" column to the maintenance tables in the `community-markdown-generator.js`.
- **Workbench Status Badges**: Integrated shields.io colored badges (DRAFT, PENDING MERGE, BLOCKED) into the Active Workbench to visualize task states.
- **Quarterly Report Status Badges**: Implemented shields.io colored badges (OPEN, MERGED, CLOSED) in the `quarterly-reports-generator.js` for contribution history.

## [2.2.0] - 2026-04-21

### Added

- **Authored Pull Request Tracking**: Introduced `fetchOngoingAuthoredPrs` to monitor open Pull Requests authored by the user in external repositories.
- **Workbench UI Hierarchy**: Implemented a new layout for the Active Workbench, positioning status indicators under the repository name.
- **Draft Support**: Added logic to `fetchOngoingReviews` and authored Pull Requests to detect and display "Draft" status.
- **Pending Merge Status**: Added logic to detect and display "Pending Merge" status for approved Pull Requests with the specific `pending-pr-merge` label.
- **Blocked State Tracking**: Introduced detection for "Blocked" or "Stalled" work based on repository labels.
- **Status Indicators**: Added visual indicators (Status Dots) and conditional row highlighting for Draft, Pending Merge, and Blocked states.

## [2.1.1] - 2026-04-20

### Added

- **Role Context**: Added support for organization URLs in the leadership data, allowing organizations to link directly to the website.

### Changed

- **UI Alignment**: Refined the layout of the Ecosystem Advocacy & Roles section to improve the vertical alignment of status badges and periods.
- **Link Styling**: Implemented brand-colored interactive links for organizations with matching hover decoration colors.

## [2.1.0] - 2026-04-19

### Added

- **Active Workbench**: Real-time tracking for assigned GitHub Issues and submitted PR placeholders.

### Changed

- **UI Contrast**: Darkened status badges and count indicators for better accessibility.
- **Exclusion Logic**: Improved repository filtering to support organization-wide exclusions in the workbench.

## [2.0.0] - 2026-04-12

### Changed

- **Landing Page Pivot**: Promoted the "All-Time Contributions" view to the primary `index.html`.
- **Breaking Change (URL Restructuring)**: Moved the detailed contribution view from `all-contributions.html` to the primary landing page (`index.html`).
- **Structural Migration**: Moved descriptive content and metric explanations to a new dedicated Glossary page.

### Added

- **Glossary Page**: Introduced a technical reference for portfolio metrics, calculation methods, and data sources.

### Removed

- **Redundant generator**: Removed `all-contributions-html-generator.js` as its functionality is now handled by the main index generator.