/* global Module */

/**
 * @file MagicMirror² Remote Control Module - Node Helper
 * @module node_helper
 */

/**
 * @typedef {import('./types').ModuleData} ModuleData
 * @typedef {import('./types').ConfigData} ConfigData
 * @typedef {import('./types').ModuleConfig} ModuleConfig
 * @typedef {import('./types').BackupInfo} BackupInfo
 * @typedef {import('./types').ApiResponse} ApiResponse
 */

/*
 * MagicMirror²
 * Module: Remote Control
 *
 * By Joseph Bethge
 * MIT Licensed.
 */

const Log = require("logger");
const NodeHelper = require("node_helper");
const {exec} = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const url = require("node:url");
const {inspect, promisify} = require("node:util");
const simpleGit = require("simple-git");

let defaultModules;
try {
  defaultModules = require(path.resolve(`${__dirname}/../../modules/default/defaultmodules.js`));
} catch {
  // Fallback for test environment or standalone usage
  defaultModules = require("./tests/shims/defaultmodules.js");
}
const {capitalizeFirst, formatName, includes} = require("./lib/utils.js");
const {cleanConfig} = require("./lib/configUtils.js");

// eslint-disable-next-line no-global-assign
Module = {
  configDefaults: {},
  notificationHandler: {},
  register (name, moduleDefinition) {
    Module.configDefaults[name] = moduleDefinition.defaults;

    /* API EXTENSION - Added v2.0.0 */
    Module.notificationHandler[name] = "notificationReceived" in moduleDefinition
      ? moduleDefinition.notificationReceived.toString()
      : "";
  }
};

