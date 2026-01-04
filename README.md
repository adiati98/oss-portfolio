# Curated Open Source Portfolio

This repository serves as a portfolio of my open source contributions. You can check out the contributions log in the [`contributions/markdown-generated` folder](./contributions/markdown-generated/) to see my work.

My goal in creating this log is to maintain a detailed and organized record of my work, containing pull requests (PRs), bug reports, and general collaborations. It's a way for me to track my journey and share my contributions with the community.

The content in this repository is generated automatically using a GitHub Action. I plan to add more details and functions in the future.

If you're interested to learn about the motivation and development process for this project, see my full write-up: [How I Built a Curated, Automated Open Source Portfolio](https://dev.to/adiatiayu/how-i-built-a-curated-automated-open-source-portfolio-18o0)

---

## 💡 How It Works

This project is powered by a **Node.js script** and a **GitHub Actions workflow** that automatically fetches, processes, and presents GitHub activity.

### The Brain: The Automation Script

The project's script files are structured around a clear pipeline: fetch data, process it, and generate output files.

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

  - **Contributions README:** A summary `README.md` is generated featuring visual progress bars and percentage breakdowns, providing an immediate snapshot of contribution distribution directly on GitHub.

- **HTML Reports (Output to `contributions/html-generated`):**
  - **Portfolio Landing Page (`index.html`):** The entry point of the website. it provides an overview of the report structure, explaining what each section (like Merged PRs or Reviewed PRs) represents.

  - **All-Time Impact Dashboard:** A lifetime summary view featuring the **[Collaboration Profile](#-collaboration-profiles)** and **Primary Focus Projects**. It uses a visual hierarchy to highlight the most significant areas of impact.

  - **Quarterly HTML Reports:** Detailed, interactive pages generated for every quarter. These allow for deeper inspection of specific contributions within a three-month window.

  - The HTML is styled using **Tailwind CSS CDN**, making it ready for publication as a static website on platforms like [Netlify](https://docs.netlify.com/), [Vercel](https://vercel.com/home), or any host of your choice. This allows for a more visual and navigable portfolio experience.

##### 👤 Collaboration Profiles

The "All-Time Impact" dashboard automatically assigns a profile based on the processed contribution data. This helps viewers quickly understand the primary impact style within the open source ecosystem.

If two contribution types have the same count, the system uses a priority ranking to determine the title:

| Priority | Persona Title | Focus |
| :--- | :--- | :--- |
| 1 | **Community Mentor** | Code review and technical guidance. |
| 2 | **Core Contributor** | Feature development and bug fixing. |
| 3 | **Project Architect** | Problem identification and feature planning. |
| 4 | **Collaborative Partner** | Pair programming and co-authoring code. |
| 5 | **Ecosystem Partner** | Technical discussion and community engagement. |

### The Automation: GitHub Action Workflow

The workflow file in the `.github/workflows` folder defines the two primary automation schedules:

| Event            | Schedule               | Sync Type       | Purpose                                                                                                                                           |
| :--------------- | :--------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Monthly Sync** | The 1st of every month | **Full Sync**   | Guarantees all data since the initial start year is periodically verified and up-to-date. The run _removes_ the old cache to force a fresh fetch. |
| **Daily Update** | Once per day         | **Incremental** | Provides a fast, lightweight update to capture any activity from the last 24 hours, ensuring the portfolio is always current.                           |

The workflow checks out the code, runs the Node.js script with the necessary **`GITHUB_TOKEN`** secret, and automatically commits the newly generated or updated Markdown and JSON files back to the repository.

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

Open the configuration file (`scripts/config/config.js`) and edit the following lines to match your desired data:

```javascript
// scripts/config/config.js

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

### 4. Configure Deployment Platform (Action Modification)

Before enabling the automated workflow, you need to adjust the deployment trigger for your hosting platform.

The default workflow is set up to automatically trigger a deployment to **Netlify** after new files are committed and pushed.

> [!IMPORTANT]
>
> If you're using Netlify, you must configure the `NETLIFY_BUILD_HOOK` as a repository secret in your GitHub settings, or the action will fail.
>
> Please refer to the official documentation below:
> - Netlify [Build hooks](https://docs.netlify.com/build/configure-builds/build-hooks/)
> - [Using secrets in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

If you're using a different hosting provider (like Vercel, AWS Amplify, etc.), you must modify or remove the deployment step in the GitHub Actions workflow file:

1. Open the workflow file: `.github/workflows/your-workflow-file.yml`.

2. Locate the final step named `Trigger Netlify Deployment`. This is the code block you're looking for:

   ```yaml
   - name: Trigger Netlify Deployment
     if: steps.commit.outputs.pushed == 'true'
     run: |
       echo "Content updated. Triggering Netlify deployment via Build Hook..."
       curl -s -X POST -d {} ${NETLIFY_BUILD_HOOK} -o /dev/null
     env:
       NETLIFY_BUILD_HOOK: ${{ secrets.NETLIFY_BUILD_HOOK }}
   ```

3. Choose one of the following options:

   - **Option A:** Remove the entire `Trigger Netlify Deployment` block if your host (like Vercel) automatically builds your site whenever new commits are pushed to the repository.

   - **Option B:** Replace the `run:` commands with your preferred host's specific API call, Build Hook URL, or deployment script to initiate the build.

### 5. Set up for GitHub Actions (Automated Runs)

For automated runs in a forked repository, you must first explicitly enable GitHub Actions because they are disabled by default for security.

1. **Enable Workflows:**
   - Navigate to the "Actions" tab in your forked repository.

   - You will see a banner or message stating that workflows are disabled.

   - Click the button or link to "I understand my workflows, go ahead and enable them." This enables the scheduled runs.

2. **Run the Action Manually:**
   - With workflows enabled, the `Update Contributions` workflow will be active.

   - Select the workflow and click "Run workflow" (using the manual trigger) to execute the first full run immediately.

   You can read the [GitHub official docs to run a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The workflow uses the repository's built-in `GITHUB_TOKEN` for authentication. Once the manual run is complete, the daily and monthly schedules will automatically take over. If you need to test something, you can always run the script locally or run the workflow manually.

---

## 🌐 Publishing the Static Website

The HTML files generated by the script are ready to be served as a static website.

- All static HTML reports are generated inside the `contributions/html-generated` directory.

- The main portfolio landing page is located at `contributions/html-generated/index.html`.

To publish your site on a static host, you need to configure the hosting service to use `contributions/html-generated` as the publish or base directory.

Please read your host's official documentation to learn how to configure and deploy the site.

---

## 🎨 Customizing Colors

You can change the look of your portfolio by updating the colors in one single file. The system automatically creates matching shades for backgrounds, borders, and even updates your browser tab icon (favicon) to match.

### How to Customize Colors

1. Open `scripts/config/constants.js`.
2. Find the `COLOR_PALETTE` object and replace the hex codes (e.g., `#4f46e5`) with your own.

   ```javascript
   // scripts/config/constants.js

   const COLOR_PALETTE = {
     primary: '#4338CA',    // Your main brand color
     primary900: '#312E81', // A darker version of your  primary color
     success: '#10b981',    // Color for Open items
     merged: '#8b5cf6',     // Color for Merged items
     error: '#ef4444',      // Color for Closed items
     // ... and text colors
   };
   ```

3. Run the script to see your new theme:

   ```bash
   npm start
   ```

### Color Customization Tips

- Use a **color picker tool** like [Coolors.co](https://coolors.co/), [Color Picker](https://www.color-picker.com/), or your browser's built-in color picker to find hex values.
- **Verify accessibility** using [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to ensure sufficient contrast:
  - Primary color with white text should pass WCAG AA (4.5:1) at a minimum
  - Status colors should maintain good contrast with light backgrounds
  - Text colors should have at least 4.5:1 contrast with the background
- Test your color scheme in both light and dark viewing conditions if you're hosting the reports publicly.
- The status colors (success, merged, error) help quickly identify the state of contributions, so choose distinct, recognizable colors.
