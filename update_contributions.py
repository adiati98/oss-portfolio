import os
import requests
import datetime
from urllib.parse import urlparse
import time

GITHUB_USERNAME = "adiati98"  # Replace with your GitHub username
SINCE_YEAR = 2019
BASE_URL = "https://api.github.com"

def fetch_contributions():
    """
    Fetches contributions from GitHub year by year.
    """
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN is not set.")

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    session = requests.Session()
    session.headers.update(headers)

    contributions = {
        "pullRequests": [],
        "issues": [],
        "triagedIssues": [],
        "reviewedPrs": [],
    }

    current_year = datetime.datetime.now().year

    for year in range(SINCE_YEAR, current_year + 1):
        print(f"Fetching contributions for year: {year}...")
        year_start = f"{year}-01-01T00:00:00Z"
        year_end = f"{year + 1}-01-01T00:00:00Z"

        def get_all_pages(query):
            results = []
            page = 1
            while True:
                response = None
                try:
                    response = session.get(
                        f"{BASE_URL}/search/issues?q={query}&per_page=100&page={page}"
                    )
                    response.raise_for_status() # This will raise an HTTPError for 4xx/5xx responses
                    data = response.json()
                    results.extend(data["items"])

                    if "next" in response.links:
                        page += 1
                    else:
                        break
                except requests.exceptions.HTTPError as err:
                    if response.status_code == 403:
                        print("Rate limit hit. Waiting for 60 seconds...")
                        time.sleep(60) # Pause for a minute to reset the rate limit
                        continue # Retry the same page
                    else:
                        raise err
            return results

        # Fetch merged PRs
        prs = get_all_pages(f"is:pr author:{GITHUB_USERNAME} is:merged merged:>={year_start} merged:<{year_end}")
        for pr in prs:
            repo_parts = urlparse(pr["repository_url"]).path.split("/")
            owner = repo_parts[-2]
            repo_name = repo_parts[-1]
            pr_details = session.get(f"{BASE_URL}/repos/{owner}/{repo_name}/pulls/{pr['number']}")
            
            if pr_details.status_code == 200:
                pr_data = pr_details.json()
                contributions["pullRequests"].append({
                    "title": pr_data["title"],
                    "url": pr_data["html_url"],
                    "repo": repo_name,
                    "description": pr_data["body"] or "No description provided.",
                    "merged_at": pr_data["merged_at"],
                })
            else:
                print(f"Could not fetch details for {pr['html_url']}")
                
        # Fetch created issues
        issues = get_all_pages(f"is:issue author:{GITHUB_USERNAME} created:>={year_start} created:<{year_end}")
        for issue in issues:
            contributions["issues"].append({
                "title": issue["title"],
                "url": issue["html_url"],
                "repo": urlparse(issue["repository_url"]).path.split("/")[-1],
                "description": issue["body"] or "No description provided.",
                "created_at": issue["created_at"],
            })

        # Fetch reviewed PRs and triaged issues (body is available in search results)
        reviewed_prs = get_all_pages(f"is:pr reviewed-by:{GITHUB_USERNAME} reviewed:>={year_start} reviewed:<{year_end}")
        for pr in reviewed_prs:
            contributions["reviewedPrs"].append({
                "title": pr["title"],
                "url": pr["html_url"],
                "repo": urlparse(pr["repository_url"]).path.split("/")[-1],
                "description": pr["body"] or "No description provided.",
                "reviewed_at": pr["updated_at"],
            })
            
        triaged_issues = get_all_pages(f"is:issue assignee:{GITHUB_USERNAME} created:>={year_start} created:<{year_end}")
        for issue in triaged_issues:
            contributions["triagedIssues"].append({
                "title": issue["title"],
                "url": issue["html_url"],
                "repo": urlparse(issue["repository_url"]).path.split("/")[-1],
                "description": issue["body"] or "No description provided.",
                "triaged_at": issue["updated_at"],
            })

    return contributions

def group_contributions_by_quarter(contributions):
    """
    Groups contributions by year and quarter.
    """
    grouped = {}
    for type_name, items in contributions.items():
        for item in items:
            date_str = item.get("merged_at") or item.get("created_at") or item.get("reviewed_at") or item.get("triaged_at")
            if not date_str:
                continue
            
            date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")
            year = date_obj.year
            month = date_obj.month
            quarter = f"Q{(month - 1) // 3 + 1}"
            key = f"{year}-{quarter}"
            
            if key not in grouped:
                grouped[key] = {
                    "pullRequests": [],
                    "issues": [],
                    "triagedIssues": [],
                    "reviewedPrs": [],
                }
            grouped[key][type_name].append(item)
    return grouped

def write_markdown_files(grouped_contributions):
    """
    Writes the grouped contributions to markdown files.
    """
    base_dir = "contributions"
    os.makedirs(base_dir, exist_ok=True)

    for key, data in grouped_contributions.items():
        year, quarter = key.split("-")
        year_dir = os.path.join(base_dir, year)
        os.makedirs(year_dir, exist_ok=True)

        file_path = os.path.join(year_dir, f"{quarter}-{year}.md")
        has_data = any(data[section] for section in data)
        if not has_data:
            print(f"Skipping empty quarter: {key}")
            continue

        markdown_content = f"# Contributions - {quarter} {year}\n\n"
        sections = {
            "pullRequests": "Pull Requests",
            "issues": "Issues",
            "triagedIssues": "Triaged Issues",
            "reviewedPrs": "Reviewed PRs",
        }

        for section, title in sections.items():
            items = data[section]
            markdown_content += f"## {title}\n\n"
            if not items:
                markdown_content += "No contributions found for this section.\n\n"
            else:
                markdown_content += "| Project Name | Link | Description | Date |\n"
                markdown_content += "|---|---|---|---|\n"
                for item in items:
                    date_str = item.get("merged_at") or item.get("created_at") or item.get("reviewed_at") or item.get("triaged_at")
                    date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")
                    formatted_date = date_obj.strftime("%Y-%m-%d")
                    
                    description = item["description"].replace("\n", " ")
                    if len(description) > 100:
                        description = description[:100] + "..."
                        
                    markdown_content += f"| {item['repo']} | [{item['title']}]({item['url']}) | {description} | {formatted_date} |\n"
                markdown_content += "\n"
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        print(f"Written file: {file_path}")

def main():
    try:
        contributions = fetch_contributions()
        grouped = group_contributions_by_quarter(contributions)
        write_markdown_files(grouped)
        print("Contributions update completed successfully.")
    except Exception as e:
        print(f"Failed to update contributions: {e}")
        exit(1)

if __name__ == "__main__":
    main()
