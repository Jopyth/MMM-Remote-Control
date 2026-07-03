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
const simpleGit = require("simple-git");

let defaultModules;
let defaultModulesPath;
try {
  // Try new path first (MM >= 2.35.0)
  defaultModulesPath = path.resolve(`${__dirname}/../../defaultmodules/defaultmodules.js`);
  defaultModules = require(defaultModulesPath);
} catch {
  try {

    /*
     * TODO: Remove this fallback to old path in 2027 (MM < 2.35.0)
     * Fallback to old path (MM < 2.35.0)
     */
    defaultModulesPath = path.resolve(`${__dirname}/../../modules/default/defaultmodules.js`);
    defaultModules = require(defaultModulesPath);
  } catch {
    // Fallback for test environment or standalone usage
    defaultModulesPath = "./tests/shims/defaultmodules.js";
    defaultModules = require(defaultModulesPath);
  }
}
const {includes} = require("./lib/utils.js");
const configManager = require("./lib/configManager.js");
const moduleManager = require("./lib/moduleManager.js");
const systemControl = require("./lib/systemControl.js");

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

    const result = configManager.combineConfig(__dirname, (language) => this.loadTranslation(language));
    this.configOnHd = result.configOnHd;
    this.thisConfig = result.thisConfig;
    this.updateModuleList();
    this.createRoutes();

    /* API EXTENSION - Added v2.0.0 */
    this.externalApiRoutes = {};
    this.moduleApiMenu = {};
    this.customMenu = {};
    this.createApiRoutes();
  },

  stop () {
    // Clear all timeouts for clean shutdown
    for (const value of Object.values(this.delayedQueryTimers)) {
      clearTimeout(value);
    }
  },

  onModulesLoaded () {

    /* CALLED AFTER MODULES AND CONFIG DATA ARE LOADED */
    /* API EXTENSION - Added v2.0.0 */
    this.getExternalApiByGuessing();

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

  createRoutes () {
    this.expressApp.get("/remote-service-worker.js", (request, response) => {
      response.set("Cache-Control", "no-cache");
      response.contentType("application/javascript");
      response.sendFile(path.resolve(`${__dirname}/service-worker.js`));
    });

    this.expressApp.get("/remote.html", (request, response) => {
      if (this.template === "") {
        response.sendStatus(503);
      } else {
        response.contentType("text/html");
        response.set("Content-Security-Policy", "frame-ancestors http://*:*");
        const transformedData = this.fillTemplates(this.template);
        response.send(transformedData);
      }
    });

    this.expressApp.get("/get", (request, response) => {
      const {query} = request;

      this.answerGet(query, response);
    });
    this.expressApp.post("/post", (request, response) => {
      const {query} = request;

      this.answerPost(query, request, response);
    });

    this.expressApp.get("/config-help.html", (request, response) => {
      const {query} = request;

      this.answerConfigHelp(query, response);
    });

    this.expressApp.get("/remote", (request, response) => {
      const {query} = request;

      if (query.action && !["COMMAND"].includes(query.action)) {
        const result = this.executeQuery(query, response);
        if (result === true) {
          return;
        }
      }
      response.send({"status": "error", "reason": "unknown_command", "info": `original input: ${JSON.stringify(query)}`});
    });
  },

  /**
   * Update the list of available modules from 3rd-party repository
   * @param {boolean} force - Force re-download even if cache exists
   * @returns {void}
   */
  updateModuleList (force) {
    moduleManager.updateModuleList({
      force,
      callback: (result) => {
        if (result?.startsWith("ERROR")) {
          Log.error(result);
        }
        this.readModuleData();
      }
    });
  },

  /**
   * Read and parse modules.json file
   * Populates this.modulesAvailable with ModuleData[]
   * @returns {Promise<void>}
   */
  async readModuleData () {
    try {
      const result = await moduleManager.readModuleData(
        __dirname,
        this.getModuleDir(),
        async (module, modulePath) => {
          await this.loadModuleDefaultConfig(module, modulePath, false);
        }
      );

      this.modulesAvailable = result.modulesAvailable;
      this.modulesInstalled = result.modulesInstalled;

      // Process installed modules
      for (const [index, directory] of result.installedModules.entries()) {
        await this.addModule(directory, index === result.installedModules.length - 1);
      }
    } catch (error) {
      Log.error(`Error reading module data: ${error.message || error}`);
    }
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

  async addModule (directoryName, lastOne) {
    await moduleManager.addModule({
      directoryName,
      modulesDirectory: this.getModuleDir(),
      modulesAvailable: this.modulesAvailable,
      modulesInstalled: this.modulesInstalled,
      onModuleLoaded: (module, modulePath) => {
        this.loadModuleDefaultConfig(module, modulePath, lastOne);
      },
      onUpdateCheckQueued: (check) => {
        // Track pending update check
        if (!this.pendingUpdateChecks) {
          this.pendingUpdateChecks = 0;
        }
        this.pendingUpdateChecks++;
        Log.debug(`Queuing update check for ${check.directoryName}, pending: ${this.pendingUpdateChecks}`);

        // Add to queue
        this.updateCheckQueue.push(check);

        // Start processing queue
        this.processUpdateCheckQueue();
      },
      isLast: lastOne
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
    try {
      await moduleManager.checkModuleUpdate(check);
    } finally {
      this.activeUpdateChecks--;
      this.pendingUpdateChecks--;

      Log.debug(`Finished update check for ${check.directoryName}, pending: ${this.pendingUpdateChecks}, active: ${this.activeUpdateChecks}, queued: ${this.updateCheckQueue.length}`);
      // Process next item in queue
      this.processUpdateCheckQueue();
    }
  },

  async loadModuleDefaultConfig (module, modulePath, lastOne) {
    try {
      await moduleManager.loadModuleDefaultConfig(module, modulePath);
    } catch (error) {
      if (error instanceof ReferenceError) {
        Log.log(`Could not get defaults for ${module.name}. See #335.`);
      } else if (error.code === "MODULE_NOT_FOUND" || error.code === "ENOENT") {
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

  answerConfigHelp (query, response) {
    if (defaultModules.includes(query.module)) {
      // default module
      const moduleDirectory = path.resolve(`${__dirname}/..`);
      const git = simpleGit(moduleDirectory);
      git.revparse(["HEAD"], (error, result) => {
        if (error) {
          Log.error(error);
        }

        /*
         * TODO: Remove old path support in 2027 (MM < 2.35.0)
         * Use appropriate path based on MM version (new: defaultmodules, old: modules/default)
         */
        const githubPath = defaultModulesPath.includes("defaultmodules/defaultmodules.js")
          ? "defaultmodules"
          : "modules/default";
        response.writeHead(302, {"Location": `https://github.com/MagicMirrorOrg/MagicMirror/tree/${result.trim()}/${githubPath}/${query.module}`});
        response.end();
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
      // Normalize remote URLs like git@github.com:owner/repo.git to https://github.com/owner/repo
      baseUrl = baseUrl.replace(/^git@/u, "https://");
      baseUrl = baseUrl.replace(/^https:\/\/github\.com:/u, "https://github.com/");
      baseUrl = baseUrl.replace(/\.git$/u, "");
      git.revparse(["HEAD"], (error, result) => {
        if (error) {
          Log.error(error);
        }
        response.writeHead(302, {"Location": `${baseUrl}/tree/${result.trim()}`});
        response.end();
      });
    });
  },

  /**
   * Handle POST API requests
   * @param {object} query - Query parameters
   * @param {object} request - Express request object
   * @param {object} response - Express response object
   * @returns {void}
   */
  async answerPost (query, request, response) {
    if (query.data === "config") {
      await this.saveConfigWithBackup(request.body, response, query);
    }
  },

  async saveConfigWithBackup (configData, response, query) {
    const configPath = configManager.getConfigPath(__dirname);
    const backupSlot = await configManager.findBestBackupSlot();

    if (!backupSlot) {
      const error = new Error("Backing up config failed, not saving!");
      Log.error(error.message);
      this.sendResponse(response, error, {query});
      return;
    }

    const backupPath = path.resolve(`config/config.js.backup${backupSlot.slot}`);

    try {
      await fs.promises.copyFile(configPath, backupPath);

      this.configOnHd = configManager.removeDefaultValues(__dirname, configData, this.configData);

      const header = "/*************** AUTO GENERATED BY REMOTE CONTROL MODULE ***************/\n\nlet config = \n";
      const footer = "\n\n/*************** DO NOT EDIT THE LINE BELOW ***************/\nif (typeof module !== 'undefined') {module.exports = config;}\n";
      const {inspect} = require("node:util");

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
      this.sendResponse(response, undefined, {
        query,
        backup: backupPath,
        data: this.configOnHd
      });
    } catch (error) {
      query.data = "config_update";
      this.sendResponse(response, error, {
        query,
        backup: backupPath,
        data: this.configOnHd
      });
    }
  },

  /**
   * Handle request for list of available modules
   * @param {object} query - Query parameters
   * @param {object} response - Express response object
   * @returns {void}
   */
  handleGetModuleAvailable (query, response) {
    this.modulesAvailable.sort((a, b) => a.name.localeCompare(b.name));
    this.sendResponse(response, undefined, {query, data: this.modulesAvailable});
  },

  /**
   * Handle request for list of installed modules
   * @param {object} query - Query parameters
   * @param {object} response - Express response object
   * @returns {void}
   */
  handleGetModuleInstalled (query, response) {

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
        this.sendResponse(response, undefined, {query, data: installed});
      }
    };
    waitForUpdateChecks();
  },

  handleGetMmUpdateAvailable (query, response) {
    const sg = simpleGit(`${__dirname}/..`);
    sg.fetch().status((error, data) => {
      if (!error && data.behind > 0) {
        this.sendResponse(response, undefined, {query, result: true});
        return;
      }
      this.sendResponse(response, undefined, {query, result: false});
    });
  },

  handleGetClasses (query, response) {
    const config = configManager.getConfig(this.configOnHd, this.configData);
    const thisConfig = config.modules.find((m) => m.module === "MMM-Remote-Control")?.config || {};
    this.sendResponse(response, undefined, {
      query,
      data: thisConfig.classes || {}
    });
  },

  async handleGetSaves (query, response) {
    const backupHistorySize = 5;
    const times = [];

    for (let index = backupHistorySize - 1; index > 0; index--) {
      const backupPath = path.resolve(`config/config.js.backup${index}`);
      try {
        const stats = await fs.promises.stat(backupPath);
        times.push(stats.mtime);
      } catch (error) {
        Log.debug(`Backup ${index} does not exist: ${error}.`);
        continue;
      }
    }
    this.sendResponse(response, undefined, {query, data: times.toSorted((a, b) => b - a)});
  },

  handleGetDefaultConfig (query, response) {
    if (Object.hasOwn(Module.configDefaults, query.module)) {
      this.sendResponse(response, undefined, {query, data: Module.configDefaults[query.module]});
    } else {
      this.sendResponse(response, undefined, {query, data: {}});
    }
  },

  handleGetModules (query, response) {
    this.requireLiveState(response, () => {
      this.sendResponse(response, undefined, {query, data: this.configData.moduleData});
    });
  },

  handleGetBrightness (query, response) {
    this.requireLiveState(response, () => {
      this.sendResponse(response, undefined, {query, result: this.configData.brightness});
    });
  },

  handleGetTemp (query, response) {
    this.requireLiveState(response, () => {
      this.sendResponse(response, undefined, {query, result: this.configData.temp});
    });
  },

  handleGetZoom (query, response) {
    this.requireLiveState(response, () => {
      this.sendResponse(response, undefined, {query, result: this.configData.zoom});
    });
  },

  handleGetBackgroundColor (query, response) {
    this.requireLiveState(response, () => {
      this.sendResponse(response, undefined, {query, result: this.configData.backgroundColor});
    });
  },

  handleGetFontColor (query, response) {
    this.requireLiveState(response, () => {
      this.sendResponse(response, undefined, {query, result: this.configData.fontColor});
    });
  },

  getDataHandlers () {
    return {
      moduleAvailable: (q, r) => this.handleGetModuleAvailable(q, r),
      moduleInstalled: (q, r) => this.handleGetModuleInstalled(q, r),
      translations: (q, r) => this.sendResponse(r, undefined, {query: q, data: this.translation}),
      mmUpdateAvailable: (q, r) => this.handleGetMmUpdateAvailable(q, r),
      config: (q, r) => this.sendResponse(r, undefined, {query: q, data: configManager.getConfig(this.configOnHd, this.configData)}),
      classes: (q, r) => this.handleGetClasses(q, r),
      saves: (q, r) => this.handleGetSaves(q, r),
      defaultConfig: (q, r) => this.handleGetDefaultConfig(q, r),
      modules: (q, r) => this.handleGetModules(q, r),
      brightness: (q, r) => this.handleGetBrightness(q, r),
      temp: (q, r) => this.handleGetTemp(q, r),
      zoom: (q, r) => this.handleGetZoom(q, r),
      backgroundColor: (q, r) => this.handleGetBackgroundColor(q, r),
      fontColor: (q, r) => this.handleGetFontColor(q, r),
      userPresence: (q, r) => this.sendResponse(r, undefined, {query: q, result: this.userPresence})
    };
  },

  /**
   * Handle GET API requests
   * @param {object} query - Query parameters
   * @param {string} query.data - Data type requested
   * @param {object} response - Express response object
   * @returns {void}
   */
  answerGet (query, response) {
    const handlers = this.getDataHandlers();
    const handler = handlers[query.data];

    if (handler) {
      handler(query, response);
      return;
    }

    // Unknown Command, Return Error
    this.sendResponse(response, "Unknown or Bad Command.", query);
  },

  async answerGetChangelog (query, response) {
    const moduleName = query.module;
    const modulePath = `${this.getModuleDir()}/${moduleName}`;
    const changelogPath = path.join(modulePath, "CHANGELOG.md");

    try {
      const changelog = await fs.promises.readFile(changelogPath, "utf8");
      this.sendResponse(response, undefined, {action: "GET_CHANGELOG", changelog, module: moduleName});
    } catch {
      this.sendResponse(response, new Error("Changelog not found"), {action: "GET_CHANGELOG", query});
    }
  },

  callAfterUpdate (callback, timeout = 3000) {
    let isDone = false;
    const once = (didUpdate) => {
      if (isDone) { return; }
      isDone = true;
      callback(didUpdate);
    };
    this.waiting.push({run: () => once(true)});
    this.sendSocketNotification("UPDATE");
    setTimeout(() => once(false), timeout);
  },

  /**
   * Serve a request that depends on live frontend state.
   *
   * Instead of relying on a boot-time notification having been received, this
   * actively pulls a fresh CURRENT_STATUS from the frontend (via callAfterUpdate).
   * It is self-healing: even if the frontend missed DOM_OBJECTS_CREATED at
   * startup, the triggered UPDATE makes it resend its state. An error is only
   * returned when no state can be obtained at all (no browser connected).
   * @param {object} response - Express or socket response object
   * @param {() => void} callback - Invoked once live state is available
   * @returns {void}
   */
  requireLiveState (response, callback) {
    this.callAfterUpdate((didUpdate) => {
      if (didUpdate || this.initialized) {
        callback();
      } else {
        this.sendResponse(response, "Not connected to the MagicMirror² frontend. Open or refresh a browser pointing at the mirror.");
      }
    });
  },

  delayedQuery (query, response) {
    if (Object.hasOwn(this.delayedQueryTimers, query.did)) {
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
    this.sendResponse(response, undefined, query);
  },

  sendResponse (response, error, data) {
    let responsePayload = {success: true};
    let status = 200;
    let isResult = true;
    if (error) {
      Log.error(error);
      responsePayload = {success: false, status: "error", reason: "unknown", info: error};
      status = 400;
      isResult = false;
    }
    if (data) {
      responsePayload = {...responsePayload, ...data};
    }
    if (response) {
      if ("isSocket" in response && response.isSocket) {
        this.sendSocketNotification("REMOTE_ACTION_RESULT", responsePayload);
      } else {
        response.status(status).json(responsePayload);
      }
    }
    return isResult;
  },

  handleShowAlert (query, response) {
    this.sendResponse(response);

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
   * @param {object} response - Express response object
   * @returns {boolean} Always true (errors are handled internally)
   */
  handleNotification (query, response) {
    try {
      let payload = query.payload;

      if (typeof payload === "string") {

        /*
         * Try to parse as JSON to convert numbers ("2"), booleans ("true"), objects, arrays.
         * For plain strings that don't look like JSON, keep the raw value.
         * Propagate parse errors only for object/array payloads (malformed input).
         */
        try {
          payload = JSON.parse(payload);
        } catch (error) {
          const looksLikeJson = payload.startsWith("{") || payload.startsWith("[");
          if (looksLikeJson) throw error;
        }
      }

      this.sendSocketNotification(query.action, {notification: query.notification, payload});
      this.sendResponse(response);
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
      this.sendResponse(response, error, {reason: error.message});
      return true;
    }
  },

  handleManageClasses (query, response) {
    if (query.payload && query.payload.classes && this.thisConfig && this.thisConfig.classes) {
      const classes = [];
      switch (typeof query.payload.classes) {
        case "string": classes.push(this.thisConfig.classes[query.payload.classes]); break;

        case "object": for (const className of query.payload.classes) classes.push(this.thisConfig.classes[className]);

      }
      for (const classConfig of classes) {
        for (const actionName in classConfig) {
          if ([
            "SHOW",
            "HIDE",
            "TOGGLE"
          ].includes(actionName.toUpperCase())) {
            if (typeof classConfig[actionName] === "string") {
              this.sendSocketNotification(actionName.toUpperCase(), {module: classConfig[actionName]});
            } else {
              const modules = classConfig[actionName];
              for (const moduleName of modules) {
                this.sendSocketNotification(actionName.toUpperCase(), {module: moduleName});
              }
            }
          }
        }
      }
    }
    this.sendResponse(response);
  },

  handleRestart (query, response) {
    try {
      const {app} = require("electron");
      if (!app) { throw "Could not get Electron app instance."; }

      /*
       * When running under a process manager like pm2, skip app.relaunch()
       * to avoid spawning a duplicate instance (pm2 will restart automatically).
       */
      const isManagedProcess = process.env.PM2_HOME || process.env.pm_id !== undefined;

      if (isManagedProcess) {
        Log.log("Running under pm2 (or similar process manager), exiting cleanly for managed restart...");
        this.sendResponse(response, undefined, {action: "RESTART", info: "Exiting for process manager restart..."});

        if (response && response.on) {
          response.on("finish", () => app.quit());
        } else {
          setTimeout(() => app.quit(), 1000);
        }
      } else {
        this.sendResponse(response, undefined, {action: "RESTART", info: "Restarting Electron..."});
        app.relaunch();
        app.quit();
      }
    } catch (error) {
      // Electron not available (server mode) - exit cleanly and let process manager restart
      Log.log(`Electron not available (${error?.message || "server mode"}), exiting process for restart by process manager...`);
      this.sendResponse(response, undefined, {action: "RESTART", info: "Exiting process for restart..."});

      // Wait for response to be sent before exiting
      if (response && response.on) {
        response.on("finish", () => {
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(0);
        });
      } else {
        // Fallback if response doesn't have event emitter (socket response)
        // eslint-disable-next-line unicorn/no-process-exit
        setTimeout(() => process.exit(0), 1000);
      }
    }
  },

  handleStop (query, response) {
    Log.log("Stopping MagicMirror...");
    this.sendResponse(response, undefined, {action: "STOP", info: "Stopping process..."});

    // Wait for response to be sent before exiting
    if (response && response.on) {
      response.on("finish", () => {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
      });
    } else {
      // Fallback if response doesn't have event emitter (socket response)
      // eslint-disable-next-line unicorn/no-process-exit
      setTimeout(() => process.exit(1), 1000);
    }
  },

  handleCommand (query, response) {
    const options = {timeout: 15_000};
    const command = this.thisConfig.customCommand?.[query.command];
    if (command) {
      exec(command, options, (error, stdout, stderr) => {
        this.checkForExecError(error, stdout, stderr, response, {stdout});
      });
    } else {
      this.sendResponse(response, new Error("Command not found"), query);
    }
  },

  handleUserPresence (query, response) {
    this.sendSocketNotification("USER_PRESENCE", query.value);
    this.userPresence = query.value;
    this.sendResponse(response, undefined, query);
  },

  /**
   * Forwards action to frontend without validation.
   * Used for SHOW/HIDE/TOGGLE - frontend filters invalid/missing module parameters.
   * @param {object} query - Query object containing action and optional module identifier
   * @param {object} response - Express response object or socket placeholder
   */
  handleSimpleSocketNotification (query, response) {
    this.sendSocketNotification(query.action, query);
    this.sendResponse(response);
  },

  handleSimpleValueNotification (query, response) {
    this.sendResponse(response);
    this.sendSocketNotification(query.action, query.value);
  },

  handleSimpleNotification (query, response) {
    this.sendResponse(response);
    this.sendSocketNotification(query.action);
  },

  handleSave (query, response) {
    this.sendResponse(response);
    this.callAfterUpdate(() => { this.saveDefaultSettings(); });
  },

  handleModuleData (query, response) {
    this.callAfterUpdate(() => {
      this.sendResponse(response, undefined, this.configData);
    });
  },

  handleDelayed (query, response) {

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
    this.delayedQuery(query, response);
  },

  getActionHandlers () {
    const options = {timeout: 15_000};

    const callMonitorControl = (action, response) => systemControl.monitorControl(
      action,
      this.thisConfig,
      options,
      response,
      this.checkForExecError.bind(this),
      this.sendSocketNotification.bind(this)
    );

    const callShutdownControl = (action, response) => systemControl.shutdownControl(action, this.thisConfig, options, response, this.sendResponse.bind(this));

    const callElectronActions = (query, response) => systemControl.handleElectronActions(query, response, this.sendResponse.bind(this));

    return {
      GET_CHANGELOG: (q, r) => this.answerGetChangelog(q, r),
      SHUTDOWN: (q, r) => callShutdownControl(q.action, r),
      REBOOT: (q, r) => callShutdownControl(q.action, r),
      RESTART: (q, r) => this.handleRestart(q, r),
      STOP: (q, r) => this.handleStop(q, r),
      COMMAND: (q, r) => this.handleCommand(q, r),
      USER_PRESENCE: (q, r) => this.handleUserPresence(q, r),
      MONITORON: (q, r) => callMonitorControl(q.action, r),
      MONITOROFF: (q, r) => callMonitorControl(q.action, r),
      MONITORTOGGLE: (q, r) => callMonitorControl(q.action, r),
      MONITORSTATUS: (q, r) => callMonitorControl(q.action, r),
      HIDE: (q, r) => this.handleSimpleSocketNotification(q, r),
      SHOW: (q, r) => this.handleSimpleSocketNotification(q, r),
      TOGGLE: (q, r) => this.handleSimpleSocketNotification(q, r),
      BRIGHTNESS: (q, r) => this.handleSimpleValueNotification(q, r),
      TEMP: (q, r) => this.handleSimpleValueNotification(q, r),
      ZOOM: (q, r) => this.handleSimpleValueNotification(q, r),
      BACKGROUND_COLOR: (q, r) => this.handleSimpleValueNotification(q, r),
      FONT_COLOR: (q, r) => this.handleSimpleValueNotification(q, r),
      SAVE: (q, r) => this.handleSave(q, r),
      MODULE_DATA: (q, r) => this.handleModuleData(q, r),
      INSTALL: (q, r) => this.installModule(q.url, r, q),
      REFRESH: (q, r) => this.handleSimpleNotification(q, r),
      HIDE_ALERT: (q, r) => this.handleSimpleNotification(q, r),
      SHOW_ALERT: (q, r) => this.handleShowAlert(q, r),
      UPDATE: (q, r) => this.updateModule(decodeURI(q.module), r),
      NOTIFICATION: (q, r) => this.handleNotification(q, r),
      MANAGE_CLASSES: (q, r) => this.handleManageClasses(q, r),
      MINIMIZE: (q, r) => callElectronActions(q, r),
      TOGGLEFULLSCREEN: (q, r) => callElectronActions(q, r),
      DEVTOOLS: (q, r) => callElectronActions(q, r),
      DELAYED: (q, r) => this.handleDelayed(q, r)
    };
  },

  executeQuery (query, response, shouldSkipResponse = false) {
    const handlers = this.getActionHandlers();
    const handler = handlers[query.action];

    if (handler) {
      handler(query, shouldSkipResponse ? null : response);
      return true;
    }

    if (!shouldSkipResponse) {
      this.sendResponse(response, new Error(`Invalid Option: ${query.action}`));
    }
    return false;
  },

  /**
   * Install a module from a git repository
   * @param {string} url - Git repository URL
   * @param {object} response - Express response object
   * @param {object} data - Additional installation data
   * @returns {void}
   */
  async installModule (url, response, data) {
    await moduleManager.installModule({
      url,
      baseDirectory: __dirname,
      onSuccess: async (result) => {
        await this.readModuleData();
        this.sendResponse(response, undefined, {stdout: result.stdout, ...data});
      },
      onError: (error, result) => {
        this.sendResponse(response, error, {stdout: result.stdout, stderr: result.stderr, ...data});
      }
    });
  },

  async updateModule (module, response) {
    await moduleManager.updateModule({
      moduleName: module,
      baseDirectory: __dirname,
      modulesAvailable: this.modulesAvailable,
      onSuccess: (result) => {
        if (result.code !== "up-to-date") {
          this.readModuleData();
        }
        this.sendResponse(response, undefined, result);
      },
      onError: (error, result) => {
        this.sendResponse(response, error, result);
      }
    });
  },

  checkForExecError (error, stdout, stderr, response, data) {
    if (error) { Log.error(stderr); }
    this.sendResponse(response, error, data);
  },

  translate (data) {
    for (const [t, translation] of Object.entries(this.translation)) {
      const pattern = `%%TRANSLATE:${t}%%`;
      data = data.split(pattern).join(translation);
    }
    return data;
  },

  async saveDefaultSettings () {
    await configManager.saveDefaultSettings(__dirname, this.configData);
  },

  in (pattern, string) { return includes(pattern, string); },

  async loadDefaultSettings () {
    const settings = await configManager.loadDefaultSettings(__dirname);
    if (settings) {
      this.sendSocketNotification("DEFAULT_SETTINGS", settings);
    }
  },

  fillTemplates (data) {
    data = this.translate(data);
    // Replace config path placeholder
    const configPath = globalThis.configuration_file === undefined
      ? "config/config.js"
      : globalThis.configuration_file;
    data = data.split("%%CONFIG_PATH%%").join(configPath);
    return data;
  },

  async loadTranslation (language) {
    this.translation = await configManager.loadTranslation(__dirname, language, this.translation);
  },

  async loadCustomMenus () {
    const customMenu = await configManager.loadCustomMenus(__dirname, this.thisConfig, (data) => this.translate(data));
    if (customMenu) {
      this.customMenu = {...this.customMenu, ...customMenu};
      this.sendSocketNotification("REMOTE_CLIENT_CUSTOM_MENU", this.customMenu);
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

    switch (notification) {
      case "CURRENT_STATUS":
        this.configData = payload;
        this.thisConfig = payload.remoteConfig;
        this.initialized = true;

        /*
         * Always drain requests waiting for fresh frontend state. The pull is
         * idempotent, so a missed boot-time notification is no longer fatal.
         */
        for (const o of this.waiting) { o.run(); }
        this.waiting = [];

        break;
      case "REQUEST_DEFAULT_SETTINGS":
      // module started, answer with current ip addresses
        this.sendSocketNotification("IP_ADDRESSES", this.getIpAddresses());
        this.sendSocketNotification("LOAD_PORT", this.configOnHd.port || "");
        // check if we have got saved default settings
        this.loadDefaultSettings();

        break;
      case "GENERATE_QR_CODE":
        this.generateQRCode(payload);

        break;
      case "REMOTE_ACTION":
        if ("action" in payload) {
          this.executeQuery(payload, {isSocket: true});
        } else if ("data" in payload) {
          this.answerGet(payload, {isSocket: true});
        }

        break;
      case "UNDO_CONFIG": {
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

        break;
      }
      case "NEW_CONFIG":
        this.answerPost({data: "config"}, {body: payload}, {isSocket: true});

        break;
      case "REMOTE_CLIENT_CONNECTED":
        this.sendSocketNotification("REMOTE_CLIENT_CONNECTED");
        this.loadCustomMenus();
        if ("id" in this.moduleApiMenu) {
          this.sendSocketNotification("REMOTE_CLIENT_MODULEAPI_MENU", this.moduleApiMenu);
        }

        break;
      case "REMOTE_NOTIFICATION_ECHO_IN":
        this.sendSocketNotification("REMOTE_NOTIFICATION_ECHO_OUT", payload);

        break;
      case "USER_PRESENCE":
        this.userPresence = payload;

        break;
      default: if (notification === "REGISTER_API" && "module" in payload) {

        /* API EXTENSION -- added v2.0.0 */
        if ("actions" in payload && Object.keys(payload.actions).length > 0) {
          this.externalApiRoutes[payload.module] = payload;
        } else {
        // Blank actions means the module has requested to be removed from API
          delete this.externalApiRoutes[payload.module];
        }
        this.updateModuleApiMenu();
      }
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
