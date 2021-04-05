/* Magic Mirror Package List Downloader
 * Module: Remote Control
 *
 * Usage: 
 *   var downloadModules = require('./download_modules');
 *   downloadModules({ callback: function(result) { console.log(result); }});
 *      downloadModules accepts a CONFIG object which will overwrite the values
 *        in the defaults section below.
 *
 * By shbatm
 * MIT Licensed.
 */

/* jshint esversion:6, node: true */
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");
const util = require("util");

var downloadModules = {
    defaults: {
        modulesFile: path.resolve(__dirname, "../modules.json"),    // Path to modules file
        sourceUrl: 'https://raw.githubusercontent.com/wiki/MichMich/MagicMirror/3rd-Party-Modules.md', // Source url
        refreshRate: 24 * 3600,                                     // Max Refresh of One Day
        force: false,                                               // Force the update
        callback: function(result) { console.log(result); }         // Callback to run on success or failure
    },

    init: function(config) {
        if (!config) { config = {}; }
        this.config = Object.assign({}, this.defaults, config);

        return this;
    },

    parseList: function(content) {
        let re = /\|\s?\[(.*?)\]\((.*?)\)\s?\|(.*?)\|(.*)\|?/g;
        let modules = [];

        content.match(re).forEach((line) => {
            line.replace(re, (match, name, url, author, desc) => {
                let modDetail = {
                    longname: name.trim(),
                    id: url.replace(".git", "").replace(/.*\/(.*?\/.*?)$/, "$1").trim(),
                    url: url.replace(".git", "").trim(),
                    author: author.replace(/\[(.*)\]\(.*\)/, "$1").trim(),
                    desc: desc.replace(/\|/, "").trim()
                };
                modules.push(modDetail);
            });
        });

        return modules;
    },

    getPackages: function() {
        fetch(this.config.sourceUrl)
        .then(response => {
            if (response.status === 200) {
                return response;
            } else if (response.statusCode === 401) {
                console.error("MODULE LIST ERROR: Could not load module data from wiki. 401 Error");
                this.config.callback("ERROR_401");
                return;
            } else {
                console.error("MODULE LIST ERROR: Could not load data.", statusText);
                this.config.callback("ERROR_LOADING_DATA");
                return;
            }
        })
        .then(response => response.text())
        .then(body => {
            let modules = this.parseList(body);
            var json = JSON.stringify(modules, undefined, 2);
            var jsonPath = this.config.modulesFile;
            fs.writeFile(jsonPath, json, "utf8", (err, data) => {
                if (err) {
                    console.error("MODULE LIST ERROR: modules.json updating fail:" + err.message);
                    this.config.callback("ERROR_UPDATING");
                } else {
                    this.config.callback("UPDATED");
                }
            });
        })
        .catch(error => {
            console.error("MODULE LIST ERROR: Could not load data.", error);
            this.config.callback("ERROR_LOADING_DATA");
            return;
        });
        return;
    },

    checkLastModified: function() {
        fs.stat(this.config.modulesFile, (err, stats) => {
            let mtime = Math.round(new Date(util.inspect(stats.mtime)).getTime() / 1000);
            let updatedAfter = new Date(Math.round(new Date().getTime() / 1000) - this.config.refreshRate).getTime();
            let needsUpdate = mtime <= updatedAfter;
            if (needsUpdate || this.config.force) { 
                this.getPackages(); 
            } else {
                this.config.callback("NO_UPDATE_REQUIRED");
            }
        });
        return;
    }
};

if (typeof module !== "undefined") {
    module.exports = function(config) {
        downloadModules.init(config);
        downloadModules.checkLastModified();
        return;
    };
}