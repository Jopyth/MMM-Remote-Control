/**
 * Configuration Management Module
 * Handles all config-related operations for MMM-Remote-Control
 * Extracted from node_helper.js for better maintainability and testing
 */

const fs = require("node:fs");
const path = require("node:path");
const Log = require("logger");
const {cleanConfig} = require("./configUtils.js");

/* global Module */

/**
 * Get the MagicMirror config file path
 * @param {string} moduleDir - Module directory path (usually __dirname from node_helper)
 * @returns {string} Absolute path to config.js
 */
function getConfigPath (moduleDir) {
  let configPath = path.resolve(`${moduleDir}/../../config/config.js`);
  if (globalThis.configuration_file !== undefined) {
    configPath = path.resolve(`${moduleDir}/../../${globalThis.configuration_file}`);
  }
  return configPath;
}

/**
 * Combine default config with user config from config.js
 * @param {string} moduleDir - Module directory path
 * @param {(language: string) => void} loadTranslationCallback - Callback to load translation after config loaded
 * @returns {{configOnHd: object, thisConfig: object}} Config objects
 */
function combineConfig (moduleDir, loadTranslationCallback) {
  // function copied from MagicMirrorOrg (MIT)
  const defaults = require(`${moduleDir}/../../js/defaults.js`);
  const configPath = getConfigPath(moduleDir);
  let thisConfig = {};
  let configOnHd;

  try {
    fs.accessSync(configPath, fs.constants.F_OK);
    const c = require(configPath);
    const config = {...defaults, ...c};
    configOnHd = config;
    // Get the configuration for this module.
    if ("modules" in configOnHd) {
      const thisModule = configOnHd.modules.find((m) => m.module === "MMM-Remote-Control");
      if (thisModule && "config" in thisModule) {
        thisConfig = thisModule.config;
      }
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      Log.error("Could not find config file. Please create one. Starting with default configuration.");
      configOnHd = defaults;
    } else if (error instanceof ReferenceError || error instanceof SyntaxError) {
      Log.error("Could not validate config file. Please correct syntax errors. Starting with default configuration.");
      configOnHd = defaults;
    } else {
      Log.error(`Could not load config file. Starting with default configuration. Error found: ${error}`);
      configOnHd = defaults;
    }
  }

  if (loadTranslationCallback && configOnHd.language) {
    loadTranslationCallback(configOnHd.language);
  }

  return {configOnHd, thisConfig};
}

/**
 * Get config with module defaults merged in
 * @param {object} configOnHd - Current config from disk
 * @param {object} configData - Config data from browser (contains moduleData)
 * @returns {object} Config with defaults merged
 */
function getConfig (configOnHd, configData) {
  const config = configOnHd;
  for (const current of config.modules) {
    const moduleDefaultsFromRequire = Module.configDefaults[current.module];
    // We need moduleDataFromBrowser for bundled modules like MMM-RAIN-MAP. See #331.
    const moduleDataFromBrowser = configData.moduleData?.find((item) => item.name === current.module);

    const moduleConfig = moduleDefaultsFromRequire || moduleDataFromBrowser?.config || {};

    if (!current.config) current.config = {};
    for (const key in moduleConfig) {
      if (!(key in current.config)) {
        current.config[key] = moduleConfig[key];
      }
    }
  }
  return config;
}

/**
 * Remove default values from config to create minimal config file
 * @param {string} moduleDir - Module directory path
 * @param {object} config - Config to clean
 * @param {object} configData - Config data from browser
 * @returns {object} Cleaned config
 */
function removeDefaultValues (moduleDir, config, configData) {

  /*
   * Reload default config (avoid module cache if updated during runtime)
   * In test environments without full MagicMirror installation, defaults.js may not exist
   */
  let defaultConfig = {};
  try {
    const defaultsPath = `${moduleDir}/../../js/defaults.js`;
    delete require.cache[require.resolve(defaultsPath)];
    defaultConfig = require(defaultsPath);
  } catch {
    // defaults.js not found - use empty defaults
  }
  const moduleDefaultsMap = Module.configDefaults;
  const moduleDataFromBrowser = configData.moduleData || [];
  const cleaned = cleanConfig({
    config,
    defaultConfig,
    moduleDefaultsMap,
    moduleDataFromBrowser
  });
  if (cleaned.modules) for (const m of cleaned.modules) Log.debug(m);
  return cleaned;
}

