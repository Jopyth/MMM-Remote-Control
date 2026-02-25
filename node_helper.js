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
    for (const t of Object.keys(this.delayedQueryTimers)) {
      clearTimeout(this.delayedQueryTimers[t]);
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
      const {query} = request;

      this.answerGet(query, res);
    });
    this.expressApp.post("/post", (request, res) => {
      const {query} = request;

      this.answerPost(query, request, res);
    });

    this.expressApp.get("/config-help.html", (request, res) => {
      const {query} = request;

      this.answerConfigHelp(query, res);
    });

    this.expressApp.get("/remote", (request, res) => {
      const {query} = request;

      if (query.action && !["COMMAND"].includes(query.action)) {
        const result = this.executeQuery(query, res);
        if (result === true) {
          return;
        }
      }
      res.send({"status": "error", "reason": "unknown_command", "info": `original input: ${JSON.stringify(query)}`});
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
      for (const [index, dir] of result.installedModules.entries()) {
        await this.addModule(dir, index === result.installedModules.length - 1);
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
      modulesDir: this.getModuleDir(),
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

  answerConfigHelp (query, res) {
    if (defaultModules.includes(query.module)) {
      // default module
      const dir = path.resolve(`${__dirname}/..`);
      const git = simpleGit(dir);
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
        res.writeHead(302, {"Location": `https://github.com/MagicMirrorOrg/MagicMirror/tree/${result.trim()}/${githubPath}/${query.module}`});
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

  /**
   * Handle POST API requests
   * @param {object} query - Query parameters
   * @param {object} request - Express request object
   * @param {object} res - Express response object
   * @returns {void}
   */
  async answerPost (query, request, res) {
    if (query.data === "config") {
      await this.saveConfigWithBackup(request.body, res, query);
    }
  },

  async saveConfigWithBackup (configData, res, query) {
    const configPath = configManager.getConfigPath(__dirname);
    const backupSlot = await configManager.findBestBackupSlot();

    if (!backupSlot) {
      const error = new Error("Backing up config failed, not saving!");
      Log.error(error.message);
      this.sendResponse(res, error, {query});
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
    const config = configManager.getConfig(this.configOnHd, this.configData);
    const thisConfig = config.modules.find((m) => m.module === "MMM-Remote-Control")?.config || {};
    this.sendResponse(res, undefined, {
      query,
      data: thisConfig.classes || {}
    });
  },

  async handleGetSaves (query, res) {
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

  handleGetZoom (query, res) {
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, {query, result: this.configData.zoom});
    });
  },

  handleGetBackgroundColor (query, res) {
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, {query, result: this.configData.backgroundColor});
    });
  },

  handleGetFontColor (query, res) {
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      this.sendResponse(res, undefined, {query, result: this.configData.fontColor});
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

  async answerGetChangelog (query, res) {
    const moduleName = query.module;
    const modulePath = `${this.getModuleDir()}/${moduleName}`;
    const changelogPath = path.join(modulePath, "CHANGELOG.md");

    try {
      const changelog = await fs.promises.readFile(changelogPath, "utf8");
      this.sendResponse(res, undefined, {action: "GET_CHANGELOG", changelog, module: moduleName});
    } catch {
      this.sendResponse(res, new Error("Changelog not found"), {action: "GET_CHANGELOG", query});
    }
  },

  callAfterUpdate (callback, timeout = 3000) {
    let done = false;
    const once = () => {
      if (done) { return; }
      done = true;
      callback();
    };
    this.waiting.push({run: once});
    this.sendSocketNotification("UPDATE");
    setTimeout(once, timeout);
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
      } else {
        payload = query.payload; // numbers, booleans, etc.
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

  handleRestart (query, res) {
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
        this.sendResponse(res, undefined, {action: "RESTART", info: "Exiting for process manager restart..."});

        if (res && res.on) {
          res.on("finish", () => app.quit());
        } else {
          setTimeout(() => app.quit(), 1000);
        }
      } else {
        this.sendResponse(res, undefined, {action: "RESTART", info: "Restarting Electron..."});
        app.relaunch();
        app.quit();
      }
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

    const callMonitorControl = (action, res) => systemControl.monitorControl(
      action,
      this.thisConfig,
      options,
      res,
      this.checkForExecError.bind(this),
      this.sendSocketNotification.bind(this)
    );

    const callShutdownControl = (action, res) => systemControl.shutdownControl(action, this.thisConfig, options, res, this.sendResponse.bind(this));

    const callElectronActions = (query, res) => systemControl.handleElectronActions(query, res, this.sendResponse.bind(this));

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

  executeQuery (query, res, skipResponse = false) {
    const handlers = this.getActionHandlers();
    const handler = handlers[query.action];

    if (handler) {
      handler(query, skipResponse ? null : res);
      return true;
    }

    if (!skipResponse) {
      this.sendResponse(res, new Error(`Invalid Option: ${query.action}`));
    }
    return false;
  },

  /**
   * Install a module from a git repository
   * @param {string} url - Git repository URL
   * @param {object} res - Express response object
   * @param {object} data - Additional installation data
   * @returns {void}
   */
  async installModule (url, res, data) {
    await moduleManager.installModule({
      url,
      baseDir: __dirname,
      onSuccess: async (result) => {
        await this.readModuleData();
        this.sendResponse(res, undefined, {stdout: result.stdout, ...data});
      },
      onError: (error, result) => {
        this.sendResponse(res, error, {stdout: result.stdout, stderr: result.stderr, ...data});
      }
    });
  },

  async updateModule (module, res) {
    await moduleManager.updateModule({
      moduleName: module,
      baseDir: __dirname,
      modulesAvailable: this.modulesAvailable,
      onSuccess: (result) => {
        if (result.code !== "up-to-date") {
          this.readModuleData();
        }
        this.sendResponse(res, undefined, result);
      },
      onError: (error, result) => {
        this.sendResponse(res, error, result);
      }
    });
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
    data = data.replaceAll("%%CONFIG_PATH%%", configPath);
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
