# Curated Open Source Portfolio

This repository serves as a portfolio of my open source contributions. You can check out the contributions log in the [contributions folder](./contributions) to see my work.

My goal in creating this log is to maintain a detailed and organized record of my work, containing pull requests (PRs), bug reports, and general collaborations. It's a way for me to track my journey and share my contributions with the community.

The content in this repository is generated automatically using a GitHub Action. I plan to add more details and functions in the future.

If you're interested to learn about the motivation and development process for this project, see my full write-up: [How I Built a Curated, Automated Open Source Portfolio](https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0)

---

## 💡 How It Works

This project is powered by a **Node.js script** and a **GitHub Actions workflow** that automatically fetches, processes, and presents GitHub activity.

### The Brain: The Automation Script

The project's automation logic is highly modular, separating concerns into six specialized files:

| File | Responsibility | 
| ----- | ----- | 
| **`config.js`** | Holds all core configuration, including `GITHUB_USERNAME`, `SINCE_YEAR`, and output paths. | 
| **`github-api-fetchers.js`** | Handles all external communication with the GitHub REST API (v3) to fetch raw contribution data. | 
| **`contributions-groupers.js`** | Contains the logic for filtering, deduplicating, and assigning fetched items to the correct quarterly buckets. | 
| **`contribution-formatters.js`** | Manages the data formatting for display, including date formatting (`YYYY-MM-DD`), period calculation (`"X days"`), and status string generation. | 
| **`quarterly-reports-generator.js`** | Creates the detailed Markdown files for each quarter (e.g., `2024/Q1-2024.md`). | 
| **`contributions-readme-generator.js`** | Generates the `README.md` file in the `contributions` folder, providing high-level statistics and summaries. |

The core logic is designed to track and categorize activity **outside of the owner's own repositories**. The script performs the following key functions:

1.  **Smart Syncing:** The script checks the date of the last successful run. If the data is current, it performs a fast **incremental update**, only fetching new activity from the last year or so. If the data is old (e.g., on a monthly schedule), it performs a **full sync** to ensure no contribution is missed.
2.  **Comprehensive Data Retrieval:** It uses the GitHub API to search for and collect four distinct types of community activity:
    
    - **Merged PRs:** PRs in other projects that were authored by the user that were successfully merged.
    - **Issues:** Bugs and feature requests reported by the user in other projects.
    - **Reviewed PRs:** PRs from others where the user provided a review, merge, or close action.
    - **Co-authored PRs:** PRs where the user was not the primary author, but contributed one or more commits (including those marked via the `Co-authored-by:` trailer).
    - **Collaborations:** Issues or PRs where the user participated by commenting for discussion, without directly reviewing.
3.  **Data Processing & Reporting:** It deduplicates all items, resolves the latest status for contributions, and groups the final results into detailed, **quarterly Markdown reports**. Each report includes statistics like the total contribution count and the top-contributed repositories.
4.  **Caching:**

    - `pr-cache.json`: A secure cache of **processed PR URLs** is maintained to dramatically speed up future runs. This cache is used to quickly identify and skip PRs that have already been processed, or those that are known to be non-contributions (e.g., from private repositories or bot accounts), preventing repeated top-level fetches.
    - `commit-cache.json`: A secure cache of the **processed first commit date and total commit count** on a PR. Since fetching all commits for a PR can be resource-intensive, this cache ensures the script avoids repeatedly fetching and processing potentially hundreds of individual commits to determine co-authorship.

### The Automation: GitHub Action Workflow

The workflow file in the `.github/workflows` folder defines the two primary automation schedules:

| Event | Schedule | Sync Type | Purpose |
| :--- | :--- | :--- | :--- |
| **Monthly Sync** | The 1st of every month | **Full Sync** | Guarantees all data since the initial start year is periodically verified and up-to-date. The run *removes* the old cache to force a fresh fetch. |
| **Daily Update** | Once every day | **Incremental** | Provides a fast, light update to capture any activity from the last 24 hours, ensuring the portfolio is always current. |

The workflow handles checking out the code, running the Node.js script with the necessary **`GITHUB_TOKEN`** secret, and then automatically committing the newly generated or updated Markdown and JSON files back to the repository.

---

## 🛠️ Quick Start Guide

You can adapt this project to showcase your personal GitHub contributions without needing to build the automation from scratch.

Fork this repository and follow the configuration steps below to get your own contribution log running.

### Prerequisites

1.  Clone the forked repository to your local machine.
2.  Ensure [Node.js](https://nodejs.org/en) is installed.
3.  Install dependencies by running the following command:

    ```bash
    npm ci
    ```

### 1. Initial Setup

**Before running the script for the first time**, you must delete any existing contribution data so the script can start fresh with your username.

```bash
# Delete the existing contribution logs and cache
rm -rf data
rm -rf contributions
```

**Note:** The `data` and `contributions` folders contain the JSON files that hold the contribution history from the previous user. Deleting it ensures your portfolio starts clean.

### 2. Update Configuration

Open the configuration file (`scripts/config.js`) and edit the following lines to match your desired data:

```javascript
// scripts/config.js

// Change this to your GitHub handle
const GITHUB_USERNAME = "adiati98" 
// Change this to the earliest year you want to track
const SINCE_YEAR = 2019
// ...
```

### 3. Running Locally (via `npm start`)

To test the script or generate files on your local machine, you'll need a Personal access token (PAT) with read access to public repositories.

1. **Get a Personal access token (PAT)**

   - Go to your GitHub and click your avatar on the top right.
   
   - Navigate to **Settings > Developer settings > Personal access tokens > Tokens (classic)**.
   
   - Generate a new token. This token only needs the `public_repo` scope.

2. **Create `.env` file**

   In the root directory of your project, create a file named `.env` and add your token:

   ```bash
   # .env
   GITHUB_TOKEN=YOUR_PERSONAL_ACCESS_TOKEN
   ```

3. **Run the script**

   In your terminal, run the following command:

   ```bash
   npm start
   ```

### 4. Set up for GitHub Actions (Automated Runs)

For automated runs in a forked repository, you must first explicitly enable GitHub Actions because they are disabled by default for security.

1. **Enable Workflows:**

   - Navigate to the "Actions" tab in your forked repository.

   - You will see a banner or message stating that workflows are disabled.

   - Click the button or link to "I understand my workflows, go ahead and enable them." This enables the scheduled runs.

2. **Run the Action Manually:**

   - With workflows enabled, the `Update Contributions` workflow will be active.

   - Select the workflow and click "Run workflow" (using the manual trigger) to execute the first full run immediately.

   You can read the [GitHub official docs to run a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The workflow uses the repository's built-in `GITHUB_TOKEN` for authentication. Once the manual run is complete, the daily and monthly schedules will take over automatically. If you need to test something, you can always run the script locally or run the workflow manually.
