const path = require('path');
const fs = require('fs/promises');
const axios = require('axios');

const GITHUB_USERNAME = "your-github-username"; // Replace with your GitHub username
const SINCE_YEAR = 2019; // Change with the year of your first contribution
const BASE_URL = "https://api.github.com";

async function fetchContributions(startYear) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("GITHUB_TOKEN is not set.");
    }

    const axiosInstance = axios.create({
        baseURL: BASE_URL,
        headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/vnd.github.v3+json",
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
                        await new Promise(resolve => setTimeout(resolve, 60000));
                        continue;
                    } else {
                        throw err;
                    }
                }
            }
            return results;
        }

        // Fetch merged PRs from others only
        const prs = await getAllPages(`is:pr author:${GITHUB_USERNAME} is:merged merged:>=${yearStart} merged:<${yearEnd} -author:${GITHUB_USERNAME}`);
        
        for (const pr of prs) {
            if (seenUrls.pullRequests.has(pr.html_url)) {
                continue;
            }
            const repoParts = new URL(pr.repository_url).pathname.split("/");
            const owner = repoParts[repoParts.length - 2];
            const repoName = repoParts[repoParts.length - 1];

            // A separate API call is needed to get the full PR description
            const prDetails = await axiosInstance.get(`/repos/${owner}/${repoName}/pulls/${pr.number}`);
            
            contributions.pullRequests.push({
                title: pr.title,
                url: pr.html_url,
                repo: `${owner}/${repoName}`,
                description: prDetails.data.body || "No description provided.",
                date: pr.created_at,
            });
            seenUrls.pullRequests.add(pr.html_url);
        }

        // Fetch created issues
        const issues = await getAllPages(`is:issue author:${GITHUB_USERNAME} created:>=${yearStart} created:<${yearEnd}`);
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

        // Fetch reviewed PRs from other users
        const reviewedPrs = await getAllPages(`is:pr reviewed-by:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} reviewed:>=${yearStart} reviewed:<${yearEnd}`);
        for (const pr of reviewedPrs) {
            if (seenUrls.reviewedPrs.has(pr.html_url)) {
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
            seenUrls.reviewedPrs.add(pr.html_url);
        }

        // Fetch collaborations (PRs commented on or with commits)
        const collaborations = await getAllPages(`is:pr commenter:${GITHUB_USERNAME} -author:${GITHUB_USERNAME} -reviewed-by:${GITHUB_USERNAME} updated:>=${yearStart} updated:<${yearEnd}`);
        for (const pr of collaborations) {
            if (seenUrls.collaborations.has(pr.html_url)) {
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

    return contributions;
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

// Function to find and resize images in the description
function resizeImages(description) {
  const imgRegex = /<img([^>]*)>/g;
  
  // Directly add the style attribute without checking for existing ones
  const resizedDescription = description.replace(imgRegex, (match, attrs) => {
    return `<img${attrs} style="max-width: 50%;">`;
  });
  
  return resizedDescription;
}

async function writeMarkdownFiles(groupedContributions) {
    const baseDir = "contributions";
    await fs.mkdir(baseDir, { recursive: true });

    for (const [key, data] of Object.entries(groupedContributions)) {
        const [year, quarter] = key.split("-");
        const yearDir = path.join(baseDir, year);
        await fs.mkdir(yearDir, { recursive: true });

        const filePath = path.join(yearDir, `${quarter}-${year}.md`);
        const totalContributions = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);

        if (totalContributions === 0) {
            console.log(`Skipping empty quarter: ${key}`);
            continue;
        }

        let markdownContent = `# ${quarter} ${year} — ${totalContributions} contributions\n\n`;
        const sections = {
            pullRequests: "Pull Requests",
            issues: "Issues",
            reviewedPrs: "Reviewed PRs",
            collaborations: "Collaborations",
        };

        for (const [section, title] of Object.entries(sections)) {
            const items = data[section];
            
            markdownContent += `<details>\n`;
            markdownContent += `  <summary><h2>${title}</h2></summary>\n`;

            if (items.length === 0) {
                markdownContent += `No ${title.toLowerCase()} contributions in this quarter.\n`;
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
                    const formattedDate = dateObj.toISOString().split('T')[0];
                    const descriptionHtml = resizeImages(item.description);

                    markdownContent += `    <tr>\n`;
                    markdownContent += `      <td>${counter++}.</td>\n`;
                    markdownContent += `      <td>${item.repo}</td>\n`;
                    markdownContent += `      <td><a href='${item.url}'>${item.title}</a></td>\n`;
                    markdownContent += `      <td>${descriptionHtml}</td>\n`;
                    markdownContent += `      <td>${formattedDate}</td>\n`;
                    markdownContent += `    </tr>\n`;
                }

                markdownContent += `  </tbody>\n`;
                markdownContent += `</table>\n`;
            }

            markdownContent += `</details>\n\n`;
        }

        await fs.writeFile(filePath, markdownContent, 'utf8');
        console.log(`Written file: ${filePath}`);
    }
}

async function main() {
    try {
        const baseDir = "contributions";
        const currentYear = new Date().getFullYear();
        const currentYearDir = path.join(baseDir, currentYear.toString());
        
        let startYearToFetch;
        try {
            await fs.access(currentYearDir);
            console.log(`Current year directory "${currentYearDir}" exists. Only updating this year.`);
            startYearToFetch = currentYear;
        } catch (e) {
            console.log(`Current year directory "${currentYearDir}" not found. Running full sync from ${SINCE_YEAR}.`);
            startYearToFetch = SINCE_YEAR;
        }

        const contributions = await fetchContributions(startYearToFetch);
        const grouped = groupContributionsByQuarter(contributions);
        await writeMarkdownFiles(grouped);
        console.log("Contributions update completed successfully.");
    } catch (e) {
        console.error(`Failed to update contributions: ${e.message}`);
        process.exit(1);
    }
}

main();
