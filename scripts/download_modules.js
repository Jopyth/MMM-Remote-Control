
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
    this.config = {...this.defaults, ...config};

    return this;
  },

  parseList (content) {
    try {
      const data = JSON.parse(content);
      const modules = [];

      if (data.modules && Array.isArray(data.modules)) {
        data.modules.forEach((module) => {
          const modDetail = {
            longname: module.name,
            id: module.id,
            url: module.url,
            author: module.maintainer,
            desc: module.description
          };
          modules.push(modDetail);
        });
      }

      return modules;
    } catch (error) {
      console.error("MODULE LIST ERROR: Failed to parse JSON:", error.message);
      return [];
    }
  },

  async getPackages () {
    try {
      const response = await fetch(this.config.sourceUrl);
      if (response.status === 200) {
        const body = await response.text();
        const modules = this.parseList(body);
        const json = `${JSON.stringify(modules, null, 2)}\n`;
        const jsonPath = this.config.modulesFile;
        fs.writeFile(jsonPath, json, "utf8", (err) => {
          if (err) {
            console.error(`MODULE LIST ERROR: modules.json updating fail:${err.message}`);
            this.config.callback("ERROR_UPDATING");
          } else {
            this.config.callback("UPDATED");
          }
        });
      } else if (response.status === 401) {
        console.error("MODULE LIST ERROR: Could not load module data from JSON API. 401 Error");
        this.config.callback("ERROR_401");
      } else {
        console.error("MODULE LIST ERROR: Could not load data.", response.statusText);
        this.config.callback("ERROR_LOADING_DATA");
      }
    } catch (error) {
      console.error("MODULE LIST ERROR: Could not load data.", error);
      this.config.callback("ERROR_LOADING_DATA");
    }
  },

  async checkLastModified () {
    try {
      const stats = await fs.promises.stat(this.config.modulesFile);
      const mtime = Math.round(stats.mtime.getTime() / 1000);
      const updatedAfter = Date.now() - this.config.refreshRate * 1000;
      const needsUpdate = mtime <= updatedAfter;
      if (needsUpdate || this.config.force) {
        this.getPackages();
      } else {
        this.config.callback("NO_UPDATE_REQUIRED");
      }
    } catch (err) {
      // If file doesn't exist or can't be read, download it
      if (err.code === "ENOENT") {
        console.log("MODULE LIST INFO: modules.json not found, downloading...");
        this.getPackages();
      } else {
        console.error("MODULE LIST ERROR: Could not check last modified time.", err);
        this.config.callback("ERROR_CHECKING_LAST_MODIFIED");
      }
    }

  }
};

if (typeof module !== "undefined") {
  module.exports = function (config) {
    downloadModules.init(config);
    downloadModules.checkLastModified();

  };
}
