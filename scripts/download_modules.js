/*
 * MagicMirror² Package List Downloader
 * Module: Remote Control
 *
 * Usage:
 *   const downloadModules = require('./download_modules');
 *   downloadModules({ callback: function(result) { console.log(result); }});
 *      downloadModules accepts a CONFIG object which will overwrite the values
 *        in the defaults section below.
 *
 * By shbatm
 * MIT Licensed.
 */

const path = require("node:path");
const fs = require("node:fs");

const downloadModules = {
  defaults: {
    modulesFile: path.resolve(__dirname, "../modules.json"), // Path to modules file
    sourceUrl: "https://modules.magicmirror.builders/data/modules.json", // Source url
    refreshRate: 24 * 3600, // Max Refresh of One Day
    force: false, // Force the update
    callback (result) { console.log(result); } // Callback to run on success or failure
  },

  init (config) {
    if (!config) { config = {}; }
    downloadModules.config = {...downloadModules.defaults, ...config};

    return downloadModules;
  },

  parseList (content) {
    try {
      const data = JSON.parse(content);

      if (data.modules && Array.isArray(data.modules)) {
        return data.modules;
      }

      return [];
    } catch (error) {
      console.error("MODULE LIST ERROR: Failed to parse JSON:", error.message);
      return [];
    }
  },

  async getPackages () {
    try {
      const response = await fetch(downloadModules.config.sourceUrl);
      if (response.status === 200) {
        const body = await response.text();
        const modules = downloadModules.parseList(body);
        const json = `${JSON.stringify(modules, null, 2)}\n`;
        const jsonPath = downloadModules.config.modulesFile;
        fs.writeFile(jsonPath, json, "utf8", (error) => {
          if (error) {
            console.error(`MODULE LIST ERROR: modules.json updating fail:${error.message}`);
            downloadModules.config.callback("ERROR_UPDATING");
          } else {
            downloadModules.config.callback("UPDATED");
          }
        });
      } else if (response.status === 401) {
        console.error("MODULE LIST ERROR: Could not load module data from JSON API. 401 Error");
        downloadModules.config.callback("ERROR_401");
      } else {
        console.error("MODULE LIST ERROR: Could not load data.", response.statusText);
        downloadModules.config.callback("ERROR_LOADING_DATA");
      }
    } catch (error) {
      console.error("MODULE LIST ERROR: Could not load data.", error);
      downloadModules.config.callback("ERROR_LOADING_DATA");
    }
  },

  async checkLastModified () {
    try {
      const stats = await fs.promises.stat(downloadModules.config.modulesFile);
      const mtime = Math.round(stats.mtime.getTime() / 1000);
      const updatedAfter = Date.now() - downloadModules.config.refreshRate * 1000;
      const isNeedsUpdate = mtime <= updatedAfter;
      if (isNeedsUpdate || downloadModules.config.force) {
        downloadModules.getPackages();
      } else {
        downloadModules.config.callback("NO_UPDATE_REQUIRED");
      }
    } catch (error) {
      // If file doesn't exist or can't be read, download it
      if (error.code === "ENOENT") {
        console.log("MODULE LIST INFO: modules.json not found, downloading...");
        downloadModules.getPackages();
      } else {
        console.error("MODULE LIST ERROR: Could not check last modified time.", error);
        downloadModules.config.callback("ERROR_CHECKING_LAST_MODIFIED");
      }
    }

  }
};

/**
 * Main entry point for downloading modules from modules.json.
 * @param {object} config - MagicMirror configuration object
 */
function downloadModulesMain (config) {
  downloadModules.init(config);
  downloadModules.checkLastModified();
}

if (typeof module !== "undefined") {
  module.exports = downloadModulesMain;
}
