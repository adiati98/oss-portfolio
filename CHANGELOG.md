# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-07-19

### Added

- **New Journey and Workbench pages**: The old combined "Community & Activity" page is now two focused pages. **Journey** shows milestones, skills, and work history. **Workbench** shows what needs attention right now, sorted into plain groups like "Needs your action," "Waiting," and "Stalled." Old links to the previous page still work — they quietly send visitors to the right new page.
- **Redesigned Home page**: A cleaner front page with a quick lifetime summary (total contributions, articles published, projects worked on), a simple breakdown of the kinds of contributions made, the projects worked on the most, and a short "collaboration style" badge.
- **Writing page rebuilt**: Articles are now grouped by the organization they were written for, with a separate list for personal posts, and each group shows how many articles it has.
- **"Back to top" and "skip to content" buttons everywhere**: Every page now has a way to jump back to the top, including a button inside each contribution category on quarterly reports, so long lists are easier to get through.
- **Plain-language quarterly summaries**: Each quarterly report now opens with a short, human sentence explaining what happened that quarter, instead of only showing numbers.

### Changed

- **One consistent color system, including full dark mode**: Every page — reports, glossary, and the main site — now shares the same color system. Forking the project only requires picking five colors; everything else, light or dark, adjusts automatically while staying easy to read.
- **Mobile-friendly report tables**: Quarterly report tables now turn into simple stacked cards on phones instead of forcing a sideways scroll to read them.
- **Smarter Workbench task list**: Fixed several cases where the "what needs my attention" list showed the wrong thing — including tasks that were actually waiting on a reply being mislabeled as "stale," and bots being mixed in with real contributors.
- **Tidier landing page layout**: The homepage's profile card and lifetime-summary card are now the same width as the section below them, so the page feels less cluttered. Organization names on the Writing page now show in the site's brand color.
- **Simplified milestone and article links**: Removed the small arrow icon next to milestone and article titles for a cleaner look.

### Fixed

- **Security hardening**: Closed several gaps where content pulled from GitHub (like PR titles or repository names) could have broken the page layout or run unintended code if it contained unusual characters.
- **Easier-to-read text in dark mode**: Several places had text that was too faint to read comfortably in dark mode, including the navigation bar — all of them are now clear and easy to read.
- **Missing "back to top" button**: This button was invisible on the Glossary, Reports, and quarterly report pages because of a styling bug. It now shows up correctly everywhere.
- **Sideways scrolling on phones**: Fixed several places — the homepage and quarterly report tables — where long text could push the page wider than the screen, forcing an awkward sideways scroll on mobile.
- **Small counting bugs**: Fixed the Workbench "Automated" count always showing 0 instead of the real number, and a couple of other spots where the numbers shown didn't match reality.

## [2.12.1] - 2026-07-17

### Fixed

- **Overly Loose Co-Authorship Matching**: A commit could be attributed to the user from a substring match against an email or name, or from a `Co-authored-by:` trailer that merely mentioned the username anywhere in the message — false-flagging PRs the user only reviewed or commented on as co-authored. Commit authorship is now resolved by one strict matcher shared by the historical crawler and the Active Workbench: a GitHub-resolved account, an unambiguous `noreply` email, or an actual `Co-authored-by:` trailer line. Merge commits no longer count as authorship.
- **Self-Healing Gap for Merged PRs**: A co-authored PR wrongly flagged before this fix could never be corrected once it merged or closed — the only re-verification path, the Active Workbench, re-examines exclusively PRs that are still open. The historical crawler's own fresh, per-run commit check is now used to prune a stale co-authored entry regardless of the PR's current state.

## [2.12.0] - 2026-07-13

### Fixed

- **Contribution Total Double-Count**: The quarterly grouper mutated the shared contributions object while injecting 403 "ghost rows," double-counting them into the headline total (2754 instead of the correct 2744). Ghost rows are now built into the grouped output only, and skipped if the same URL is already a categorized row.
- **Stale PRs on the Active Workbench**: Unverifiable (403) co-authored PRs were kept on the Active Workbench indefinitely instead of being dropped once their commit history couldn't be verified, so dormant, years-old PRs never left the "current tasks" view.
- **Misdated 403 Ghost Rows**: Workbench-discovered 403s were timestamped with the run time instead of the PR's own `updated_at`, scattering historical PRs into whatever quarter the daily run happened to land in.

