// --- Core Configuration Variables ---
// Change GITHUB_USERNAME and SINCE_YEAR to set the starting year for your contribution history.
const GITHUB_USERNAME = 'adiati98';
const SINCE_YEAR = 2019;
const BASE_URL = 'https://api.github.com';

// --- Configuration to generate README in the contributions folder ---
const BASE_DIR = 'contributions';
const path = require('path');

module.exports = {
  GITHUB_USERNAME,
  SINCE_YEAR,
  BASE_URL,
  BASE_DIR,
};
