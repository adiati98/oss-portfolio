# Curated Open Source Portfolio

This repository serves as a portfolio of my open source contributions. You can check out the contributions log in the [`contributions/markdown-generated` folder](./contributions/markdown-generated/) to see my work.

My goal in creating this log is to maintain a detailed and organized record of my work, containing pull requests (PRs), bug reports, and general collaborations. It's a way for me to track my journey and share my contributions with the community.

The content in this repository is generated automatically using a GitHub Action. I plan to add more details and functions in the future.

If you're interested to learn about the motivation and development process for this project, see my full write-up: [How I Built a Curated, Automated Open Source Portfolio](https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0)

---

## 💡 How It Works

This project is powered by a **Node.js script** and a **GitHub Actions workflow** that automatically fetches, processes, and presents GitHub activity.

### The Brain: The Automation Script

The project's script files are structured around a clear pipeline: fetching data, processing it, and then generating the output files.

#### 1. Data Fetching & Processing

This initial stage handles all external communication and data preparation:

- It uses the **GitHub REST API (v3)** to search for and collect five distinct types of community activity: **Merged PRs, Issues, Reviewed PRs, Co-authored PRs, and Collaborations**.

- **Smart Syncing:** The script performs either a fast incremental update (fetching only new activity) or a full sync to ensure no contribution is missed.

- **Data Processing:** It deduplicates all items, resolves the latest status for contributions, and groups the final results into detailed, quarterly buckets.

- **Caching:** Two caches (`pr-cache.json` and `commit-cache.json`) are maintained to dramatically speed up future runs by skipping already processed pull request data and co-author commit history.

#### 2. Output Generation (Markdown & HTML)

After processing, the script generates the reports in two formats to maximize usability:

- **Markdown Reports (Output to `contributions/markdown-generated`):**
  - **Quarterly Reports:** Detailed Markdown files are created for each quarter (e.g., `2024/Q1-2024.md`), including statistics like total contribution count and top-contributed repositories.

  - **Contributions README:** A summary `README.md` is generated for high-level statistics and easy viewing on GitHub.

- **HTML Reports (Output to `contributions/html-generated`):**
  - The same data is now used to generate styled HTML files for both quarterly reports and the summary view.

  - The HTML is styled using **Tailwind CSS CDN**, making it ready for publication as a static website on platforms like [Netlify](https://docs.netlify.com/), [Vercel](https://vercel.com/home), [GitHub Pages](https://docs.github.com/en/pages), or any host of your choice. This allows for a more visual and navigable portfolio experience.

### The Automation: GitHub Action Workflow

The workflow file in the `.github/workflows` folder defines the two primary automation schedules:

| Event            | Schedule               | Sync Type       | Purpose                                                                                                                                           |
| :--------------- | :--------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Monthly Sync** | The 1st of every month | **Full Sync**   | Guarantees all data since the initial start year is periodically verified and up-to-date. The run _removes_ the old cache to force a fresh fetch. |
| **Daily Update** | Once every day         | **Incremental** | Provides a fast, light update to capture any activity from the last 24 hours, ensuring the portfolio is always current.                           |

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
const GITHUB_USERNAME = 'adiati98';
// Change this to the earliest year you want to track
const SINCE_YEAR = 2019;
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

---

## 🌐 Publishing the Static Website

The HTML files generated by the script are ready to be served as a static website.

- All static HTML reports are generated inside the `contributions/html-generated` directory.

- The main portfolio landing page is located at `contributions/html-generated/index.html`.

To publish your site on a static host, you need to configure the hosting service to use `contributions/html-generated` as the publish or base directory.

Please read your host's official documentation to learn how to configure and deploy the site.

---

## 🎨 Customizing Colors

The HTML reports use color-coded status badges and design elements that can be customized to match your personal branding.

### Where Colors Are Defined

All colors are centralized in `scripts/constants.js` in the `COLORS` object. This makes it easy to update your portfolio's visual style in one place.

### Default Color Scheme

The default color scheme includes:

| Element           | Color      | Usage                                     |
| :---------------- | :--------- | :---------------------------------------- |
| **OPEN** Status   | Green      | Issues and PRs that are still open        |
| **MERGED** Status | Purple     | Pull requests that have been merged       |
| **CLOSED** Status | Red        | Issues and PRs that have been closed      |
| **Primary**       | Indigo     | Headers, buttons, and primary UI elements |
| **Background**    | Gray/White | Card backgrounds and neutral areas        |
| **Accent**        | Various    | Section accents and highlights            |

### How to Customize Colors

1. Open `scripts/constants.js`.
2. Locate the `COLORS` object (typically near the top of the file).
3. Modify the hex color values to your preference.

Example:

```javascript
// scripts/constants.js

const COLORS = {
  primary: '#4f46e5', // Indigo - change to your favorite color
  gray: '#6b7280', // Gray - for neutral elements
  status: {
    open: '#10b981', // Green - for OPEN badges
    merged: '#8b5cf6', // Purple - for MERGED badges
    closed: '#ef4444', // Red - for CLOSED badges
    default: '#9ca3af', // Gray - for default/unknown status
  },
  // ... other color definitions
};
```

4. After making changes, run `npm start` locally to regenerate the HTML reports.
5. The new colors will be reflected in all generated reports.

### Color Customization Tips

- Use a **color picker tool** like [Tailwind Color Picker](https://www.tailwindcss.com/docs/customizing-colors) or [Coolors](https://coolors.co/) to find hex values for your desired colors.
- Ensure sufficient **contrast** between text and background colors for accessibility. Use [WebAIM](https://webaim.org/resources/contrastchecker/) to check color contrast.
- Test your color scheme in both light and dark viewing conditions if you're hosting the reports publicly.
- The status colors (open, merged, closed) help quickly identify the state of contributions, so choose distinct colors.
