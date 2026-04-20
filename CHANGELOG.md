# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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