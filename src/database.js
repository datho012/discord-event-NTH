const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const SENT_ARTICLES_PATH = path.join(DATA_DIR, 'sent_articles.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Loads dynamic configuration (e.g. channel IDs).
 * @returns {{channelIds: string[]}}
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(data);
      // Migrate old 'channelId' string to 'channelIds' array
      if (parsed.channelId && !parsed.channelIds) {
        parsed.channelIds = [parsed.channelId];
        delete parsed.channelId;
        saveConfig(parsed);
      }
      if (!parsed.channelIds) parsed.channelIds = [];
      return parsed;
    }
  } catch (error) {
    console.error('[Database Error]: Failed to load config.json:', error.message);
  }
  return { channelIds: [] };
}

/**
 * Saves dynamic configuration.
 * @param {{channelId: string|null}} config 
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('[Database Error]: Failed to save config.json:', error.message);
  }
}

/**
 * Loads the list of sent article URLs.
 * @returns {string[]}
 */
function loadSentArticles() {
  try {
    if (fs.existsSync(SENT_ARTICLES_PATH)) {
      const data = fs.readFileSync(SENT_ARTICLES_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Database Error]: Failed to load sent_articles.json:', error.message);
  }
  return [];
}

/**
 * Saves the list of sent article URLs.
 * @param {string[]} urls 
 */
function saveSentArticles(urls) {
  try {
    fs.writeFileSync(SENT_ARTICLES_PATH, JSON.stringify(urls, null, 2), 'utf8');
  } catch (error) {
    console.error('[Database Error]: Failed to save sent_articles.json:', error.message);
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  loadSentArticles,
  saveSentArticles
};