### Changed

- **Independent Retry Budgets**: `withRateLimitRetry` now retries transient network failures (`ECONNRESET`, `ETIMEDOUT`, and similar) on their own retry budget, separate from the rate-limit retry budget, so a call that already spent its rate-limit retries doesn't abort on the first unrelated socket reset.
- **Connection Resilience**: Added a shared keep-alive `https.Agent` with a capped socket count, reused across both fetchers, to cut TLS handshake overhead and prevent connection-reset storms under concurrent load.
- **Reduced Fan-Out Concurrency**: Lowered the workbench's `PR_CONCURRENCY` from 6 to 3 to stay well under GitHub's secondary rate limit / abuse-detection threshold.
- **Leaner Search Pacing**: Removed the blanket pre-search delay in favor of pacing only between pages of a single query, cutting several minutes of fixed waiting from a full resync.

## [2.11.0] - 2026-07-12

### Added

- **GitHub Pages Deployment**: Added `deploy-gh-pages.yml`, an optional workflow that publishes `contributions/html-generated/` to GitHub Pages after `Update Contributions` completes (or via manual `workflow_dispatch`).
- **Dependabot**: Added `.github/dependabot.yml` to track `npm` and `github-actions` dependency updates.
- **Rate-Limit Retry Classification**: Confirmed rate limits now back off and retry (honoring `retry-after`/quota headers); a non-rate-limit 403 (e.g. an org requiring SSO authorization) gets one quick retry before being treated as permanent, instead of burning a full backoff ladder on something that can't succeed. Transient 502/503/504s are retried too.
- **Permanent-Failure Tracking**: PRs confirming a non-rate-limit 403 are recorded in `failed-fetch.json` and skipped on future daily runs, while still being counted and listed as real contributions.
- **Crash-Safe Persistence**: All caches are written in a `finally` block so a failed run doesn't waste API calls it already made; a capped retry wrapper was also added at the GitHub Actions workflow level.
- **`FULL_RESYNC` Mode / `npm run resync`**: Re-verifies full history against live GitHub data without deleting `all-contributions.json` first, so a Search API miss on one run can still fall back to the last verified baseline.
- **Manual Full Sync Trigger**: Added a `full_sync` input to `workflow_dispatch`, so a full sync can be triggered from the Actions UI instead of only on the monthly schedule.

### Changed

