// --- Core Configuration Variables ---
// Change GITHUB_USERNAME to set the starting year for your contribution history.
const GITHUB_USERNAME = 'adiati98';
const BASE_URL = 'https://api.github.com';

// --- Profile shown on the Home hero band ---
// `name` renders with the last word in the brand→accent gradient. Leave it
// empty to fall back to @GITHUB_USERNAME.
const PROFILE = {
  name: 'Ayu Adiati',
  tagline:
    'Documentation maintainer and community lead. Everything below is generated from real GitHub activity.',
  // Rendered in the footer of every page, so a reader who's convinced has
  // somewhere to go. Leave empty to hide the link.
  linkedIn: 'https://www.linkedin.com/in/adiatiayu/',
};

// --- Configuration to generate README in the contributions folder ---
const BASE_DIR = 'contributions';
const path = require('path');

// --- Blog & RSS Configuration ---
const BLOG = {
  // domain: 'adiati.com',
  devToUser: 'adiatiayu',
};

module.exports = {
  GITHUB_USERNAME,
  BASE_URL,
  BASE_DIR,
  BLOG,
  PROFILE,
};
