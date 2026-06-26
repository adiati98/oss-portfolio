/**
 * SHARED: Bot detection with a dynamic allowlist.
 * The Active Workbench excludes bots by default; `allowedBot` entries in
 * contents/allowed-bot.js are treated as human actors instead (see that file for why).
 */
function loadAllowedBots() {
  try {
    const allowedBotConfig = require('../../contents/allowed-bot');
    return (allowedBotConfig.allowedBot || []).map((b) => String(b).toLowerCase());
  } catch (e) {
    return [];
  }
}

const ALLOWED_BOTS = loadAllowedBots();

function isAllowedBotLogin(login) {
  const lower = String(login || '').toLowerCase();
  if (!lower) return false;
  return ALLOWED_BOTS.some((allowed) => lower.includes(allowed));
}

/**
 * @param {string} login
 * @param {string} [type] - GitHub actor/user `type` field, e.g. 'Bot'.
 */
function isBotLogin(login, type) {
  const lower = String(login || '').toLowerCase();
  if (isAllowedBotLogin(lower)) return false;
  return type === 'Bot' || /\[bot\]$|dependabot|snyk/i.test(lower);
}

module.exports = { isAllowedBotLogin, isBotLogin };