- **Simplified Push Logic**: Removed the `main`-vs-`live` branch split in `update-contributions.yml` that force-pushed to a separate branch for Netlify; every repo now pushes directly to `main`.
- **Batched, Deduped Requests**: Deduped redundant review fetches and batched ongoing-workbench PR processing with bounded concurrency instead of one PR at a time, cutting daily run time significantly.
- **Total Contributions Accuracy**: The all-time total now includes confirmed-403 PRs (real contributions that couldn't be fully categorized), each counted exactly once.

### Fixed

- **Stale GitHub Pages Deploys**: The deploy workflow checked out the commit that was HEAD before "Update Contributions" ran, not the commit it actually pushed, so the live site always lagged one run behind. Now checks out `main` directly.

### Removed

- **Netlify Configuration**: Removed `netlify.toml` now that Netlify is no longer the deploy target.

## [2.10.0] - 2026-06-27

### Added

- **"Last Interaction" Column**: The Active Workbench tables now display the GitHub username of the individual who last acted on a task, highlighting who triggered a status requiring attention or who advanced a discussion. For approved pull requests, the column displays the specific approver.
- **Bot Allowlist**: Added a new file, `contents/allowed-bot.js`, to list specific bots for treatment as if they were real contributors instead. This feature is disabled by default, ensuring portfolio project configurations remain unaffected unless bots are explicitly added to this list.

## [2.9.0] - 2026-06-26

### Added

- **Class-Based Dark Theme**: Implemented a comprehensive, class-based dark mode (utilizing Tailwind `@custom-variant`) across all generated views, including the landing page, blog, glossary, community pages, and quarterly reports.
- **Unified Theme Switcher**: Integrated a global navbar dropdown menu supporting manual selection (Light / Dark) and real-time operating system preference synchronization (System).
- **FOUC Prevention Script**: Embedded an inline, flash-safe bootstrap script to completely eliminate the Flash of Unthemed Content (FOUC) during initial page load.
- **Centralized Design Token Layer**: Introduced a unified CSS-variable architecture (`:root` and `html.dark`) that maps all core components—including the navbar, footer, all six page generators, and workbench status elements—to automatically resolve themes without requiring per-call-site updates.
- **Programmatic Accessibility & Contrast Engine**: Implemented a brand-agnostic color system that dynamically derives dark-mode typography and accent colors via HSL adjustments. Colors are validated against live WCAG AA contrast ratios (`ensureReadableOn`), ensuring custom brand forks stay automatically accessible.
- **Dark Mode Layout Optimizations**: Designed a dark-theme visual hierarchy with high-contrast active workbench row dividers, clear structural card borders, normalized text saturation to eliminate eye strain, and robust color token fallbacks for critical asset states like the "Draft" status badge.

## [2.8.3] - 2026-05-22

### Fixed

- **Inline Review Tracking**: Resolved a metadata calculation bug where nested inline review replies were omitted, ensuring the definitive latest actor and activity date are accurately tracked.
- **CSS Syntax and Compilation Errors**: Eliminated strict compilation validation errors on search inputs by stripping invalid inline pseudo-class selectors and introducing native focus state blocks.
- **Workbench Component Styling**: Corrected status text and indicator dot color rendering in generated columns via dynamic fallback checks, and refined the left-padding utility to maintain proper cell alignment for approved states.

## [2.8.2] - 2026-05-15

### Fixed

- **Persona Metric Synchronization**: Fixed a layout conflict in the landing page dashboard metrics chart where mathematically tied maximum data values triggered highlight styles across multiple rows simultaneously. Row-level background fills, brand typography states, and track opacities are now deterministically synchronized with the single priority-assigned collaboration persona key.

## [2.8.1] - 2026-05-15

### Fixed

- **Co-Authored and Reviewed PR Separation**: Updated the loop evaluating user contributions to treat co-authored commit checks and review status checks as independent tracking paths. A PR can now correctly appear in both categories if both criteria match, and it will only fall back to Collaborations if neither is met.
- **Pre-Creation Commit Filtering**: Fixed an issue where pulling down a PR targeted at a non-default base branch inherited old historical commits from previous years. Added strict date matching against the creation date of the PR (`prCreatedAt`) to prevent stale commits from forcing incorrect quarterly placement or causing negative timeline calculations.

## [2.8.0] - 2026-05-14

### Added

- **Graceful Degradation for Rate Limits**: Introduced a robust system to capture and display contribution data when GitHub API secondary rate limits (403 Forbidden) are triggered.
    - **Persistent Failure Tracking**: Implemented `logPermanent403` to save metadata of throttled items into `data/failed-fetch.json`.
    - **Ghost Row Injection**: Updated grouper logic to reconstruct and append inaccessible items to the Collaborations category using logged titles and timestamps.
- **Visual Data Status Indicators**:
    - **RECORDED Badge**: Added a gray status badge and "Basic Info Only" label for rate-limited or archived repository data.
    - **Inaccessibility Cues**: Applied `opacity-75` styling to table rows missing full metadata to provide clear visual feedback for partial data.
- **Strict Repository Filtering**: Implemented a high-priority check to identify and exclude Private Repositories early in the data acquisition loop.

### Changed

- **Refined Bot Categorization**: Updated logic to filter bot-authored PRs. Contributions are now only categorized under Collaborations if a manual comment exists or if the PR includes human reviews, maintaining a distinction between human-led and automated workflows.
- **URL Transformation**: Implemented logic to convert GitHub API endpoints back into standard user-facing repository and PR URLs for logged failures.
- **Enhanced Merge Logic**: Updated date handling to fallback to `closedAt` if `mergedAt` is missing, ensuring accurate chronological placement and "RECORDED" badge assignment for inaccessible items.
- **Failover Efficiency**: 
    - Updated fetch helpers to fail silently after logging, preventing script crashes during high-volume API requests.
    - Introduced a `logState` object to prevent redundant log writes for the same rate-limited item.

## [2.7.0] - 2026-05-09

### Added

- **Domain-Specific Fetchers**: Created `scripts/api/fetch-historical-contributions.js` and `scripts/api/fetch-ongoing-workbench.js` to handle specialized data retrieval for long-term history and active tasks respectively.
- **Centralized GitHub Utilities**: Established `scripts/utils/github-helpers.js` to house shared pure functions, ensuring consistent logic for date parsing, activity metadata, and contribution year discovery.

### Changed

- **Architectural Refactor (DRY)**: Centralized shared `axios` instances and search pagination logic (`searchAll` and `getAllPages`) to reduce code duplication across the API layer.
- **Standardized API Handling**: Implemented uniform rate-limit management and "Next" link navigation within the new modular scripts.

### Removed

- **Monolithic Fetcher**: Deleted `github-api-fetchers.js` as its responsibilities were migrated to the new domain-focused architecture.

## [2.6.1] - 2026-05-08

### Fixed

- **Quarterly Report Rendering**: Resolved a critical regression where closed or merged PRs were missing from the generated UI. Implemented an **Explicit Data Contract** in the grouper to ensure all contribution categories initialize as empty arrays `[]` rather than `undefined`, preventing generator crashes during the build process.
- **Date Attribution Logic**: Fixed a bug where contributions with missing `date` properties were excluded from reports. Introduced a tiered fallback system that checks `mergedAt`, `closedAt`, `firstCommitDate`, and `myFirstReviewDate` before defaulting to `createdAt`.

### Changed

- **Defensive Generator Architecture**: Updated the HTML generator with "redundant-but-safe" iteration logic (`data[section] || []`) to ensure structural stability even if the data source deviates from the expected shape.
- **Reporting Accuracy**: Refined the contribution breakdown logic to ensure "0" counts are explicitly rendered in statistics cards for inactive categories, maintaining a consistent visual layout across all quarterly files.

## [2.6.0] - 2026-05-07

### Added

- **Interactive Table Sorting**: Introduced client-side sorting for the Workbench dashboard.
    - **Status Priority Sort**: Implements a three-state toggle to sort tasks by urgency (Take Action > Watching > Waiting > Stale > Approved), with a secondary date-based sort for stale items.
    - **Alphabetical Repository Sort**: Added the ability to sort the Workbench by repository name (A-Z / Z-A).
- **Visual Sort Indicators**: Integrated dynamic UI icons (↕, ▲, ▼) and header highlighting to indicate active sort states and directions.

### Changed

- **Glossary Refinement**: Updated the `activeWorkbench` definitions to provide better distinction between work types.
    - Added **Ongoing PRs**: Specifically defined as self-authored PRs.
    - Added **Moving co-authored PRs forward**: Defined as collaborative contributions made alongside other authors.
- **Table Data Architecture**: Modified the HTML generator to include `data-repo` and `data-status` attributes, enabling faster and more reliable client-side sorting without DOM scraping.

## [2.5.2] - 2026-05-01

### Fixed

- **Workbench Identity Mapping**: Resolved an issue where missing `lastActor` data caused PRs to incorrectly default to "Watching" by implementing a fallback to `task.user.login`. Added strict string normalization to prevent identity mismatches.

### Changed

- **Context-Aware Status Logic**: Refactored Ball Tracking to differentiate between **Reviewer** and **Owner** roles, ensuring the "Take Action" status triggers correctly based on the specific interaction context.
- **Generator Parity**: Synchronized the status tracking logic between the HTML dashboard and the Markdown generator for a consistent cross-platform experience.

## [2.5.1] - 2026-05-01

### Fixed

- **Persona Calculation Mapping**: Resolved a bug in the landing page generator where the **Collaboration Profile** incorrectly defaulted to "Community Mentor." Added missing data keys to the persona categories to ensure that contribution counts for Issues, Merged PRs, and Reviews are accurately compared.

## [2.5.0] - 2026-04-30

### Added

- **Ball Tracking Logic**: Introduced a sophisticated status system for ongoing tasks to identify responsibility. Added badges for **TAKE ACTION** (response required), **WAITING** (awaiting PR author or maintainer), **WATCHING** (monitoring discussions or progress), **APPROVED** (ready for merge), and **STALE** (no substantive activity for 21 days).
- **Substantive Activity Filtering**: Implemented a "noise-filtering" activity clock that only resets on new commits, code reviews (human or bot), or discussion comments, explicitly ignoring metadata changes like labels or pings.
- **Idle Detection**: Add stale/idle timer to utilize the new **Last Substantive Date** logic. Tasks display a day count since the last meaningful contribution instead of the raw GitHub update timestamp.
- **Hybrid Review Logic**: Integrated bot reviews (e.g., copilot reviews) into the activity calculation, ensuring they are recognized as substantive events that reset the activity clock.
- **Enhanced Glossary Reference**: - **Glossary Expansion**: Expanded the **Community & Leadership** section with detailed definitions for Workbench categories, Ball Tracking states, and the specific logic governing activity timers.

## [2.4.2] - 2026-04-29

### Added

- **Linked Issue Deduplication**: Implemented logic to parse PR descriptions for "closes/fixes" keywords. Issues linked to open PRs are now automatically removed from the "To do issues" section to prevent redundancy in the Workbench.
- **Priority-Based Sorting**: Reorganized the Active Workbench layout to prioritize "To-do" tasks (Issues and Manual Reviews) at the top, followed by "Ongoing" work and "Bot" requests.

### Changed

- **Transitioned to Issues API**: Switched authored PR fetching to the direct `/issues` endpoint to ensure Draft PRs and unindexed external contributions are accurately captured.
- **Human-Centric Review Logic**: Updated review tracking to only move tasks to "Review in progress" if a human maintainer (not a bot or the author) has interacted with the PR.
- **Refined Commit Attribution**: Updated attribution logic to ignore `web-flow` commits, ensuring Web UI suggestions or edits do not incorrectly trigger "Co-authored" status.
- **Dynamic Brand Alignment**: Refactored Workbench headers and labels to utilize centralized brand colors (`COLORS.primary`) instead of static CSS values.

### Fixed

- **Review Deduplication**: Implemented a priority check to ensure "Review in progress" takes precedence over "Request review" if both statuses are returned by the GitHub API.
- **Execution Order**: Adjusted the main data orchestration sequence to ensure PR data is available before processing issue exclusions.

## [2.4.1] - 2026-04-28

### Changed

- **Status Badges**: Replaced previous "dot and text" indicators with high-visibility, border-rounded pill badges for **Draft**, **Pending Merge**, and **Blocked** states.
- **Optimized Table Layout**: Removed conditional row-level background colors to create a more professional and unified dashboard, focusing attention on the task data.
- **Visual Hierarchy Refinement**: Applied subtle opacity to badge borders and standardized typography to ensure legibility when managing high volumes of tasks.

## [2.4.0] - 2026-04-23

### Added

- **Co-authored PR Tracking**: Introduced logic to detect and display ongoing PRs in external repositories where the user is a co-author, ensuring collaborative contributions are visible.
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

- **Authored PR Tracking**: Introduced `fetchOngoingAuthoredPrs` to monitor open PRs authored by the user in external repositories.
- **Workbench UI Hierarchy**: Implemented a new layout for the Active Workbench, positioning status indicators under the repository name.
- **Draft Support**: Added logic to `fetchOngoingReviews` and authored PRs to detect and display "Draft" status.
- **Pending Merge Status**: Added logic to detect and display "Pending Merge" status for approved PRs with the specific `pending-pr-merge` label.
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