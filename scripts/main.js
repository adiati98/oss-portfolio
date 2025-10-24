const path = require("path")
const fs = require("fs/promises")

// Import configuration (SINCE_YEAR is needed here)
const { SINCE_YEAR } = require("./config")

// Import core fetching logic
const { fetchContributions } = require("./github-api-fetchers")

// Import grouping logic
const { groupContributionsByQuarter } = require("./contributions-groupers")

// Import markdown generation logic
const { writeMarkdownFiles } = require("./quarterly-reports-generator")
const { createStatsReadme } = require("./contributions-readme-generator")

async function main() {
	// Define the data directory path.
	const dataDir = "data"
	// Ensure the data directory exists before trying to read from or write to it.
	await fs.mkdir(dataDir, { recursive: true })

	// Use the path module to correctly build the file paths.
	const cacheFile = path.join(dataDir, "pr-cache.json")
	const dataFile = path.join(dataDir, "all-contributions.json")

	let prCache = new Set()

	// Try to load the cache from a JSON file.
	try {
		const cacheData = await fs.readFile(cacheFile, "utf8")
		prCache = new Set(JSON.parse(cacheData))
		console.log("Loaded PR cache from file.")
	} catch (e) {
		// If the file doesn't exist, we'll start with an empty cache.
		if (e.code !== "ENOENT") {
			console.error("Failed to load PR cache:", e)
		}
	}

	// Load persistent commit cache (if present) so we don't re-query PR commits repeatedly
	const commitCacheFile = path.join(dataDir, "commit-cache.json")
	let commitCacheFromDisk = new Map()
	try {
		const commitCacheData = await fs.readFile(commitCacheFile, "utf8")
		const parsed = JSON.parse(commitCacheData)
		// parsed expected to be an object mapping prUrlKey -> { firstCommitDate, commitCount } or null
		for (const [k, v] of Object.entries(parsed)) {
			commitCacheFromDisk.set(k, v)
		}
		console.log("Loaded commit cache from file.")
	} catch (e) {
		if (e.code !== "ENOENT") {
			console.error("Failed to load commit cache:", e)
		} else {
			console.log("No persistent commit cache found, starting fresh.")
		}
	}

	try {
		let allContributions = {}

		// Try to load the full contributions data from a JSON file.
		try {
			const data = await fs.readFile(dataFile, "utf8")
			allContributions = JSON.parse(data)
			console.log("Loaded existing contributions data.")
		} catch (e) {
			if (e.code !== "ENOENT") {
				console.error("Failed to load contributions data:", e)
			} else {
				console.log("No existing data file found. Starting fresh.")
			}
		}

		// Determine optimal fetch strategy based on last update time
		const cacheStats = await fs.stat(dataFile).catch(() => null)
		const lastUpdate = cacheStats ? new Date(cacheStats.mtime) : null
		const today = new Date()

		let fetchStartYear =
			typeof SINCE_YEAR !== "undefined" ? SINCE_YEAR : today.getFullYear() - 1 // Default to last year if SINCE_YEAR is not available

		if (!lastUpdate) {
			fetchStartYear =
				typeof SINCE_YEAR !== "undefined" ? SINCE_YEAR : fetchStartYear
			console.log("First run - fetching all contributions")
		} else {
			const lastUpdateYear = lastUpdate.getFullYear()
			const lastUpdateMonth = lastUpdate.getMonth()
			const currentYear = today.getFullYear()
			const currentMonth = today.getMonth()

			const sameMonth =
				lastUpdateMonth === currentMonth && lastUpdateYear === currentYear
			// Check if last update was exactly the previous month
			const previousMonth =
				lastUpdateMonth === (currentMonth - 1 + 12) % 12 &&
				(lastUpdateYear === currentYear ||
					(lastUpdateYear === currentYear - 1 && currentMonth === 0))

			if (sameMonth) {
				fetchStartYear = currentYear
				console.log("Recent update - fetching only current year")
			} else if (previousMonth) {
				fetchStartYear = currentYear - 1
				console.log("Last month update - fetching last two years")
			} else {
				fetchStartYear =
					typeof SINCE_YEAR !== "undefined" ? SINCE_YEAR : fetchStartYear
				console.log("Older update - fetching all years")
			}
		}

		console.log(`Fetching contributions from year: ${fetchStartYear}`)

		// Fetch new contributions and update the cache.
		// Merge the persistent commit cache into an in-memory Map and pass it into the fetcher
		const mergedCommitCache = new Map()
		for (const [k, v] of commitCacheFromDisk) mergedCommitCache.set(k, v)

		const {
			contributions: newContributions,
			prCache: updatedPrCache,
			commitCache: usedCommitCache,
		} = await fetchContributions(fetchStartYear, prCache, mergedCommitCache)

		// Second pass: merge new contributions and existing ones, preserving all contribution types
		let finalContributions = {
			pullRequests: [],
			issues: [],
			reviewedPrs: [],
			coAuthoredPrs: [],
			collaborations: [],
		}

		// Keep track of URLs for each category separately for in-memory deduplication
		const categorySeenUrls = {
			pullRequests: new Set(),
			issues: new Set(),
			reviewedPrs: new Set(),
			coAuthoredPrs: new Set(),
			collaborations: new Set(),
		}

		// Helper to add/update an item in its correct final category,
		// respecting the independence of categories.
		const addOrUpdateItem = (item, type) => {
			// Only proceed if the type is one we track
			if (!finalContributions[type]) return

			// Check if the item already exists in this specific category array
			const existingIndex = finalContributions[type].findIndex(
				(i) => i.url === item.url
			)

			if (existingIndex !== -1) {
				// If it exists, update the existing entry (e.g., status changed on re-fetch)
				finalContributions[type][existingIndex] = item
			} else {
				// If it's a new URL for this category, add it and mark as seen
				finalContributions[type].push(item)
				categorySeenUrls[type].add(item.url)
			}
		}

		// --- 1. Load Existing Contributions (Preserve all categories) ---
		console.log("Preserving existing contributions by category.")

		for (const type of Object.keys(finalContributions)) {
			if (Array.isArray(allContributions[type])) {
				for (const item of allContributions[type]) {
					// We only add existing items here; updates will happen from newContributions later.
					if (!categorySeenUrls[type].has(item.url)) {
						finalContributions[type].push(item)
						categorySeenUrls[type].add(item.url)
					}
				}
			}
		}

		// --- 2. Add/Update Newly Fetched Contributions ---
		console.log("Merging newly fetched contributions.")

		for (const type of Object.keys(newContributions)) {
			if (Array.isArray(newContributions[type])) {
				for (const item of newContributions[type]) {
					// New items must be added or updated, ensuring the latest data is used.
					addOrUpdateItem(item, type)
				}
			}
		}

		// --- 3. Sort each category by date (The original sort logic remains) ---
		for (const type of Object.keys(finalContributions)) {
			finalContributions[type].sort(
				(a, b) => new Date(b.date) - new Date(a.date)
			)
		}

		console.log(
			"Merged and categorized all contributions based on latest status."
		)

		// Save the updated, full contributions data to a new JSON file
		await fs.writeFile(
			dataFile,
			JSON.stringify(finalContributions, null, 2),
			"utf8"
		)
		console.log("Updated contributions data saved to file.")

		// === Quarterly grouping and Markdown generator functions ===
		// 1. Group data
		const grouped = groupContributionsByQuarter(finalContributions)

		// 2. Generate quarterly reports
		await writeMarkdownFiles(grouped)

		// 3. Generate aggregate README
		await createStatsReadme(finalContributions)

		// Save the updated PR cache to a file for future runs.
		await fs.writeFile(
			cacheFile,
			JSON.stringify(Array.from(updatedPrCache)),
			"utf8"
		)
		console.log("Updated PR cache saved to file.")

		// Persist the commit cache to disk so future runs reuse it and save API calls.
		try {
			const obj = {}
			for (const [k, v] of usedCommitCache || mergedCommitCache) {
				obj[k] = v
			}
			await fs.writeFile(commitCacheFile, JSON.stringify(obj, null, 2), "utf8")
			console.log("Persisted commit cache to file.")
		} catch (e) {
			console.error("Failed to persist commit cache:", e)
		}

		console.log("Contributions update completed successfully.")
	} catch (e) {
		// Handle any top-level errors that occur during the process.
		console.error(`Failed to update contributions: ${e.message}`)
		process.exit(1)
	}
}
// Start the main execution.
main()
