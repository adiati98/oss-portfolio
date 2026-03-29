# Curated Open Source Portfolio

This repository serves as a portfolio of my open source contributions. You can check out the [Contribution Log](./contributions/markdown-generated/README.md) to see my work.

> [!TIP]
> **Want to build your own?** I created this system to be reusable. If you want to generate a similar portfolio for your own GitHub activity, please use the [**Curated OSS Portfolio Template**](https://github.com/adiati98/oss-portfolio-template) for a clean, standard setup.

I created this log to maintain a detailed and organized record of my journey, including Pull Requests (PRs), bug reports, and general collaborations. 

The content in this repository updates automatically via a Node.js script and a GitHub Actions workflow.

If you want to learn about the motivation and development process for this project, read my full write-up: [How I Built a Curated, Automated Open Source Portfolio](https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0).

---

## 💡 How It Works

This project uses **GitHub Actions** as an automated engine to run a custom **Node.js** processing pipeline. This ensures the portfolio stays current without any manual intervention.

### 🤖 The Automation: GitHub Actions

The workflow file in `.github/workflows/` orchestrates the entire process. It handles environment setup, security authentication via the `GITHUB_TOKEN`, and the final commit of updated data back to the repository.

| Event | Schedule | Sync Type | Automation Purpose |
| :--- | :--- | :--- | :--- |
| **Daily Update** | Once per day | **Incremental** | Captures activity from the last 24 hours to keep the portfolio current. |
| **Monthly Sync** | 1st of every month | **Full Sync** | Clears the cache and performs a deep-verify of all historical data. |

### 🧠 The Brain: The Node.js Script

When the GitHub Action triggers the runner, the script executes a multi-stage pipeline:

#### 1. Data Fetching & Processing

- **GitHub Application Programming Interface (API) (v3):** The script communicates with the GitHub Representational State Transfer (REST) API to collect activity: **Merged Pull Requests (PRs), Issues, Reviewed PRs, Co-authored PRs, and Collaborations**.
- **External Article Fetching:** (Personal Customization) Integrated fetching from **Dev.to** and **freeCodeCamp** to include technical writing metrics.
- **Smart Syncing:** The script automatically determines whether to perform a fast incremental update or a full historical sync.
- **Caching:** The script maintains `pr-cache.json` and `commit-cache.json` to optimize performance and respect GitHub API rate limits.

#### 2. Output Generation

- **Markdown Reports:** The script generates detailed quarterly logs and a summary `README.md` in `contributions/markdown-generated/`.
- **HTML Reports:** The script generates a Tailwind-styled landing page and interactive dashboards in `contributions/html-generated/`.

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
- A `.env` file containing a `GITHUB_TOKEN` with `public_repo` scope.

### 2. Common Commands

- **Clear data and cache:** `npm run clean`
- **Run script locally:** `npm start`

### 3. Configuration

- **Settings:** Update `scripts/config/config.js` for username or year changes.
- **Theming:** Update `COLOR_PALETTE` in `scripts/config/constants.js` to change the look of the generated HyperText Markup Language (HTML) reports.

### 4. Deployment

The GitHub Action automatically triggers a deployment to **Netlify** via a Build Hook after committing new data. Ensure the `NETLIFY_BUILD_HOOK` secret remains active in the repository settings.