/**
 * Find the best backup slot to use (oldest or empty)
 * @returns {Promise<{slot: number, mtime: Date}|null>} Backup slot info or null
 */
async function findBestBackupSlot () {
  const backupHistorySize = 5;
  const backupSlots = Array.from({length: backupHistorySize - 1}, (_, index) => index + 1);

  let best = null;
  for (const slot of backupSlots) {
    const backupPath = path.resolve(`config/config.js.backup${slot}`);
    try {
      const stats = await fs.promises.stat(backupPath);
      if (!best || stats.mtime < best.mtime) {
        best = {slot, mtime: stats.mtime};
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        const emptySlotMtime = new Date(0);
        if (!best || emptySlotMtime < best.mtime) {
          best = {slot, mtime: emptySlotMtime};
        }
      }
    }
  }
  return best;
}

/**
 * Load translation file for given language
 * @param {string} moduleDir - Module directory path
 * @param {string} language - Language code (e.g., 'en', 'de')
 * @param {object} currentTranslation - Current translation object to merge into
 * @returns {Promise<object>} Updated translation object
 */
async function loadTranslation (moduleDir, language, currentTranslation = {}) {
  try {
    const data = await fs.promises.readFile(path.resolve(`${moduleDir}/translations/${language}.json`), "utf8");
    return {...currentTranslation, ...JSON.parse(data)};
  } catch {
    // Silently ignore missing translation files
    return currentTranslation;
  }
}

/**
 * Load default settings from settings.json
 * @param {string} moduleDir - Module directory path
 * @returns {Promise<object|null>} Settings object or null if not found
 */
async function loadDefaultSettings (moduleDir) {
  try {
    const data = await fs.promises.readFile(path.resolve(`${moduleDir}/settings.json`), "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code !== "ENOENT") {
      Log.error(error);
    }
    return null;
  }
}

/**
 * Save default settings to settings.json
 * @param {string} moduleDir - Module directory path
 * @param {object} configData - Config data containing moduleData, brightness, temp, zoom, backgroundColor, fontColor, settingsVersion
 * @returns {Promise<void>}
 */
async function saveDefaultSettings (moduleDir, configData) {
  const {moduleData} = configData;
  const simpleModuleData = moduleData.map((moduleDatum) => ({
    identifier: moduleDatum.identifier,
    hidden: moduleDatum.hidden,
    lockStrings: moduleDatum.lockStrings,
    urlPath: moduleDatum.urlPath
  }));

  const text = JSON.stringify({
    moduleData: simpleModuleData,
    brightness: configData.brightness,
    temp: configData.temp,
    zoom: configData.zoom ?? 100,
    backgroundColor: configData.backgroundColor ?? "",
    fontColor: configData.fontColor ?? "",
    settingsVersion: configData.settingsVersion
  });

  try {
    await fs.promises.writeFile(path.resolve(`${moduleDir}/settings.json`), text, "utf8");
  } catch (error) {
    Log.error(`Failed to save default settings: ${error}`);
  }
}

/**
 * Load custom menu configuration
 * @param {string} moduleDir - Module directory path
 * @param {object} thisConfig - Module-specific config
 * @param {(data: string) => string} translateCallback - Function to translate strings
 * @returns {Promise<object|null>} Custom menu object or null
 */
async function loadCustomMenus (moduleDir, thisConfig, translateCallback) {
  if ("customMenu" in thisConfig) {
    const menuPath = path.resolve(`${moduleDir}/../../config/${thisConfig.customMenu}`);
    try {
      const data = await fs.promises.readFile(menuPath, "utf8");
      return JSON.parse(translateCallback(data));
    } catch (error) {
      if (error.code === "ENOENT") {
        Log.log(`customMenu requested, but file:${menuPath} was not found.`);
      } else {
        Log.error(`Error reading custom menu: ${error}`);
      }
    }
  }
  return null;
}

module.exports = {
  getConfigPath,
  combineConfig,
  getConfig,
  removeDefaultValues,
  findBestBackupSlot,
  loadTranslation,
  loadDefaultSettings,
  saveDefaultSettings,
  loadCustomMenus
};
