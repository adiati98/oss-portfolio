# Curated Open Source Portfolio

This repository serves as a portfolio of my open source contributions. You can check out the [Contribution Log](./contributions/markdown-generated/README.md) to see my work.

> [!TIP]
> **Want to build your own?** I created this system to be reusable. If you want to generate a similar portfolio for your own GitHub activity, please use the [**Curated OSS Portfolio Template**](https://github.com/adiati98/oss-portfolio-template) for a clean, standard setup.

I created this log to maintain a detailed and organized record of my journey, including Pull Requests (PRs), bug reports, and general collaborations. 

The content in this repository updates automatically via a Node.js script and a GitHub Actions workflow.

If you want to learn about the motivation and development process for this project, read my full write-ups:

- [How I Built a Curated, Automated Open Source Portfolio](https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0)
- [The Curated, Automated Open Source Portfolio: How It’s Going](https://dev.to/adiatiayu/the-curated-automated-open-source-portfolio-how-its-going-5f98)

---

## 💡 How It Works

This project uses **GitHub Actions** as an automated engine to run a custom **Node.js** processing pipeline. This ensures the portfolio stays current without any manual intervention.

### 🤖 The Automation: GitHub Actions

The workflow file in `.github/workflows/` orchestrates the entire process. It handles environment setup, authentication, and the final commit of updated data back to the repository.

| Event | Schedule | Sync Type | Automation Purpose |
| :--- | :--- | :--- | :--- |
| **Daily Update** | Once per day | **Incremental** | Captures activity from the last 24 hours to keep the portfolio current. |
| **Monthly Sync** | 1st of every month | **Full Sync** | Rechecks the entire history against GitHub, while keeping existing records safe. |

### 🧠 The Brain: The Node.js Script

When the GitHub Action triggers the runner, the script executes a multi-stage pipeline:

#### 1. Data Fetching & Processing

- **GitHub API (v3):** The script communicates with the GitHub REST API to collect activity: **Merged Pull Requests (PRs), Issues, Reviewed PRs, Co-authored PRs, and Collaborations**.
- **Active Workbench:** Tracks ongoing maintenance tasks and open reviews. It intelligently categorizes tasks into dedicated tables, separating human-centric contributions from automated bot activity (e.g., Dependabot, Snyk) to streamline workflow visibility, and shows the GitHub username of the relevant person in the "Last Interaction" column — the last actor whenever a task needs attention ("Take Action") or is awaiting someone else ("Watching"), or the reviewer who approved it ("Approved"). Additionally, it supports dynamic repository exclusions (`contents/repo-exclusions.js`) and a per-bot allowlist (`contents/allowed-bot.js`) to filter out specified organizations/projects or let trusted bots be treated as the last actor.
- **Personal Technical Writing:**
    - **Automated Sync:** Fetches latest articles from **Dev.to** via their API.
    - **Curated Content:** Integrates long-form technical guides authored for freeCodeCamp, managed through manual metadata in `contents/fcc-articles.js`.
- **Smart Syncing:** Automatically determines the fetch range (Current Year vs. Historical) based on the `last-modified` timestamp of the local data.
- **Hierarchical Caching:** Maintains `pr-cache.json`, `commit-cache.json`, and `workbench-activity-cache.json` to optimize performance, preserve commit history, and respect GitHub API rate limits.

#### 2. Output Generation

The script transforms raw JSON data into a suite of high-fidelity reports:

- **Quarterly & All-Time Stats:** Detailed logs and interactive dashboards built with Tailwind CSS.
- **Authored Technical Blog:** A dedicated showcase of technical writing, documentation, and Open Source Software (OSS) articles.
- **Journey:** Your roles and expertise, followed by your selected work on a single timeline — awards, courses, projects, documentation, talks, and videos. Your best entries are shown first, and the rest are behind a "Show more" button.
- **Active Workbench:** Live tasks and open reviews, organized by what happens next.
- **Markdown Ecosystem:** Generates a summary `README.md` and quarterly reports for native GitHub viewing.

#### 3. Collaboration Profiles

The system analyzes contribution patterns to automatically assign a persona title. This helps viewers quickly understand the primary impact style within the open source ecosystem.

| Priority | Persona Title | Focus |
| :--- | :--- | :--- |
| 1 | **Community Mentor** | Code review and technical guidance. |
| 2 | **Core Contributor** | Feature development and bug fixing. |
| 3 | **Project Architect** | Problem identification and feature planning. |
| 4 | **Collaborative Partner** | Pair programming and co-authoring code. |
| 5 | **Ecosystem Partner** | Technical discussion and community engagement. |

---

## 🛠️ Local Development

> [!NOTE]
> **Want to use this for your own portfolio?** These instructions cover the manual configuration for this specific repository, which includes personal customizations like blog post integration. To set up a portfolio focused on the core reporting features (All-Time Stats and Quarterly Contribution Reports), please use the [**Curated OSS Portfolio Template**](https://github.com/adiati98/oss-portfolio-template) for a clean setup.

### 1. Prerequisites

- [Node.js](https://nodejs.org/en) installed.
- Install dependencies: `npm ci`
- **GitHub Personal Access Token (PAT):**
  - **Create the Token:** Go to [Personal Access Tokens (Classic)](https://github.com/settings/tokens) and generate a token with the `public_repo` scope. This identity is required for both local runs and the GitHub Action to ensure standalone PRs and external contributions are correctly fetched.
  - **Setup Locally:** Create a `.env` file in the root directory and add: `GITHUB_TOKEN=your_pat_token_here`.
  - **Setup for GitHub Actions:**
    1. In your repository, go to **Settings > Secrets and variables > Actions**.
    2. Click **New repository secret**.
    3. Name it `GH_PAT` and paste your token as the value.
    4. Ensure your workflow `.yml` file maps this secret: `GITHUB_TOKEN: ${{ secrets.GH_PAT }}`.

### 2. Execution Commands

Once configured, use the following commands to manage and generate your portfolio data:

1. **Install the dependencies**

   ```bash
   npm ci
   ```
2. **Perform a clean sync**

   Run the following command to wipe the local cache and stored data for a fresh start:

   ```bash
   npm run clean
   ```
3. **Generate your portfolio**

   Run this to fetch data and generate your open source contribution reports:

   ```bash
   npm start
   ```

> [!TIP]
> Once your initial setup (`npm start`) has finished, you can run `npm run resync` any time to force a full re-verification of your history against GitHub, without wiping your saved data.

### 3. Configuration

Manual data and preferences are managed within the `scripts/config/` and `contents/` directories:

- **Settings:** Update `scripts/config/config.js` to personalize data fetching:
    - `GITHUB_USERNAME`: Set this to your GitHub handle.
    - `BLOG`: Configure your `devToUser` handle for automated article syncing.
    - `PROFILE`: Set the `name` and `tagline` displayed on the Home page hero. The last word of `name` is shown in your brand colors, for example, "Ayu Adiati" shows "Adiati" in the accent color. Leave `name` empty to fall back to `@GITHUB_USERNAME`. Set `linkedIn` to show a "Get in touch" link at the bottom of every page, or leave it empty to leave the link out.
- **Roles:** Update `contents/leadership.js` with the positions listed under "Experience & roles" on the Journey page.
- **Expertise & Skills:** Update `contents/skills.js` with the areas you specialize in, plus the tools and skills shown on the Journey page. Anything you list under `highlight` is shown in your brand color so it stands out — keep that to the two or three things you most want people to notice.
- **Milestones:** Your work is split across six files, one for each kind of thing. They all appear together on the Journey page. Which file you put an entry in decides the label it gets, so you never have to write the label yourself:

    | Put it in this file | It appears with this label |
    | :--- | :--- |
    | `contents/awards.js` | 🏆 Award |
    | `contents/courses.js` | 🎓 Course |
    | `contents/projects.js` | 🛠 Project |
    | `contents/docs.js` | 📚 Docs |
    | `contents/talks.js` | 🎤 Talk |
    | `contents/videos.js` | 🎥 Video |

    Awards, courses, projects, and docs all use the same information: `title`, `org` (the organization it was for), `year`, `url` (where someone can go and see it), and `description`. Talks and videos work the same way with two different names — `event` instead of `org`, and `blurb` instead of `description` — plus an optional `length` for how long it runs.

    Two more are available in every file:

    - `yearEnd` — use this when something ran across several years. Write a year, or `'present'` if it is still going. It then shows as a range, like `2021–2025`. Entries are ordered by the most recent year you worked on them, so anything still going stays near the top.
    - `highlight: true` — marks an entry as one of your strongest. Those are the ones people see as soon as they open the page, and everything else waits behind a "Show more" button. Five to eight works well, which is roughly one screen's worth. If you do not mark any, the five most recent are shown instead.

    To add a new kind of work, create the file and add one line to `MILESTONE_SOURCES` in `scripts/services/milestones-model.js`.
- **Article Metadata:** Update `contents/fcc-articles.js` to add new freeCodeCamp publications.
- **Repo Exclusions:** Update `contents/repo-exclusions.js` to filter out specific organizations or repositories from the Active Workbench.
- **Bot Allowlist:** The Active Workbench excludes bots (e.g., Dependabot, Snyk) from being treated as a "last actor" by default. If you rely on a bot that leaves actionable comments or reviews (e.g., an AI review bot), list its username in the `allowedBot` array in `contents/allowed-bot.js` to have it show up as the last actor (driving "Take Action" / "Watching" status and the "Last Interaction" column) instead of being grouped under bot activity.
- **Colors:** Update `scripts/config/theme.js` to give the whole site your own brand colors. It is the only file you need to touch. You choose five colors, and every other shade on the site — hover states, backgrounds, borders, and the entire dark mode — is worked out from them for you:

    | Setting | Where you see it |
    | :--- | :--- |
    | `brand` | Your main color: the navigation bar, links, the Journey timeline, and outlines around whatever you have selected |
    | `positive` | Work that was merged or approved, and roles you currently hold |
    | `caution` | Things waiting on you, and reviews that are getting old |
    | `critical` | Work that is blocked, and anything that failed |
    | `neutral` | The grays: quieter text, thin dividing lines, and items that have gone stale |

    You can also set `accent`, `surface`, and `ink` in the same file, but you do not have to. Leave them out and they are worked out from the five above.

    If one of your colors would make text too hard to read against its background, the site refuses to build and tells you which color caused it, so you cannot accidentally publish a page people cannot read.

    To check your colors without waiting for a full run, use:

    ```bash
    node -e "require('./scripts/config/theme-engine.js')"
    ```

    No output means your colors are fine. Otherwise you get the color that caused the problem, how readable it currently is against the target, and which way to adjust it:

    ```
    [theme] WCAG gate failed — the configured seeds cannot produce readable derivatives:
      light on-brand/brand fill: #281B1B on #E5484D = 4.25:1 (needs 4.5:1)
    Fix: darken (light theme) or let the engine lighten (dark theme) the named seed
    in scripts/config/theme.js. Mid-lightness, moderately saturated seeds derive best.
    ```

    That last line is the rule of thumb worth remembering when picking a color: very pale, very dark, or very vivid colors are the ones that tend to be rejected.

> [!TIP]
> You do not have to fill in every file in `contents/`, but each file does need to be there. If you have no freeCodeCamp articles, no talks or videos yet, no repositories to leave out, or no bots to allow, keep the file and leave it empty like this: `module.exports = [];`. That goes for all six files listed above as well as `contents/fcc-articles.js`, `contents/repo-exclusions.js`, and `contents/allowed-bot.js`. An empty file simply adds nothing to your page.

### 4. Deployment

This project is host-agnostic. Connect your repository to a service like Netlify, Vercel, or GitHub Pages to deploy your portfolio.

**Using GitHub Pages:** This repo ships a ready-to-use workflow, `.github/workflows/deploy-gh-pages.yml`, that publishes `contributions/html-generated/` after each content update. To use it:

1. Go to **Settings → Pages** in your repository and set **Source** to **GitHub Actions**.
2. That's it — the workflow deploys automatically whenever `Update Contributions` finishes (or run it manually via **Actions → Deploy to GitHub Pages → Run workflow**).

Prefer a different host? Just delete `deploy-gh-pages.yml` and connect your repo to Netlify, Vercel, etc. as usual.