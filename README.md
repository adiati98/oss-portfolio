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

  - **Contributions README:** A summary `README.md` is generated featuring visual progress bars and percentage breakdowns, providing an immediate snapshot of contribution distribution directly on GitHub.

- **HTML Reports (Output to `contributions/html-generated`):**
  - The same data is now used to generate styled HTML files for both quarterly reports and the summary view.

  - The HTML Dashboard features responsive bar charts and calculated metrics to visualize the scale of contributions.

  - The HTML is styled using **Tailwind CSS CDN**, making it ready for publication as a static website on platforms like [Netlify](https://docs.netlify.com/), [Vercel](https://vercel.com/home), or any host of your choice. This allows for a more visual and navigable portfolio experience.

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

The HTML reports use color-coded status badges and design elements that can be customized to match your personal branding. Now with an improved system, you only need to change hex color values and all opacity variants are automatically generated!

### Where Colors Are Defined

All colors are centralized in `scripts/constants.js` in the `COLOR_PALETTE` object. This single location controls colors across:

- Navigation bar and mobile menu
- Page headers and footers
- Status badges (OPEN, MERGED, CLOSED)
- Table rows and backgrounds
- Links and text colors
- Section accents and borders
- Favicon

### Color Palette Breakdown

The `COLOR_PALETTE` includes 9 customizable colors:

| Color             | Purpose          | Default Hex | Used For                              |
| :---------------- | :--------------- | :---------- | :------------------------------------ |
| **primary**       | Main UI accent   | #4f46e5     | Headers, buttons, navigation, accents |
| **primary900**       | Dark UI accent   | #312E81     | Darker navigation background, dark accents |
| **neutral**       | Neutral elements | #6b7280     | Borders, neutral backgrounds          |
| **success**       | OPEN status      | #10b981     | Open issues/PRs badge                 |
| **merged**        | MERGED status    | #8b5cf6     | Merged PRs badge                      |
| **error**         | CLOSED status    | #ef4444     | Closed issues/PRs badge               |
| **textPrimary**   | Main text        | #1f2937     | Headings, primary text                |
| **textSecondary** | Secondary text   | #374151     | Descriptions, secondary info          |
| **textMuted**     | Muted text       | #6b7280     | Timestamps, less important info       |

### How to Customize Colors

The color system automatically generates 7 opacity levels (5%, 10%, 15%, 25%, 50%, 75%, 100%) for each color. You only need to change the hex value:

1. Open `scripts/config/constants.js`.
2. Locate the `COLOR_PALETTE` object (around line 148).
3. Modify the hex color values to your preference:

```javascript
// scripts/config/constants.js

const COLOR_PALETTE = {
  primary: '#4338CA', // Indigo - for main UI elements
  primary900: '#312E81', // Dark indigo - for darker background
  neutral: '#6b7280', // Gray - for neutral elements
  success: '#10b981', // Green - for OPEN status
  merged: '#8b5cf6', // Purple - for MERGED status
  error: '#ef4444', // Red - for CLOSED status
  textPrimary: '#1f2937', // Dark gray - for main text
  textSecondary: '#374151', // Darker gray - for descriptions (WCAG AA compliant)
  textMuted: '#6b7280', // Medium gray - for muted text (WCAG AA compliant)
};
```

For example, to change to a modern blue theme:

```javascript
const COLOR_PALETTE = {
  primary: '#0066cc', // Blue instead of Indigo
  primary900: '#004c99', // Darker Blue
  neutral: '#64748b', // Slate Gray instead of Gray
  success: '#16a34a', // Darker Green for OPEN
  merged: '#2563eb', // Blue for MERGED
  error: '#dc2626', // Darker Red for CLOSED
  textPrimary: '#111827', // Darker for better contrast
  textSecondary: '#475569', // Adjusted gray
  textMuted: '#94a3b8', // Adjusted light gray
};
```

4. After making changes, run `npm start` locally to regenerate the HTML reports.
5. The new colors will be reflected in all generated reports with all opacity levels automatically applied.
6. **Favicon will also update** to match your primary color!

### How It Works

The color system uses automatic conversion:

- **Input:** Hex color (e.g., `#4f46e5`)
- **Process:** Converts hex to RGB, then generates opacity variants
- **Output:** Colors with different opacity levels (5%, 10%, 15%, 25%, 50%, 75%, 100%) plus full RGB and hex

For example, `#8b5cf6` (purple) automatically generates:

- `rgba(139, 92, 246, 0.05)` for 5% opacity (light backgrounds)
- `rgba(139, 92, 246, 0.1)` for 10% opacity (badge backgrounds)
- `rgba(139, 92, 246, 1)` for 100% opacity (text and solid elements)
- `rgb(139, 92, 246)` for full opacity RGB
- `#8b5cf6` for the original hex value

### Color Customization Tips

- Use a **color picker tool** like [Coolors.co](https://coolors.co/), [Color Picker](https://www.color-picker.com/), or your browser's built-in color picker to find hex values.
- **Verify accessibility** using [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to ensure sufficient contrast:
  - Primary color with white text should pass WCAG AA (4.5:1) at minimum
  - Status colors should maintain good contrast with light backgrounds
  - Text colors should have at least 4.5:1 contrast with background
- Test your color scheme in both light and dark viewing conditions if you're hosting the reports publicly.
- The status colors (success, merged, error) help quickly identify the state of contributions, so choose distinct, recognizable colors.
