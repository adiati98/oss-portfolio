# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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