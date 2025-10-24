// --- Configuration Variables ---
// Change these values to match your GitHub profile and history.
const GITHUB_USERNAME = "adiati98" //Change this to your GitHub username
const SINCE_YEAR = 2025 //Change this to the first year of your contribution
const BASE_URL = "https://api.github.com"

// --- Configuration to generate README in the contributions folder ---
const BASE_DIR = "contributions"
const path = require("path")
const README_PATH = path.join(BASE_DIR, "README.md")

module.exports = {
	GITHUB_USERNAME,
	SINCE_YEAR,
	BASE_URL,
	BASE_DIR,
	README_PATH,
}