module.exports = NodeHelper.create({
  // Subclass start method.
  start () {
    this.initialized = false;
    Log.log(`Starting node helper for: ${this.name}`);

    // load fall back translation
    this.loadTranslation("en");

    this.configOnHd = {};
    this.configData = {};

    this.waiting = [];

    this.template = "";
    this.modulesAvailable = [];
    this.modulesInstalled = [];

    this.delayedQueryTimers = {};

    // Queue for update checks to avoid overwhelming system
    this.updateCheckQueue = [];
    this.activeUpdateChecks = 0;
    this.maxParallelUpdateChecks = 10;

    fs.readFile(path.resolve(`${__dirname}/remote.html`), (error, data) => {
      this.template = data.toString();
    });

    this.combineConfig();
    this.updateModuleList();
    this.createRoutes();

    /* API EXTENSION - Added v2.0.0 */
    this.externalApiRoutes = {};
    this.moduleApiMenu = {};
    this.customMenu = {};
  },

  stop () {
    // Clear all timeouts for clean shutdown
    for (const t of Object.keys(this.delayedQueryTimers)) {
      clearTimeout(this.delayedQueryTimers[t]);
    }
  },

  onModulesLoaded () {

    /* CALLED AFTER MODULES AND CONFIG DATA ARE LOADED */
    /* API EXTENSION - Added v2.0.0 */
    this.createApiRoutes();

    this.loadTimers();
  },

  /**
   * Set up periodic timers for module list updates
   * @returns {void}
   */
  loadTimers () {
    const delay = 24 * 3600;

    clearTimeout(this.delayedQueryTimers.update);
    this.delayedQueryTimers.update = setTimeout(() => {
      this.updateModuleList();
      this.loadTimers();
    }, delay * 1000);
  },

  /**
   * Combine default config with user config from config.js
   * Sets this.configOnHd and this.thisConfig
   * @returns {void}
   */
  combineConfig () {
    // function copied from MagicMirrorOrg (MIT)
    const defaults = require(`${__dirname}/../../js/defaults.js`);
    const configPath = this.getConfigPath();
    this.thisConfig = {};
    try {
      fs.accessSync(configPath, fs.constants.F_OK);
      const c = require(configPath);
      const config = {...defaults, ...c};
      this.configOnHd = config;
      // Get the configuration for this module.
      if ("modules" in this.configOnHd) {
        const thisModule = this.configOnHd.modules.find((m) => m.module === "MMM-Remote-Control");
        if (thisModule && "config" in thisModule) {
          this.thisConfig = thisModule.config;
        }
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        Log.error("Could not find config file. Please create one. Starting with default configuration.");
        this.configOnHd = defaults;
      } else if (error instanceof ReferenceError || error instanceof SyntaxError) {
        Log.error("Could not validate config file. Please correct syntax errors. Starting with default configuration.");
        this.configOnHd = defaults;
      } else {
        Log.error(`Could not load config file. Starting with default configuration. Error found: ${error}`);
        this.configOnHd = defaults;
      }
    }

    this.loadTranslation(this.configOnHd.language);
  },

  /**
   * Get the MagicMirror config file path
   * @returns {string} Absolute path to config.js
   */
  getConfigPath () {
    let configPath = path.resolve(`${__dirname}/../../config/config.js`);
    if (globalThis.configuration_file !== undefined) {
      configPath = path.resolve(`${__dirname}/../../${globalThis.configuration_file}`);
    }
    return configPath;
  },

  createRoutes () {
    this.expressApp.get("/remote.html", (request, res) => {
      if (this.template === "") {
        res.sendStatus(503);
      } else {
        res.contentType("text/html");
        res.set("Content-Security-Policy", "frame-ancestors http://*:*");
        const transformedData = this.fillTemplates(this.template);
        res.send(transformedData);
      }
    });

    this.expressApp.get("/get", (request, res) => {
      const {query} = url.parse(request.url, true);

      this.answerGet(query, res);
    });
    this.expressApp.post("/post", (request, res) => {
      const {query} = url.parse(request.url, true);

      this.answerPost(query, request, res);
    });

    this.expressApp.get("/config-help.html", (request, res) => {
      const {query} = url.parse(request.url, true);

      this.answerConfigHelp(query, res);
    });

    this.expressApp.get("/remote", (request, res) => {
      const {query} = url.parse(request.url, true);

      if (query.action && !["COMMAND"].includes(query.action)) {
        const result = this.executeQuery(query, res);
        if (result === true) {
          return;
        }
      }
      res.send({"status": "error", "reason": "unknown_command", "info": `original input: ${JSON.stringify(query)}`});
    });
  },

  capitalizeFirst (string) { return capitalizeFirst(string); },

  formatName (string) { return formatName(string); },

  /**
   * Update the list of available modules from 3rd-party repository
   * @param {boolean} force - Force re-download even if cache exists
   * @returns {void}
   */
  updateModuleList (force) {
    const downloadModules = require("./scripts/download_modules");
    downloadModules({
      force,
      callback: (result) => {
        if (result && result.startsWith("ERROR")) { Log.error(result); }
        this.readModuleData();
      }
    });
  },

  /**
   * Read and parse modules.json file
   * Populates this.modulesAvailable with ModuleData[]
   * @returns {void}
   */
  readModuleData () {
    fs.readFile(path.resolve(`${__dirname}/modules.json`), (error, data) => {
      this.modulesAvailable = JSON.parse(data.toString());

      for (const module of this.modulesAvailable) {
        module.isDefaultModule = false;
      }

      for (const [index, moduleName] of defaultModules.entries()) {
        this.modulesAvailable.push({
          name: moduleName,
          isDefaultModule: true,
          installed: true,
          maintainer: "MagicMirrorOrg",
          description: "",
          id: "MagicMirrorOrg/MagicMirror",
          url: "https://docs.magicmirror.builders/modules/introduction.html"
        });
        const module = this.modulesAvailable.at(-1);
        const modulePath = `modules/default/${moduleName}`;
        this.loadModuleDefaultConfig(module, modulePath, index === defaultModules.length - 1);
      }

      // now check for installed modules
      fs.readdir(path.resolve(`${__dirname}/..`), (error, files) => {
        const installedModules = files.filter((f) => ![
          "node_modules",
          "default",
          "README.md"
        ].includes(f));
        for (const [index, dir] of installedModules.entries()) {
          this.addModule(dir, index === installedModules.length - 1);
        }
      });
    });
  },

  /**
   * Get the modules directory path from config or use default
   * @returns {string} Modules directory path (relative or absolute)
   */
  getModuleDir () {
    return this.configOnHd.foreignModulesDir || (this.configOnHd.paths
      ? this.configOnHd.paths.modules
      : "modules");
  },

  addModule (directoryName, lastOne) {
    const modulePath = `${this.getModuleDir()}/${directoryName}`;
    fs.stat(modulePath, (error, stats) => {
      if (stats.isDirectory()) {
        let currentModule = null;
        this.modulesInstalled.push(directoryName);
        for (const module of this.modulesAvailable) {
          if (module.name === directoryName) {
            module.installed = true;
            currentModule = module;
            break;
          }
        }
        if (!currentModule) {
          const newModule = {
            name: directoryName,
            isDefaultModule: false,
            installed: true,
            maintainer: "unknown",
            description: "",
            id: `local/${directoryName}`,
            url: ""
          };
          this.modulesAvailable.push(newModule);
          currentModule = newModule;
        }
        this.loadModuleDefaultConfig(currentModule, modulePath, lastOne);

        // Check if module has changelog
        try {
          fs.accessSync(path.join(modulePath, "CHANGELOG.md"), fs.constants.F_OK);
          currentModule.hasChangelog = true;
        } catch {
          currentModule.hasChangelog = false;
        }

        // check for available updates
        try {
          fs.statSync(path.join(modulePath, ".git"));

          // Track pending update check (only for git repos)
          if (!this.pendingUpdateChecks) {
            this.pendingUpdateChecks = 0;
          }
          this.pendingUpdateChecks++;
          Log.debug(`Queuing update check for ${directoryName}, pending: ${this.pendingUpdateChecks}`);

          // Add to queue instead of executing immediately
          this.updateCheckQueue.push({
            module: currentModule,
            modulePath,
            directoryName
          });

          // Start processing queue
          this.processUpdateCheckQueue();

          if (!currentModule) {
            const sg = simpleGit(modulePath);
            sg.getRemotes(true, (error, result) => {
              if (error) {
                Log.error(error);
              }
              try {
                let baseUrl = result[0].refs.fetch;
                // replacements
                baseUrl = baseUrl.replace(".git", "").replace("github.com:", "github.com/");
                // if cloned with ssh
                currentModule.url = baseUrl.replace("git@", "https://");
              } catch (error) {
                // Something happened. Skip it.
                Log.debug(`Could not get remote URL for module ${directoryName}: ${error}`);

              }
            });
          }
        } catch {
          Log.debug(`Module ${directoryName} is not managed with git, skipping update check`);
        }
      }
    });
  },

  processUpdateCheckQueue () {
    while (this.activeUpdateChecks < this.maxParallelUpdateChecks && this.updateCheckQueue.length > 0) {
      const check = this.updateCheckQueue.shift();
      this.activeUpdateChecks++;

      // Start async check without awaiting (parallel execution)
      this.checkModuleUpdate(check);
    }
  },

  async checkModuleUpdate (check) {
    const sg = simpleGit(check.modulePath);

    try {
      await sg.fetch();
      const data = await sg.status();

      if (data.behind > 0) {
        check.module.updateAvailable = true;
        Log.info(`Module ${check.directoryName} has updates available (behind ${data.behind} commits)`);
      }
    } catch (error) {
      Log.warn(`Error checking updates for ${check.directoryName}: ${error.message || error}`);
    } finally {
      this.activeUpdateChecks--;
      this.pendingUpdateChecks--;

      Log.debug(`Finished update check for ${check.directoryName}, pending: ${this.pendingUpdateChecks}, active: ${this.activeUpdateChecks}, queued: ${this.updateCheckQueue.length}`);
      // Process next item in queue
      this.processUpdateCheckQueue();
    }
  },

  loadModuleDefaultConfig (module, modulePath, lastOne) {
    const filename = path.resolve(`${modulePath}/${module.name}.js`);

    try {
      fs.accessSync(filename, fs.constants.F_OK);

      /* Defaults are stored when Module.register is called during require(filename); */
      require(filename);
    } catch (error) {
      if (error instanceof ReferenceError) {
        Log.log(`Could not get defaults for ${module.name}. See #335.`);
      } else if (error.code === "ENOENT") {
        Log.error(`Could not find main module js file for ${module.name}`);
      } else if (error instanceof SyntaxError) {
        Log.error(`Could not validate main module js file for ${module.name}`);
        Log.error(error);
      } else {
        Log.error(`Could not load main module js file for ${module.name}. Error found: ${error}`);
      }
    }
    if (lastOne) { this.onModulesLoaded(); }
  },

  answerConfigHelp (query, res) {
    if (defaultModules.includes(query.module)) {
      // default module
      const dir = path.resolve(`${__dirname}/..`);
      const git = simpleGit(dir);
      git.revparse(["HEAD"], (error, result) => {
        if (error) {
          Log.error(error);
        }
        res.writeHead(302, {"Location": `https://github.com/MagicMirrorOrg/MagicMirror/tree/${result.trim()}/modules/default/${query.module}`});
        res.end();
      });
      return;
    }
    const modulePath = `${this.getModuleDir()}/${query.module}`;
    const git = simpleGit(modulePath);
    git.getRemotes(true, (error, result) => {
      if (error) {
        Log.error(error);
      }
      let baseUrl = result[0].refs.fetch;
      // replacements
      baseUrl = baseUrl.replace(".git", "").replace("github.com:", "github.com/");
      // if cloned with ssh
      baseUrl = baseUrl.replace("git@", "https://");
      git.revparse(["HEAD"], (error, result) => {
        if (error) {
          Log.error(error);
        }
        res.writeHead(302, {"Location": `${baseUrl}/tree/${result.trim()}`});
        res.end();
      });
    });
  },

  getConfig () {
    const config = this.configOnHd;
    for (const current of config.modules) {
      const moduleDefaultsFromRequire = Module.configDefaults[current.module];
      // We need moduleDataFromBrowser for bundled modules like MMM-RAIN-MAP. See #331.
      const moduleDataFromBrowser = this.configData.moduleData?.find((item) => item.name === current.module);

      const moduleConfig = moduleDefaultsFromRequire || moduleDataFromBrowser?.config || {};

      if (!current.config) current.config = {};
      for (const key in moduleConfig) {
        if (!(key in current.config)) {
          current.config[key] = moduleConfig[key];
        }
      }
    }
    return config;
  },

  removeDefaultValues (config) {
    // Reload default config (avoid module cache if updated during runtime)
    delete require.cache[require.resolve(`${__dirname}/../../js/defaults.js`)];
    const defaultConfig = require(`${__dirname}/../../js/defaults.js`);
    const moduleDefaultsMap = Module.configDefaults;
    const moduleDataFromBrowser = this.configData.moduleData || [];
    const cleaned = cleanConfig({
      config,
      defaultConfig,
      moduleDefaultsMap,
      moduleDataFromBrowser
    });
    if (cleaned.modules) for (const m of cleaned.modules) Log.debug(m);
    return cleaned;
  },

  findBestBackupSlot () {
    const backupHistorySize = 5;
    const backupSlots = Array.from({length: backupHistorySize - 1}, (_, index) => index + 1);

    let best = null;
    for (const slot of backupSlots) {
      const backupPath = path.resolve(`config/config.js.backup${slot}`);
      try {
        const stats = fs.statSync(backupPath);
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
  },

  async saveConfigWithBackup (configData, res, query) {
    const configPath = this.getConfigPath();
    const backupSlot = this.findBestBackupSlot();

    if (!backupSlot) {
      const error = new Error("Backing up config failed, not saving!");
      Log.error(error.message);
      this.sendResponse(res, error, {query});
      return;
    }

    const backupPath = path.resolve(`config/config.js.backup${backupSlot.slot}`);

    try {
      // Create backup using fs.promises
      await fs.promises.copyFile(configPath, backupPath);

      // Prepare and write new config
      this.configOnHd = this.removeDefaultValues(configData);

      const header = "/*************** AUTO GENERATED BY REMOTE CONTROL MODULE ***************/\n\nlet config = \n";
      const footer = "\n\n/*************** DO NOT EDIT THE LINE BELOW ***************/\nif (typeof module !== 'undefined') {module.exports = config;}\n";

      const configContent = header + inspect(this.configOnHd, {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        compact: false
      }) + footer;

      await fs.promises.writeFile(configPath, configContent);

      query.data = "config_update";
      Log.info("Saved new config!");
      Log.info(`Used backup: ${backupPath}`);
      this.sendResponse(res, undefined, {
        query,
        backup: backupPath,
        data: this.configOnHd
      });
    } catch (error) {
      query.data = "config_update";
      this.sendResponse(res, error, {
        query,
        backup: backupPath,
        data: this.configOnHd
      });
    }
  },

  /**
   * Handle POST API requests
   * @param {object} query - Query parameters
   * @param {object} request - Express request object
   * @param {object} res - Express response object
   * @returns {void}
   */
  answerPost (query, request, res) {
    if (query.data === "config") {
      this.saveConfigWithBackup(request.body, res, query);
    }
  },

  /**
   * Handle request for list of available modules
   * @param {object} query - Query parameters
   * @param {object} res - Express response object
   * @returns {void}
   */
  handleGetModuleAvailable (query, res) {
    this.modulesAvailable.sort((a, b) => a.name.localeCompare(b.name));
    this.sendResponse(res, undefined, {query, data: this.modulesAvailable});
  },

  /**
   * Handle request for list of installed modules
   * @param {object} query - Query parameters
   * @param {object} res - Express response object
   * @returns {void}
   */
  handleGetModuleInstalled (query, res) {

    // Wait for pending update checks to complete before sending response
    const startTime = Date.now();
    const maxWaitTime = 3000; // Maximum 3 seconds - first batch should be ready

    const waitForUpdateChecks = () => {
      const elapsed = Date.now() - startTime;
      const {pendingUpdateChecks, activeUpdateChecks, updateCheckQueue} = this;

      if (pendingUpdateChecks > 0 && elapsed < maxWaitTime) {
        if (elapsed % 1000 < 100) { // Log every ~1 second
          Log.debug(`Waiting for update checks: ${pendingUpdateChecks} pending, ${activeUpdateChecks} active, ${updateCheckQueue.length} queued`);
        }
        setTimeout(waitForUpdateChecks, 100);
      } else {
        if (elapsed >= maxWaitTime && pendingUpdateChecks > 0) {
          Log.info(`Sending response after ${elapsed}ms with ${pendingUpdateChecks} checks still pending (${activeUpdateChecks} active, ${updateCheckQueue.length} queued)`);
        } else {
          Log.info(`All update checks complete after ${elapsed}ms`);
        }
        const installed = this.modulesAvailable.filter((value) => value.installed && !value.isDefaultModule);
        installed.sort((a, b) => a.name.localeCompare(b.name));
        this.sendResponse(res, undefined, {query, data: installed});
      }
    };
    waitForUpdateChecks();
  },

  handleGetMmUpdateAvailable (query, res) {
    const sg = simpleGit(`${__dirname}/..`);
    sg.fetch().status((error, data) => {
      if (!error && data.behind > 0) {
        this.sendResponse(res, undefined, {query, result: true});
        return;
      }
      this.sendResponse(res, undefined, {query, result: false});
    });
  },

  handleGetClasses (query, res) {
    const thisConfig = this.getConfig().modules.find((m) => m.module === "MMM-Remote-Control")?.config || {};
    this.sendResponse(res, undefined, {
      query,
      data: thisConfig.classes || {}
    });
  },

  handleGetSaves (query, res) {
    const backupHistorySize = 5;
    const times = [];

    for (let index = backupHistorySize - 1; index > 0; index--) {
      const backupPath = path.resolve(`config/config.js.backup${index}`);
      try {
        const stats = fs.statSync(backupPath);
        times.push(stats.mtime);
      } catch (error) {
        Log.debug(`Backup ${index} does not exist: ${error}.`);
        continue;
      }
    }
    this.sendResponse(res, undefined, {query, data: times.toSorted((a, b) => b - a)});
  },

  handleGetDefaultConfig (query, res) {
    if (query.module in Module.configDefaults) {
      this.sendResponse(res, undefined, {query, data: Module.configDefaults[query.module]});
    } else {
      this.sendResponse(res, undefined, {query, data: {}});
    }
  },

  handleGetModules (query, res) {
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, {query, data: this.configData.moduleData});
    });
  },

  handleGetBrightness (query, res) {
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, {query, result: this.configData.brightness});
    });
  },

  handleGetTemp (query, res) {
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, {query, result: this.configData.temp});
    });
  },

  getDataHandlers () {
    return {
      moduleAvailable: (q, r) => this.handleGetModuleAvailable(q, r),
      moduleInstalled: (q, r) => this.handleGetModuleInstalled(q, r),
      translations: (q, r) => this.sendResponse(r, undefined, {query: q, data: this.translation}),
      mmUpdateAvailable: (q, r) => this.handleGetMmUpdateAvailable(q, r),
      config: (q, r) => this.sendResponse(r, undefined, {query: q, data: this.getConfig()}),
      classes: (q, r) => this.handleGetClasses(q, r),
      saves: (q, r) => this.handleGetSaves(q, r),
      defaultConfig: (q, r) => this.handleGetDefaultConfig(q, r),
      modules: (q, r) => this.handleGetModules(q, r),
      brightness: (q, r) => this.handleGetBrightness(q, r),
      temp: (q, r) => this.handleGetTemp(q, r),
      userPresence: (q, r) => this.sendResponse(r, undefined, {query: q, result: this.userPresence})
    };
  },

  /**
   * Handle GET API requests
   * @param {object} query - Query parameters
   * @param {string} query.data - Data type requested
   * @param {object} res - Express response object
   * @returns {void}
   */
  answerGet (query, res) {
    const handlers = this.getDataHandlers();
    const handler = handlers[query.data];

    if (handler) {
      handler(query, res);
      return;
    }

    // Unknown Command, Return Error
    this.sendResponse(res, "Unknown or Bad Command.", query);
  },

  answerGetChangelog (query, res) {
    const moduleName = query.module;
    const modulePath = `${this.getModuleDir()}/${moduleName}`;
    const changelogPath = path.join(modulePath, "CHANGELOG.md");

    try {
      const changelog = fs.readFileSync(changelogPath, "utf8");
      this.sendResponse(res, undefined, {action: "GET_CHANGELOG", changelog, module: moduleName});
    } catch {
      this.sendResponse(res, new Error("Changelog not found"), {action: "GET_CHANGELOG", query});
    }
  },

  callAfterUpdate (callback, timeout = 3000) {
    const waitObject = {
      finished: false,
      callback,
      run () {
        if (this.finished) {
          return;
        }
        this.finished = true;
        this.callback();
      }
    };

    this.waiting.push(waitObject);
    this.sendSocketNotification("UPDATE");
    setTimeout(() => waitObject.run(), timeout);
  },

  delayedQuery (query, res) {
    if (query.did in this.delayedQueryTimers) {
      clearTimeout(this.delayedQueryTimers[query.did]);
      delete this.delayedQueryTimers[query.did];
    }
    if (!query.abort) {
      this.delayedQueryTimers[query.did] = setTimeout(() => {
        this.executeQuery(query.query);
        delete this.delayedQueryTimers[query.did];
      }, ("timeout" in query
        ? query.timeout
        : 10) * 1000);
    }
    this.sendResponse(res, undefined, query);
  },

  sendResponse (res, error, data) {
    let response = {success: true};
    let status = 200;
    let result = true;
    if (error) {
      Log.error(error);
      response = {success: false, status: "error", reason: "unknown", info: error};
      status = 400;
      result = false;
    }
    if (data) {
      response = {...response, ...data};
    }
    if (res) {
      if ("isSocket" in res && res.isSocket) {
        this.sendSocketNotification("REMOTE_ACTION_RESULT", response);
      } else {
        res.status(status).json(response);
      }
    }
    return result;
  },

  monitorControl (action, options, res) {
    let status = "unknown";
    const offArray = new Set([
      "false",
      "TV is off",
      "standby",
      "display_power=0"
    ]);
    const monitorOnCommand = this.initialized && "monitorOnCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.monitorOnCommand
      : "vcgencmd display_power 1";
    const monitorOffCommand = this.initialized && "monitorOffCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.monitorOffCommand
      : "vcgencmd display_power 0";
    const monitorStatusCommand = this.initialized && "monitorStatusCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.monitorStatusCommand
      : "vcgencmd display_power -1";
    switch (action) {
      case "MONITORSTATUS": exec(monitorStatusCommand, options, (error, stdout, stderr) => {
        status = offArray.has(stdout.trim())
          ? "off"
          : "on";
        this.checkForExecError(error, stdout, stderr, res, {monitor: status});

      });
        break;

      case "MONITORTOGGLE": exec(monitorStatusCommand, options, (error, stdout) => {
        status = offArray.has(stdout.trim())
          ? "off"
          : "on";
        if (status === "on") { this.monitorControl("MONITOROFF", options, res); } else { this.monitorControl("MONITORON", options, res); }

      });
        break;

      case "MONITORON": exec(monitorOnCommand, options, (error, stdout, stderr) => {
        this.checkForExecError(error, stdout, stderr, res, {monitor: "on"});
      });
        this.sendSocketNotification("USER_PRESENCE", true);
        break;

      case "MONITOROFF": exec(monitorOffCommand, options, (error, stdout, stderr) => {
        this.checkForExecError(error, stdout, stderr, res, {monitor: "off"});
      });
        this.sendSocketNotification("USER_PRESENCE", false);
        break;

    }
  },

  shutdownControl (action, options, res) {
    const shutdownCommand = this.initialized && "shutdownCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.shutdownCommand
      : "sudo shutdown -h now";
    const rebootCommand = this.initialized && "rebootCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.rebootCommand
      : "sudo shutdown -r now";
    if (action === "SHUTDOWN") {
      this.sendResponse(res, undefined, {action: "SHUTDOWN", info: "Shutting down system..."});
      Log.log(`Executing shutdown command: ${shutdownCommand}`);
      exec(shutdownCommand, options, (error, stdout, stderr) => {
        if (error) {
          // Check for sudo password requirement
          if (error.killed && error.signal === "SIGTERM") {
            Log.error("Shutdown failed: System requires password for shutdown.");
            Log.error("See setup guide: https://github.com/Jopyth/MMM-Remote-Control#faq");
            return;
          }
          Log.error(`Shutdown error: ${stderr || error.message}`);
        } else {
          Log.log("Shutdown command executed successfully - system should be shutting down...");
        }
      });
    }
    if (action === "REBOOT") {
      this.sendResponse(res, undefined, {action: "REBOOT", info: "Rebooting system..."});
      Log.log(`Executing reboot command: ${rebootCommand}`);
      exec(rebootCommand, options, (error, stdout, stderr) => {
        if (error) {
          // Check for sudo password requirement
          if (error.killed && error.signal === "SIGTERM") {
            Log.error("Reboot failed: System requires password for reboot.");
            Log.error("See setup guide: https://github.com/Jopyth/MMM-Remote-Control#faq");
            return;
          }
          Log.error(`Reboot error: ${stderr || error.message}`);
        } else {
          Log.log("Reboot command executed successfully - system should be rebooting...");
        }
      });
    }
  },

  handleShowAlert (query, res) {
    this.sendResponse(res);

    const type = query.type || "alert";
    const title = query.title || "Note";
    const message = query.message || "Attention!";
    const timer = query.timer || 4;

    this.sendSocketNotification(query.action, {
      type,
      title,
      message,
      timer: timer * 1000
    });
  },

  /**
   * Sends custom notification to MagicMirror modules.
   * Attempts to parse JSON string payloads, falls back to raw string on error.
   * @param {object} query - Query with notification name and optional payload
   * @param {string} query.notification - Notification name to broadcast
   * @param {object|string|number|boolean|null} query.payload - Payload (object, JSON string, or primitive)
   * @param {object} res - Express response object
   * @returns {boolean} Always true (errors are handled internally)
   */
  handleNotification (query, res) {
    try {
      let payload = {}; // Assume empty JSON-object if no payload is provided
      if (query.payload === undefined) {
        payload = query.payload;
      } else if (typeof query.payload === "object") {
        payload = query.payload;
      } else if (typeof query.payload === "string") {
        payload = query.payload.startsWith("{") ? JSON.parse(query.payload) : query.payload;
      }
      this.sendSocketNotification(query.action, {"notification": query.notification, payload});
      this.sendResponse(res);
      return true;
    } catch (error) {

      /*
       * JSON parse errors are expected when users provide invalid input.
       * Only log as debug, not as error.
       */
      if (error instanceof SyntaxError) {
        Log.debug(`Invalid JSON payload: ${error.message}`);
      } else {
        Log.error(error);
      }
      this.sendResponse(res, error, {reason: error.message});
      return true;
    }
  },

  handleManageClasses (query, res) {
    if (query.payload && query.payload.classes && this.thisConfig && this.thisConfig.classes) {
      const classes = [];
      switch (typeof query.payload.classes) {
        case "string": classes.push(this.thisConfig.classes[query.payload.classes]); break;

        case "object": for (const t of query.payload.classes) classes.push(this.thisConfig.classes[t]);

      }
      for (const cl of classes) {
        for (const act in cl) {
          if ([
            "SHOW",
            "HIDE",
            "TOGGLE"
          ].includes(act.toUpperCase())) {
            if (typeof cl[act] === "string") {
              this.sendSocketNotification(act.toUpperCase(), {module: cl[act]});
            } else {
              for (const t of cl[act]) {
                this.sendSocketNotification(act.toUpperCase(), {module: t});
              }
            }
          }
        }
      }
    }
    this.sendResponse(res);
  },

  handleElectronActions (query, res) {
    try {
      const electron = require("electron").BrowserWindow;
      if (!electron) { throw "Could not get Electron window instance."; }
      const win = electron.getAllWindows()[0];
      switch (query.action) {
        case "MINIMIZE":
          win.minimize();
          break;

        case "TOGGLEFULLSCREEN":
          win.setFullScreen(!win.isFullScreen());
          break;

        case "DEVTOOLS":
          if (win.webContents.isDevToolsOpened()) { win.webContents.closeDevTools(); } else { win.webContents.openDevTools(); }
          break;

        default:
      }
      this.sendResponse(res);
    } catch (error) {
      this.sendResponse(res, error);
    }
  },

  handleRestart (query, res) {
    try {
      const {app} = require("electron");
      if (!app) { throw "Could not get Electron app instance."; }
      this.sendResponse(res, undefined, {action: "RESTART", info: "Restarting Electron..."});
      app.relaunch();
      app.quit();
    } catch (error) {
      // Electron not available (server mode) - exit cleanly and let process manager restart
      Log.log(`Electron not available (${error?.message || "server mode"}), exiting process for restart by process manager...`);
      this.sendResponse(res, undefined, {action: "RESTART", info: "Exiting process for restart..."});

      // Wait for response to be sent before exiting
      if (res && res.on) {
        res.on("finish", () => {
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(0);
        });
      } else {
        // Fallback if res doesn't have event emitter (socket response)
        // eslint-disable-next-line unicorn/no-process-exit
        setTimeout(() => process.exit(0), 1000);
      }
    }
  },

  handleStop (query, res) {
    Log.log("Stopping MagicMirror...");
    this.sendResponse(res, undefined, {action: "STOP", info: "Stopping process..."});

    // Wait for response to be sent before exiting
    if (res && res.on) {
      res.on("finish", () => {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
      });
    } else {
      // Fallback if res doesn't have event emitter (socket response)
      // eslint-disable-next-line unicorn/no-process-exit
      setTimeout(() => process.exit(1), 1000);
    }
  },

  handleCommand (query, res) {
    const options = {timeout: 15_000};
    if (this.thisConfig.customCommand && this.thisConfig.customCommand[query.command]) {
      exec(this.thisConfig.customCommand[query.command], options, (error, stdout, stderr) => {
        this.checkForExecError(error, stdout, stderr, res, {stdout});
      });
    } else {
      this.sendResponse(res, new Error("Command not found"), query);
    }
  },

  handleUserPresence (query, res) {
    this.sendSocketNotification("USER_PRESENCE", query.value);
    this.userPresence = query.value;
    this.sendResponse(res, undefined, query);
  },

  /**
   * Forwards action to frontend without validation.
   * Used for SHOW/HIDE/TOGGLE - frontend filters invalid/missing module parameters.
   * @param {object} query - Query object containing action and optional module identifier
   * @param {object} res - Express response object or socket placeholder
   */
  handleSimpleSocketNotification (query, res) {
    this.sendSocketNotification(query.action, query);
    this.sendResponse(res);
  },

  handleSimpleValueNotification (query, res) {
    this.sendResponse(res);
    this.sendSocketNotification(query.action, query.value);
  },

  handleSimpleNotification (query, res) {
    this.sendResponse(res);
    this.sendSocketNotification(query.action);
  },

  handleSave (query, res) {
    this.sendResponse(res);
    this.callAfterUpdate(() => { this.saveDefaultSettings(); });
  },

  handleModuleData (query, res) {
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, this.configData);
    });
  },

  handleDelayed (query, res) {

    /*
     * Expects a nested query object
     *   {
     *       action: "DELAYED",
     *       did: "SOME_UNIQUE_ID",
     *       timeout: 10000,  // Optional; Default 10000ms
     *       abort: false, // Optional; send to cancel
     *       query: {
     *           action: "SHOW_ALERT",
     *           title: "Delayed Alert!",
     *           message: "This is a delayed alert test."
     *       }
     *   }
     * Resending with same ID resets delay, unless abort:true
     */
    this.delayedQuery(query, res);
  },

  getActionHandlers () {
    const options = {timeout: 15_000};
    return {
      GET_CHANGELOG: (q, r) => this.answerGetChangelog(q, r),
      SHUTDOWN: (q, r) => this.shutdownControl(q.action, options, r),
      REBOOT: (q, r) => this.shutdownControl(q.action, options, r),
      RESTART: (q, r) => this.handleRestart(q, r),
      STOP: (q, r) => this.handleStop(q, r),
      COMMAND: (q, r) => this.handleCommand(q, r),
      USER_PRESENCE: (q, r) => this.handleUserPresence(q, r),
      MONITORON: (q, r) => this.monitorControl(q.action, options, r),
      MONITOROFF: (q, r) => this.monitorControl(q.action, options, r),
      MONITORTOGGLE: (q, r) => this.monitorControl(q.action, options, r),
      MONITORSTATUS: (q, r) => this.monitorControl(q.action, options, r),
      HIDE: (q, r) => this.handleSimpleSocketNotification(q, r),
      SHOW: (q, r) => this.handleSimpleSocketNotification(q, r),
      TOGGLE: (q, r) => this.handleSimpleSocketNotification(q, r),
      BRIGHTNESS: (q, r) => this.handleSimpleValueNotification(q, r),
      TEMP: (q, r) => this.handleSimpleValueNotification(q, r),
      SAVE: (q, r) => this.handleSave(q, r),
      MODULE_DATA: (q, r) => this.handleModuleData(q, r),
      INSTALL: (q, r) => this.installModule(q.url, r, q),
      REFRESH: (q, r) => this.handleSimpleNotification(q, r),
      HIDE_ALERT: (q, r) => this.handleSimpleNotification(q, r),
      SHOW_ALERT: (q, r) => this.handleShowAlert(q, r),
      UPDATE: (q, r) => this.updateModule(decodeURI(q.module), r),
      NOTIFICATION: (q, r) => this.handleNotification(q, r),
      MANAGE_CLASSES: (q, r) => this.handleManageClasses(q, r),
      MINIMIZE: (q, r) => this.handleElectronActions(q, r),
      TOGGLEFULLSCREEN: (q, r) => this.handleElectronActions(q, r),
      DEVTOOLS: (q, r) => this.handleElectronActions(q, r),
      DELAYED: (q, r) => this.handleDelayed(q, r)
    };
  },

  executeQuery (query, res) {
    const handlers = this.getActionHandlers();
    const handler = handlers[query.action];

    if (handler) {
      handler(query, res);
      return true;
    }

    this.sendResponse(res, new Error(`Invalid Option: ${query.action}`));
    return false;
  },

  /**
   * Install a module from a git repository
   * @param {string} url - Git repository URL
   * @param {object} res - Express response object
   * @param {object} data - Additional installation data
   * @returns {void}
   */
  installModule (url, res, data) {

    simpleGit(path.resolve(`${__dirname}/..`)).clone(url, path.basename(url), (error) => {
      if (error) {
        Log.error(error);
        this.sendResponse(res, error);
      } else {
        const workDir = path.resolve(`${__dirname}/../${path.basename(url)}`);
        const packageJsonExists = fs.existsSync(`${workDir}/package.json`);
        if (packageJsonExists) {
          const packageJson = JSON.parse(fs.readFileSync(`${workDir}/package.json`, "utf8"));
          const installNecessary = packageJson.dependencies || packageJson.scripts?.preinstall || packageJson.scripts?.postinstall;
          if (installNecessary) {
            const packageLockExists = fs.existsSync(`${workDir}/package-lock.json`);
            const command = packageLockExists
              ? "npm ci --omit=dev"
              : "npm install --omit=dev";

            exec(command, {cwd: workDir, timeout: 120_000}, (error, stdout, stderr) => {
              if (error) {
                Log.error(error);
                this.sendResponse(res, error, {stdout, stderr, ...data});
              } else {
                // success part
                this.readModuleData();
                this.sendResponse(res, undefined, {stdout, ...data});
              }
            });
          } else {
            // Module has package.json but no dependencies/install scripts
            this.readModuleData();
            this.sendResponse(res, undefined, {stdout: "Module installed (no dependencies).", ...data});
          }
        } else {
          this.readModuleData();
          this.sendResponse(res, undefined, {stdout: "Module installed.", ...data});
        }
      }
    });
  },

  async updateModule (module, res) {
    Log.log(`UPDATE ${module || "MagicMirror"}`);

    let modulePath = `${__dirname}/../../`;
    let name = "MM";

    if (module && module !== "undefined") {
      const moduleData = this.modulesAvailable?.find((m) => m.name === module);
      if (!moduleData) {
        this.sendResponse(res, new Error("Unknown Module"), {info: module});
        return;
      }

      modulePath = `${__dirname}/../${moduleData.name}`;
      name = moduleData.name;
    }

    Log.log(`path: ${modulePath} name: ${name}`);

    const git = simpleGit(modulePath);
    const execPromise = promisify(exec);

    try {
      await git.fetch();

      // Check if there are changes before resetting
      const status = await git.status();
      const hasUpdates = status.behind > 0;

      if (!hasUpdates) {
        this.sendResponse(res, undefined, {code: "up-to-date", info: `${name} already up to date.`});
        return;
      }

      // Reset to remote and pull
      await git.reset(["--hard", "FETCH_HEAD"]);
      await git.pull(["--ff-only"]);

      // Changes detected, reload module data
      this.readModuleData();

      // Check if npm install is needed
      const packageJsonPath = `${modulePath}/package.json`;
      if (!fs.existsSync(packageJsonPath)) {
        this.sendUpdateResponseWithChangelog(res, modulePath, name);
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const needsInstall = packageJson.dependencies || packageJson.scripts?.preinstall || packageJson.scripts?.postinstall;

      if (!needsInstall) {
        this.sendUpdateResponseWithChangelog(res, modulePath, name);
        return;
      }

      // Run npm install
      const packageLockExists = fs.existsSync(`${modulePath}/package-lock.json`);
      const command = packageLockExists ? "npm ci --omit=dev" : "npm install --omit=dev";

      try {
        await execPromise(command, {cwd: modulePath, timeout: 120_000});
        this.sendUpdateResponseWithChangelog(res, modulePath, name);
      } catch (error) {
        Log.error(error);
        this.sendResponse(res, error, {stdout: error.stdout, stderr: error.stderr});
      }
    } catch (error) {
      Log.warn(`Error updating ${name}: ${error.message || error}`);
      this.sendResponse(res, error);
    }
  },

  sendUpdateResponseWithChangelog (res, modulePath, name) {
    const changelogPath = `${modulePath}/CHANGELOG.md`;
    const response = {code: "restart", info: `${name} updated.`};

    if (fs.existsSync(changelogPath)) {
      response.chlog = fs.readFileSync(changelogPath, "utf8");
    }

    this.sendResponse(res, undefined, response);
  },

  checkForExecError (error, stdout, stderr, res, data) {
    if (error) { Log.error(stderr); }
    this.sendResponse(res, error, data);
  },

  translate (data) {
    for (const t of Object.keys(this.translation)) {
      const pattern = `%%TRANSLATE:${t}%%`;
      const re = new RegExp(pattern, "g");
      data = data.replace(re, this.translation[t]);
    }
    return data;
  },

  saveDefaultSettings () {
    const {moduleData} = this.configData;
    const simpleModuleData = moduleData.map((moduleDatum) => ({
      identifier: moduleDatum.identifier,
      hidden: moduleDatum.hidden,
      lockStrings: moduleDatum.lockStrings,
      urlPath: moduleDatum.urlPath
    }));

    const text = JSON.stringify({
      moduleData: simpleModuleData,
      brightness: this.configData.brightness,
      temp: this.configData.temp,
      settingsVersion: this.configData.settingsVersion
    });

    fs.writeFile(path.resolve(`${__dirname}/settings.json`), text, (error) => {
      if (error) {
        throw error;
      }
    });
  },

  in (pattern, string) { return includes(pattern, string); },

  loadDefaultSettings () {

    fs.readFile(path.resolve(`${__dirname}/settings.json`), (error, data) => {
      if (error) {
        if (this.in("no such file or directory", error.message)) {
          return;
        }
        Log.error(error);
      } else {
        data = JSON.parse(data.toString());
        this.sendSocketNotification("DEFAULT_SETTINGS", data);
      }
    });
  },

  fillTemplates (data) {
    data = this.translate(data);
    // Replace config path placeholder
    const configPath = globalThis.configuration_file === undefined
      ? "config/config.js"
      : globalThis.configuration_file;
    data = data.replaceAll("%%CONFIG_PATH%%", configPath);
    return data;
  },

  loadTranslation (language) {

    fs.readFile(path.resolve(`${__dirname}/translations/${language}.json`), (error, data) => {
      if (error) {
        return;
      } else {
        this.translation = {...this.translation, ...JSON.parse(data.toString())};
      }
    });
  },

  loadCustomMenus () {
    if ("customMenu" in this.thisConfig) {
      const menuPath = path.resolve(`${__dirname}/../../config/${this.thisConfig.customMenu}`);
      if (!fs.existsSync(menuPath)) {
        Log.log(`customMenu requested, but file:${menuPath} was not found.`);
        return;
      }
      fs.readFile(menuPath, (error, data) => {
        if (error) {
          Log.error(`Error reading custom menu: ${error}`);
          return;
        } else {
          this.customMenu = {...this.customMenu, ...JSON.parse(this.translate(data.toString()))};
          this.sendSocketNotification("REMOTE_CLIENT_CUSTOM_MENU", this.customMenu);
        }
      });
    }
  },

  getIpAddresses () {
    // module started, answer with current IP address
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === "IPv4" && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    return addresses;
  },

  /**
   * Handle socket notifications from the frontend module
   * @param {string} notification - Notification type
   * @param {object | ConfigData} payload - Notification payload (varies by type)
   * @returns {void}
   */
  socketNotificationReceived (notification, payload) {

    if (notification === "CURRENT_STATUS") {
      this.configData = payload;
      this.thisConfig = payload.remoteConfig;
      if (this.initialized) {
        for (const o of this.waiting) { o.run(); }
        this.waiting = [];
      } else {
        // Do anything else required to initialize
        this.initialized = true;
      }
    }
    if (notification === "REQUEST_DEFAULT_SETTINGS") {
      // module started, answer with current ip addresses
      this.sendSocketNotification("IP_ADDRESSES", this.getIpAddresses());
      this.sendSocketNotification("LOAD_PORT", this.configOnHd.port || "");
      // check if we have got saved default settings
      this.loadDefaultSettings();
    }
    if (notification === "GENERATE_QR_CODE") {
      this.generateQRCode(payload);
    }
    if (notification === "REMOTE_ACTION") {
      if ("action" in payload) {
        this.executeQuery(payload, {isSocket: true});
      } else if ("data" in payload) {
        this.answerGet(payload, {isSocket: true});
      }
    }
    if (notification === "UNDO_CONFIG") {
      const backupHistorySize = 5;
      let iteration = -1;

      for (let index = backupHistorySize - 1; index > 0; index--) {
        const backupPath = path.resolve(`config/config.js.backup${index}`);
        try {
          const stats = fs.statSync(backupPath);
          if (stats.mtime.toISOString() == payload) {
            iteration = index;
            index = -1;
          }
        } catch (error) {
          Log.debug(`Backup ${index} does not exist: ${error}.`);
          continue;
        }
      }
      if (iteration < 0) {
        this.answerGet({data: "saves"}, {isSocket: true});
        return;
      }
      const backupPath = path.resolve(`config/config.js.backup${iteration}`);
      const request = require(backupPath);

      this.answerPost({data: "config"}, {body: request}, {isSocket: true});
    }
    if (notification === "NEW_CONFIG") {
      this.answerPost({data: "config"}, {body: payload}, {isSocket: true});
    }
    if (notification === "REMOTE_CLIENT_CONNECTED") {
      this.sendSocketNotification("REMOTE_CLIENT_CONNECTED");
      this.loadCustomMenus();
      if ("id" in this.moduleApiMenu) {
        this.sendSocketNotification("REMOTE_CLIENT_MODULEAPI_MENU", this.moduleApiMenu);
      }
    }
    if (notification === "REMOTE_NOTIFICATION_ECHO_IN") {
      this.sendSocketNotification("REMOTE_NOTIFICATION_ECHO_OUT", payload);
    }
    if (notification === "USER_PRESENCE") {
      this.userPresence = payload;
    }

    /* API EXTENSION -- added v2.0.0 */
    if (notification === "REGISTER_API" && "module" in payload) {
      if ("actions" in payload && Object.keys(payload.actions).length > 0) {
        this.externalApiRoutes[payload.module] = payload;
      } else {
        // Blank actions means the module has requested to be removed from API
        delete this.externalApiRoutes[payload.module];
      }
      this.updateModuleApiMenu();
    }
  },

  /**
   * Generate QR code as data URL
   * @param {object} payload - Object with url and size properties
   */
  async generateQRCode (payload) {
    try {
      const QRCode = require("qrcode");
      const dataUrl = await QRCode.toDataURL(payload.url, {
        width: payload.size,
        margin: 1,
        color: {
          dark: "#FFFFFF",
          light: "#00000000"
        }
      });
      this.sendSocketNotification("QR_CODE_GENERATED", dataUrl);
    } catch (error) {
      Log.error(`QR Code generation failed: ${error}`);
      this.sendSocketNotification("QR_CODE_ERROR", error.message);
    }
  },
  ...require("./API/api.js")
});
