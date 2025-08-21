const path = require("path")
const fs = require("fs/promises")
const axios = require("axios")

const GITHUB_USERNAME = "adiati98" // Change this to your GitHub username
const SINCE_YEAR = 2019 // Change this to the year of your first contribution
const BASE_URL = "https://api.github.com"

async function fetchContributions(startYear, prCache) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("GITHUB_TOKEN is not set.");
    }

    const axiosInstance = axios.create({
        baseURL: BASE_URL,
        headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    const contributions = {
        pullRequests: [],
        issues: [],
        reviewedPrs: [],
        collaborations: [],
    };

    const seenUrls = {
        pullRequests: new Set(),
        issues: new Set(),
        reviewedPrs: new Set(),
        collaborations: new Set(),
    };

    const currentYear = new Date().getFullYear();

    for (let year = startYear; year <= currentYear; year++) {
        console.log(`Fetching contributions for year: ${year}...`);
        const yearStart = `${year}-01-01T00:00:00Z`;
        const yearEnd = `${year + 1}-01-01T00:00:00Z`;

        async function getAllPages(query) {
            let results = [];
            let page = 1;
            while (true) {
                try {
                    const response = await axiosInstance.get(
                        `/search/issues?q=${query}&per_page=100&page=${page}`
                    );
                    results.push(...response.data.items);

                    const linkHeader = response.headers.link;
                    if (linkHeader && linkHeader.includes('rel="next"')) {
                        page++;
                    } else {
                        break;
                    }
                } catch (err) {
                    if (err.response && err.response.status === 403) {
                        console.log("Rate limit hit. Waiting for 60 seconds...");
                        await new Promise((resolve) => setTimeout(resolve, 60000));
                        continue;
                    } else {
                        throw err;
                    }
                }
            }
            return results;
        }

        const prs = await getAllPages(
            `is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd}`
        );

        for (const pr of prs) {
            if (prCache.has(pr.html_url)) {
                console.log(`Skipping cached PR from own repo: ${pr.html_url}`);
                continue;
            }

            const repoParts = new URL(pr.repository_url).pathname.split("/");
            const owner = repoParts[repoParts.length - 2];
            const repoName = repoParts[repoParts.length - 1];

            if (owner === GITHUB_USERNAME) {
                console.log(`Caching new PR from own repo: ${pr.html_url}`);
                prCache.add(pr.html_url);
                continue;
            }

            if (seenUrls.pullRequests.has(pr.html_url)) {
                continue;
            }

            contributions.pullRequests.push({
                title: pr.title,
                url: pr.html_url,
                repo: `${owner}/${repoName}`,
                description: pr.body || "No description provided.",
                date: pr.created_at,
            });
            seenUrls.pullRequests.add(pr.html_url);
        }

        const issues = await getAllPages(
            `is:issue author:${GITHUB_USERNAME} -user:${GITHUB_USERNAME} created:>=${yearStart} created:<${yearEnd}`
        );
        for (const issue of issues) {
            if (seenUrls.issues.has(issue.html_url)) {
                continue;
            }
            const repoParts = new URL(issue.repository_url).pathname.split("/");
            const owner = repoParts[repoParts.length - 2];
            const repoName = repoParts[repoParts.length - 1];
            contributions.issues.push({
                title: issue.title,
                url: issue.html_url,
                repo: `${owner}/${repoName}`,
                description: issue.body || "No description provided.",
                date: issue.created_at,
            });
            seenUrls.issues.add(issue.html_url);
        }

        const reviewedByPrs = await getAllPages(
            `is:pr reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
        );
        const mergedByPrs = await getAllPages(
            `is:pr merged-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
        );
        const closedByPrs = await getAllPages(
            `is:pr is:closed -author:${GITHUB_USERNAME} closed-by:${GITHUB_USERNAME} commenter:${GITHUB_USERNAME} closed:>=${yearStart} closed:<${yearEnd}`
        );

        const combinedResults = [...reviewedByPrs, ...mergedByPrs, ...closedByPrs];
        const uniqueReviewedPrs = new Set();

        for (const pr of combinedResults) {
            const prDate = new Date(pr.updated_at);
            const yearStartDate = new Date(yearStart);
            const yearEndDate = new Date(yearEnd);

            if (prDate >= yearStartDate && prDate < yearEndDate) {
                if (uniqueReviewedPrs.has(pr.html_url)) {
                    continue;
                }
                const repoParts = new URL(pr.repository_url).pathname.split("/");
                const owner = repoParts[repoParts.length - 2];
                const repoName = repoParts[repoParts.length - 1];
                contributions.reviewedPrs.push({
                    title: pr.title,
                    url: pr.html_url,
                    repo: `${owner}/${repoName}`,
                    description: pr.body || "No description provided.",
                    date: pr.updated_at,
                });
                uniqueReviewedPrs.add(pr.html_url);
            }
        }

        const collaborationsPrs = await getAllPages(
            `is:pr is:open commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -reviewed-by:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
        );
        const collaborationsIssues = await getAllPages(
            `is:issue commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`
        );
        
        const allCollaborations = [...collaborationsPrs, ...collaborationsIssues];

        for (const pr of allCollaborations) {
            if (
                seenUrls.collaborations.has(pr.html_url) ||
                uniqueReviewedPrs.has(pr.html_url)
            ) {
                continue;
            }
            const repoParts = new URL(pr.repository_url).pathname.split("/");
            const owner = repoParts[repoParts.length - 2];
            const repoName = repoParts[repoParts.length - 1];
            contributions.collaborations.push({
                title: pr.title,
                url: pr.html_url,
                repo: `${owner}/${repoName}`,
                description: pr.body || "No description provided.",
                date: pr.updated_at,
            });
            seenUrls.collaborations.add(pr.html_url);
        }
    }

    return { contributions, prCache };
}

function groupContributionsByQuarter(contributions) {
    const grouped = {};
    for (const [type, items] of Object.entries(contributions)) {
        for (const item of items) {
            const dateStr = item.date;
            if (!dateStr) continue;

            const dateObj = new Date(dateStr);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const quarter = `Q${Math.floor((month - 1) / 3) + 1}`;
            const key = `${year}-${quarter}`;

            if (!grouped[key]) {
                grouped[key] = {
                    pullRequests: [],
                    issues: [],
                    reviewedPrs: [],
                    collaborations: [],
                };
            }
            grouped[key][type].push(item);
        }
    }
    return grouped;
}

async function writeMarkdownFiles(groupedContributions) {
    const baseDir = "contributions";
    await fs.mkdir(baseDir, { recursive: true });

    for (const [key, data] of Object.entries(groupedContributions)) {
        const [year, quarter] = key.split("-");
        const yearDir = path.join(baseDir, year);
        await fs.mkdir(yearDir, { recursive: true });

        const filePath = path.join(yearDir, `${quarter}-${year}.md`);
        const totalContributions = Object.values(data).reduce(
            (sum, arr) => sum + arr.length,
            0
        );

        if (totalContributions === 0) {
            console.log(`Skipping empty quarter: ${key}`);
            continue;
        }

        let markdownContent = `# ${quarter} ${year} — ${totalContributions} contributions\n\n`;
        const sections = {
            pullRequests: "Merged PRs",
            issues: "Issues",
            reviewedPrs: "Reviewed PRs",
            collaborations: "Collaborations",
        };

        for (const [section, title] of Object.entries(sections)) {
            const items = data[section];

            markdownContent += `<details>\n`;
            markdownContent += `  <summary><h2>${title}</h2></summary>\n`;

            if (items.length === 0) {
                markdownContent += `No contribution in this quarter.\n`;
            } else {
                markdownContent += `<table style='width:100%; table-layout:fixed;'>\n`;
                markdownContent += `  <thead>\n`;
                markdownContent += `    <tr>\n`;
                markdownContent += `      <th style='width:5%;'>No.</th>\n`;
                markdownContent += `      <th style='width:20%;'>Project Name</th>\n`;
                markdownContent += `      <th style='width:20%;'>Title</th>\n`;
                markdownContent += `      <th style='width:35%;'>Description</th>\n`;
                markdownContent += `      <th style='width:20%;'>Date</th>\n`;
                markdownContent += `    </tr>\n`;
                markdownContent += `  </thead>\n`;
                markdownContent += `  <tbody>\n`;

                let counter = 1;
                for (const item of items) {
                    const dateObj = new Date(item.date);
                    const formattedDate = dateObj.toISOString().split("T")[0];

                    const sanitizedDescription = item.description
                        ? item.description.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                        : "No description provided.";

                    markdownContent += `    <tr>\n`;
                    markdownContent += `      <td>${counter++}.</td>\n`;
                    markdownContent += `      <td>${item.repo}</td>\n`;
                    markdownContent += `      <td><a href='${item.url}'>${item.title}</a></td>\n`;
                    markdownContent += `      <td>${sanitizedDescription}</td>\n`;
                    markdownContent += `      <td>${formattedDate}</td>\n`;
                    markdownContent += `    </tr>\n`;
                }

                markdownContent += `  </tbody>\n`;
                markdownContent += `</table>\n`;
            }

            markdownContent += `</details>\n\n`;
        }

        await fs.writeFile(filePath, markdownContent, "utf8");
        console.log(`Written file: ${filePath}`);
    }
}

async function main() {
    const cacheFile = "pr_cache.json";
    let prCache = new Set();

    try {
        const cacheData = await fs.readFile(cacheFile, "utf8");
        prCache = new Set(JSON.parse(cacheData));
        console.log("Loaded PR cache from file.");
    } catch (e) {
        if (e.code !== "ENOENT") {
            console.error("Failed to load PR cache:", e);
        }
    }

    try {
        const baseDir = "contributions";
        const currentYear = new Date().getFullYear();
        let startYearToFetch = SINCE_YEAR;

        try {
            await fs.access(baseDir);
            console.log("Contributions folder found.");

            const currentYearDir = path.join(baseDir, currentYear.toString());
            let isPreviousQuartersComplete = true;

            try {
                await fs.access(currentYearDir);

                const currentMonth = new Date().getMonth();
                const currentQuarter = Math.floor(currentMonth / 3) + 1;

                for (let q = 1; q < currentQuarter; q++) {
                    const quarterFile = path.join(currentYearDir, `Q${q}-${currentYear}.md`);
                    try {
                        const stats = await fs.stat(quarterFile);
                        if (stats.size === 0) {
                            isPreviousQuartersComplete = false;
                            break;
                        }
                    } catch (e) {
                        if (e.code === "ENOENT") {
                            isPreviousQuartersComplete = false;
                            break;
                        }
                    }
                }
            } catch (e) {
                if (e.code === "ENOENT") {
                    isPreviousQuartersComplete = false;
                } else {
                    throw e;
                }
            }

            if (isPreviousQuartersComplete) {
                console.log(`Previous quarters' data is up to date. Starting sync for ${currentYear}.`);
                startYearToFetch = currentYear;
            } else {
                console.log(`Current year data is incomplete. Starting sync for ${currentYear}.`);
                startYearToFetch = currentYear;
            }

        } catch (e) {
            if (e.code === "ENOENT") {
                console.log(
                    `Contributions folder not found. Running full sync from ${SINCE_YEAR}.`
                );
            } else {
                throw e;
            }
        }
        
        console.log(`Starting data fetch from year: ${startYearToFetch}`);
        const { contributions, prCache: updatedPrCache } = await fetchContributions(startYearToFetch, prCache);
        const grouped = groupContributionsByQuarter(contributions);
        await writeMarkdownFiles(grouped);

        await fs.writeFile(cacheFile, JSON.stringify(Array.from(updatedPrCache)), "utf8");
        console.log("Updated PR cache saved to file.");

        console.log("Contributions update completed successfully.");

    } catch (e) {
        console.error(`Failed to update contributions: ${e.message}`);
        process.exit(1);
    }
}
main();
