/* global Module */

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
const util = require("node:util");
const simpleGit = require("simple-git");

const defaultModules = require(path.resolve(`${__dirname}/../../modules/default/defaultmodules.js`));
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
    const self = this;

    this.initialized = false;
    Log.log(`Starting node helper for: ${self.name}`);

    // load fall back translation
    self.loadTranslation("en");

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

    fs.readFile(path.resolve(`${__dirname}/remote.html`), (err, data) => {
      self.template = data.toString();
    });

    this.combineConfig();
    this.updateModuleList();
    this.createRoutes();

    /* API EXTENSION - Added v2.0.0 */
    this.externalApiRoutes = {};
    this.moduleApiMenu = {};
  },

  stop () {
    // Clear all timeouts for clean shutdown
    Object.keys(this.delayedQueryTimers).forEach((t) => {
      clearTimeout(this.delayedQueryTimers[t]);
    });
  },

  onModulesLoaded () {

    /* CALLED AFTER MODULES AND CONFIG DATA ARE LOADED */
    /* API EXTENSION - Added v2.0.0 */
    this.createApiRoutes();

    this.loadTimers();
  },

  loadTimers () {
    const delay = 24 * 3600;

    const self = this;

    clearTimeout(this.delayedQueryTimers.update);
    this.delayedQueryTimers.update = setTimeout(() => {
      self.updateModuleList();
      self.loadTimers();
    }, delay * 1000);
  },

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
      if (error.code == "ENOENT") {
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

  getConfigPath () {
    let configPath = path.resolve(`${__dirname}/../../config/config.js`);
    if (typeof global.configuration_file !== "undefined") {
      configPath = path.resolve(`${__dirname}/../../${global.configuration_file}`);
    }
    return configPath;
  },

  createRoutes () {
    const self = this;

    this.expressApp.get("/remote.html", (req, res) => {
      if (self.template === "") {
        res.sendStatus(503);
      } else {
        res.contentType("text/html");
        res.set("Content-Security-Policy", "frame-ancestors http://*:*");
        const transformedData = self.fillTemplates(self.template);
        res.send(transformedData);
      }
    });

    this.expressApp.get("/get", (req, res) => {
      const {query} = url.parse(req.url, true);

      self.answerGet(query, res);
    });
    this.expressApp.post("/post", (req, res) => {
      const {query} = url.parse(req.url, true);

      self.answerPost(query, req, res);
    });

    this.expressApp.get("/config-help.html", (req, res) => {
      const {query} = url.parse(req.url, true);

      self.answerConfigHelp(query, res);
    });

    this.expressApp.get("/remote", (req, res) => {
      const {query} = url.parse(req.url, true);

      if (query.action && ["COMMAND"].indexOf(query.action) === -1) {
        const result = self.executeQuery(query, res);
        if (result === true) {
          return;
        }
      }
      res.send({"status": "error", "reason": "unknown_command", "info": `original input: ${JSON.stringify(query)}`});
    });
  },

  capitalizeFirst (string) { return capitalizeFirst(string); },

  formatName (string) { return formatName(string); },

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

  readModuleData () {
    const self = this;

    fs.readFile(path.resolve(`${__dirname}/modules.json`), (err, data) => {
      self.modulesAvailable = JSON.parse(data.toString());

      for (let i = 0; i < self.modulesAvailable.length; i++) {
        self.modulesAvailable[i].name = self.formatName(self.modulesAvailable[i].longname);
        self.modulesAvailable[i].isDefaultModule = false;
      }

      for (let i = 0; i < defaultModules.length; i++) {
        self.modulesAvailable.push({
          longname: defaultModules[i],
          name: self.capitalizeFirst(defaultModules[i]),
          isDefaultModule: true,
          installed: true,
          author: "MagicMirrorOrg",
          desc: "",
          id: "MagicMirrorOrg/MagicMirror",
          url: "https://docs.magicmirror.builders/modules/introduction.html"
        });
        const module = self.modulesAvailable[self.modulesAvailable.length - 1];
        const modulePath = `modules/default/${defaultModules[i]}`;
        self.loadModuleDefaultConfig(module, modulePath, i === defaultModules.length - 1);
      }

      // now check for installed modules
      fs.readdir(path.resolve(`${__dirname}/..`), (err, files) => {
        const installedModules = files.filter((f) => [
          "node_modules",
          "default",
          "README.md"
        ].indexOf(f) === -1);
        installedModules.forEach((dir, i) => {
          self.addModule(dir, i === installedModules.length - 1);
        });
      });
    });
  },

  getModuleDir () {
    return this.configOnHd.foreignModulesDir
      ? this.configOnHd.foreignModulesDir
      : this.configOnHd.paths
        ? this.configOnHd.paths.modules
        : "modules";
  },

  addModule (folderName, lastOne) {
    const self = this;

    const modulePath = `${this.getModuleDir()}/${folderName}`;
    fs.stat(modulePath, (err, stats) => {
      if (stats.isDirectory()) {
        let isInList = false;
        let currentModule;
        self.modulesInstalled.push(folderName);
        for (let i = 0; i < self.modulesAvailable.length; i++) {
          if (self.modulesAvailable[i].longname === folderName) {
            isInList = true;
            self.modulesAvailable[i].installed = true;
            currentModule = self.modulesAvailable[i];
          }
        }
        if (!isInList) {
          const newModule = {
            longname: folderName,
            name: self.formatName(folderName),
            isDefaultModule: false,
            installed: true,
            author: "unknown",
            desc: "",
            id: `local/${folderName}`,
            url: ""
          };
          self.modulesAvailable.push(newModule);
          currentModule = newModule;
        }
        self.loadModuleDefaultConfig(currentModule, modulePath, lastOne);

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
          if (!self.pendingUpdateChecks) {
            self.pendingUpdateChecks = 0;
          }
          self.pendingUpdateChecks++;
          Log.debug(`Queuing update check for ${folderName}, pending: ${self.pendingUpdateChecks}`);

          // Add to queue instead of executing immediately
          self.updateCheckQueue.push({
            module: currentModule,
            modulePath,
            folderName
          });

          // Start processing queue
          self.processUpdateCheckQueue();

          if (!isInList) {
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
                Log.debug(`Could not get remote URL for module ${folderName}: ${error}`);

              }
            });
          }
        } catch {
          Log.debug(`Module ${folderName} is not managed with git, skipping update check`);
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
        Log.info(`Module ${check.folderName} has updates available (behind ${data.behind} commits)`);
      }
    } catch (err) {
      Log.warn(`Error checking updates for ${check.folderName}: ${err.message || err}`);
    } finally {
      this.activeUpdateChecks--;
      this.pendingUpdateChecks--;
      Log.debug(`Finished update check for ${check.folderName}, pending: ${this.pendingUpdateChecks}, active: ${this.activeUpdateChecks}, queued: ${this.updateCheckQueue.length}`);

      // Process next item in queue
      this.processUpdateCheckQueue();
    }
  },

  loadModuleDefaultConfig (module, modulePath, lastOne) {
    const filename = path.resolve(`${modulePath}/${module.longname}.js`);

    try {
      fs.accessSync(filename, fs.constants.F_OK);

      /* Defaults are stored when Module.register is called during require(filename); */
      require(filename);
    } catch (e) {
      if (e instanceof ReferenceError) {
        Log.log(`Could not get defaults for ${module.longname}. See #335.`);
      } else if (e.code == "ENOENT") {
        Log.error(`Could not find main module js file for ${module.longname}`);
      } else if (e instanceof SyntaxError) {
        Log.error(`Could not validate main module js file for ${module.longname}`);
        Log.error(e);
      } else {
        Log.error(`Could not load main module js file for ${module.longname}. Error found: ${e}`);
      }
    }
    if (lastOne) { this.onModulesLoaded(); }
  },

  answerConfigHelp (query, res) {
    if (defaultModules.indexOf(query.module) !== -1) {
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
    for (let i = 0; i < config.modules.length; i++) {
      const current = config.modules[i];
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
    cleaned.modules?.forEach((m) => Log.debug(m));
    return cleaned;
  },

  findBestBackupSlot () {
    const backupHistorySize = 5;
    const backupSlots = Array.from({length: backupHistorySize - 1}, (_, i) => i + 1);

    return backupSlots.reduce((best, slot) => {
      const backupPath = path.resolve(`config/config.js.backup${slot}`);
      try {
        const stats = fs.statSync(backupPath);
        return !best || stats.mtime < best.mtime
          ? {slot, mtime: stats.mtime}
          : best;
      } catch (e) {
        if (e.code === "ENOENT") {
          const emptySlotMtime = new Date(0);
          return !best || emptySlotMtime < best.mtime
            ? {slot, mtime: emptySlotMtime}
            : best;
        }
        return best;
      }
    }, null);
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

      const configContent = header + util.inspect(this.configOnHd, {
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

  answerPost (query, req, res) {
    if (query.data === "config") {
      this.saveConfigWithBackup(req.body, res, query);
    }
  },

  handleGetModuleAvailable (query, res) {
    this.modulesAvailable.sort((a, b) => a.name.localeCompare(b.name));
    this.sendResponse(res, undefined, {query, data: this.modulesAvailable});
  },

  handleGetModuleInstalled (query, res) {
    const self = this;
    const filterInstalled = (value) => value.installed && !value.isDefaultModule;

    // Wait for pending update checks to complete before sending response
    const startTime = Date.now();
    const maxWaitTime = 3000; // Maximum 3 seconds - first batch should be ready

    const waitForUpdateChecks = () => {
      const elapsed = Date.now() - startTime;
      const {pendingUpdateChecks, activeUpdateChecks, updateCheckQueue} = self;

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
        const installed = self.modulesAvailable.filter(filterInstalled);
        installed.sort((a, b) => a.name.localeCompare(b.name));
        self.sendResponse(res, undefined, {query, data: installed});
      }
    };
    waitForUpdateChecks();
  },

  handleGetMmUpdateAvailable (query, res) {
    const sg = simpleGit(`${__dirname}/..`);
    sg.fetch().status((err, data) => {
      if (!err) {
        if (data.behind > 0) {
          this.sendResponse(res, undefined, {query, result: true});
          return;
        }
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

    for (let i = backupHistorySize - 1; i > 0; i--) {
      const backupPath = path.resolve(`config/config.js.backup${i}`);
      try {
        const stats = fs.statSync(backupPath);
        times.push(stats.mtime);
      } catch (error) {
        Log.debug(`Backup ${i} does not exist: ${error}.`);
        continue;
      }
    }
    this.sendResponse(res, undefined, {query, data: times.sort((a, b) => b - a)});
  },

  handleGetDefaultConfig (query, res) {
    if (!(query.module in Module.configDefaults)) {
      this.sendResponse(res, undefined, {query, data: {}});
    } else {
      this.sendResponse(res, undefined, {query, data: Module.configDefaults[query.module]});
    }
  },

  handleGetModules (query, res) {
    const self = this;
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      self.sendResponse(res, undefined, {query, data: self.configData.moduleData});
    });
  },

  handleGetBrightness (query, res) {
    const self = this;
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      self.sendResponse(res, undefined, {query, result: self.configData.brightness});
    });
  },

  handleGetTemp (query, res) {
    const self = this;
    if (!this.checkInitialized(res)) { return; }
    this.callAfterUpdate(() => {
      self.sendResponse(res, undefined, {query, result: self.configData.temp});
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
      const changelog = fs.readFileSync(changelogPath, "utf-8");
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

  monitorControl (action, opts, res) {
    let status = "unknown";
    const offArr = [
      "false",
      "TV is off",
      "standby",
      "display_power=0"
    ];
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
      case "MONITORSTATUS": exec(monitorStatusCommand, opts, (error, stdout, stderr) => {
        status = offArr.indexOf(stdout.trim()) !== -1
          ? "off"
          : "on";
        this.checkForExecError(error, stdout, stderr, res, {monitor: status});

      });
        break;
      case "MONITORTOGGLE": exec(monitorStatusCommand, opts, (error, stdout) => {
        status = offArr.indexOf(stdout.trim()) !== -1
          ? "off"
          : "on";
        if (status === "on") { this.monitorControl("MONITOROFF", opts, res); } else { this.monitorControl("MONITORON", opts, res); }

      });
        break;
      case "MONITORON": exec(monitorOnCommand, opts, (error, stdout, stderr) => {
        this.checkForExecError(error, stdout, stderr, res, {monitor: "on"});
      });
        this.sendSocketNotification("USER_PRESENCE", true);
        break;
      case "MONITOROFF": exec(monitorOffCommand, opts, (error, stdout, stderr) => {
        this.checkForExecError(error, stdout, stderr, res, {monitor: "off"});
      });
        this.sendSocketNotification("USER_PRESENCE", false);
        break;
    }
  },

  shutdownControl (action, opts) {
    const shutdownCommand = this.initialized && "shutdownCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.shutdownCommand
      : "sudo shutdown -h now";
    const rebootCommand = this.initialized && "rebootCommand" in this.thisConfig.customCommand
      ? this.thisConfig.customCommand.rebootCommand
      : "sudo shutdown -r now";
    if (action === "SHUTDOWN") {
      exec(shutdownCommand, opts, (error, stdout, stderr, res) => { this.checkForExecError(error, stdout, stderr, res); });
    }
    if (action === "REBOOT") {
      exec(rebootCommand, opts, (error, stdout, stderr, res) => { this.checkForExecError(error, stdout, stderr, res); });
    }
  },

  handleShowAlert (query, res) {
    this.sendResponse(res);

    const type = query.type
      ? query.type
      : "alert";
    const title = query.title
      ? query.title
      : "Note";
    const message = query.message
      ? query.message
      : "Attention!";
    const timer = query.timer
      ? query.timer
      : 4;

    this.sendSocketNotification(query.action, {
      type,
      title,
      message,
      timer: timer * 1000
    });
  },

  handleNotification (query, res) {
    try {
      let payload = {}; // Assume empty JSON-object if no payload is provided
      if (typeof query.payload === "undefined") {
        payload = query.payload;
      } else if (typeof query.payload === "object") {
        payload = query.payload;
      } else if (typeof query.payload === "string") {
        if (query.payload.startsWith("{")) {
          payload = JSON.parse(query.payload);
        } else {
          payload = query.payload;
        }
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
    if (!query.payload || !query.payload.classes || !this.thisConfig || !this.thisConfig.classes) { return; }
    const classes = [];
    switch (typeof query.payload.classes) {
      case "string": classes.push(this.thisConfig.classes[query.payload.classes]); break;
      case "object": query.payload.classes.forEach((t) => classes.push(this.thisConfig.classes[t]));
    }
    classes.forEach((cl) => {
      for (const act in cl) {
        if ([
          "SHOW",
          "HIDE",
          "TOGGLE"
        ].includes(act.toUpperCase())) {
          if (typeof cl[act] === "string") { this.sendSocketNotification(act.toUpperCase(), {module: cl[act]}); } else {
            cl[act].forEach((t) => {
              this.sendSocketNotification(act.toUpperCase(), {module: t});
            });
          }
        }
      }
    });
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
    } catch (err) {
      this.sendResponse(res, err);
    }
  },

  handleCommand (query, res) {
    const opts = {timeout: 15000};
    if (this.thisConfig.customCommand && this.thisConfig.customCommand[query.command]) {
      exec(this.thisConfig.customCommand[query.command], opts, (error, stdout, stderr) => {
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
    const opts = {timeout: 15000};
    return {
      GET_CHANGELOG: (q, r) => this.answerGetChangelog(q, r),
      SHUTDOWN: (q, r) => this.shutdownControl(q.action, opts, r),
      REBOOT: (q, r) => this.shutdownControl(q.action, opts, r),
      RESTART: (q, r) => this.controlPm2(r, q),
      STOP: (q, r) => this.controlPm2(r, q),
      COMMAND: (q, r) => this.handleCommand(q, r),
      USER_PRESENCE: (q, r) => this.handleUserPresence(q, r),
      MONITORON: (q, r) => this.monitorControl(q.action, opts, r),
      MONITOROFF: (q, r) => this.monitorControl(q.action, opts, r),
      MONITORTOGGLE: (q, r) => this.monitorControl(q.action, opts, r),
      MONITORSTATUS: (q, r) => this.monitorControl(q.action, opts, r),
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

  installModule (url, res, data) {
    const self = this;

    simpleGit(path.resolve(`${__dirname}/..`)).clone(url, path.basename(url), (error) => {
      if (error) {
        Log.error(error);
        self.sendResponse(res, error);
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

            exec(command, {cwd: workDir, timeout: 120000}, (error, stdout, stderr) => {
              if (error) {
                Log.error(error);
                self.sendResponse(res, error, {stdout, stderr, ...data});
              } else {
                // success part
                self.readModuleData();
                self.sendResponse(res, undefined, {stdout, ...data});
              }
            });
          }
        } else {
          self.readModuleData();
          self.sendResponse(res, undefined, {stdout: "Module installed.", ...data});
        }
      }
    });
  },

  async updateModule (module, res) {
    Log.log(`UPDATE ${module || "MagicMirror"}`);

    let modulePath = `${__dirname}/../../`;
    let name = "MM";

    if (module && module !== "undefined") {
      const modData = this.modulesAvailable?.find((m) => m.longname === module);
      if (!modData) {
        this.sendResponse(res, new Error("Unknown Module"), {info: module});
        return;
      }

      modulePath = `${__dirname}/../${modData.longname}`;
      name = modData.name;
    }

    Log.log(`path: ${modulePath} name: ${name}`);

    const git = simpleGit(modulePath);
    const execPromise = util.promisify(exec);

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
        await execPromise(command, {cwd: modulePath, timeout: 120000});
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
      response.chlog = fs.readFileSync(changelogPath, "utf-8");
    }

    this.sendResponse(res, undefined, response);
  },

  checkForExecError (error, stdout, stderr, res, data) {
    if (error) { Log.error(stderr); }
    this.sendResponse(res, error, data);
  },

  controlPm2 (res, query) {
    const actionName = query.action.toLowerCase();

    // Check if PM2 is available
    try {
      require.resolve("pm2");
    } catch {
      // PM2 not installed
      const message = `MagicMirror² is not running under PM2. Please ${actionName} manually.`;
      Log.log(`${message}`);
      this.sendResponse(res, undefined, {action: actionName, info: message, status: "info"});
      return;
    }

    const pm2 = require("pm2");
    const processName = query.processName || this.thisConfig.pm2ProcessName || "mm";

    pm2.connect((err) => {
      if (err) {
        pm2.disconnect();
        const message = `MagicMirror² is not running under PM2. Please ${actionName} manually.`;
        Log.log(`${message}`);
        this.sendResponse(res, undefined, {action: actionName, info: message, status: "info"});
        return;
      }

      // Check if process is running in PM2
      pm2.list((err, list) => {
        if (err || !list.find((proc) => proc.name === processName && proc.pm2_env.status === "online")) {
          pm2.disconnect();
          const message = `MagicMirror² is not running under PM2. Please ${actionName} manually.`;
          Log.log(`${message}`);
          this.sendResponse(res, undefined, {action: actionName, info: message, status: "info"});
          return;
        }

        // Process is running in PM2, perform action
        pm2[actionName](processName, (err) => {
          pm2.disconnect();
          if (err) {
            Log.error(`PM2 ${actionName} error:`, err);
            this.sendResponse(res, err);
          } else {
            Log.log(`PM2 ${actionName}: ${processName}`);
            this.sendResponse(res, undefined, {action: actionName, processName});
          }
        });
      });
    });
  },

  translate (data) {
    Object.keys(this.translation).forEach((t) => {
      const pattern = `%%TRANSLATE:${t}%%`;
      const re = new RegExp(pattern, "g");
      data = data.replace(re, this.translation[t]);
    });
    return data;
  },

  saveDefaultSettings () {
    const {moduleData} = this.configData;
    const simpleModuleData = [];
    for (let k = 0; k < moduleData.length; k++) {
      simpleModuleData.push({});
      simpleModuleData[k].identifier = moduleData[k].identifier;
      simpleModuleData[k].hidden = moduleData[k].hidden;
      simpleModuleData[k].lockStrings = moduleData[k].lockStrings;
      simpleModuleData[k].urlPath = moduleData[k].urlPath;
    }

    const text = JSON.stringify({
      moduleData: simpleModuleData,
      brightness: this.configData.brightness,
      temp: this.configData.temp,
      settingsVersion: this.configData.settingsVersion
    });

    fs.writeFile(path.resolve(`${__dirname}/settings.json`), text, (err) => {
      if (err) {
        throw err;
      }
    });
  },

  in (pattern, string) { return includes(pattern, string); },

  loadDefaultSettings () {
    const self = this;

    fs.readFile(path.resolve(`${__dirname}/settings.json`), (error, data) => {
      if (error) {
        if (self.in("no such file or directory", error.message)) {
          return;
        }
        Log.error(error);
      } else {
        data = JSON.parse(data.toString());
        self.sendSocketNotification("DEFAULT_SETTINGS", data);
      }
    });
  },

  fillTemplates (data) {
    data = this.translate(data);
    // Replace config path placeholder
    const configPath = typeof global.configuration_file !== "undefined"
      ? global.configuration_file
      : "config/config.js";
    data = data.replace(/%%CONFIG_PATH%%/g, configPath);
    return data;
  },

  loadTranslation (language) {
    const self = this;

    fs.readFile(path.resolve(`${__dirname}/translations/${language}.json`), (err, data) => {
      if (err) {
        return;
      } else {
        self.translation = {...self.translation, ...JSON.parse(data.toString())};
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
      fs.readFile(menuPath, (err, data) => {
        if (err) {
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

  socketNotificationReceived (notification, payload) {
    const self = this;

    if (notification === "CURRENT_STATUS") {
      this.configData = payload;
      this.thisConfig = payload.remoteConfig;
      if (!this.initialized) {
        // Do anything else required to initialize
        this.initialized = true;
      } else {
        this.waiting.forEach((o) => { o.run(); });
        this.waiting = [];
      }
    }
    if (notification === "REQUEST_DEFAULT_SETTINGS") {
      // module started, answer with current ip addresses
      self.sendSocketNotification("IP_ADDRESSES", self.getIpAddresses());
      self.sendSocketNotification("LOAD_PORT", self.configOnHd.port ? self.configOnHd.port : "");
      // check if we have got saved default settings
      self.loadDefaultSettings();
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

      for (let i = backupHistorySize - 1; i > 0; i--) {
        const backupPath = path.resolve(`config/config.js.backup${i}`);
        try {
          const stats = fs.statSync(backupPath);
          if (stats.mtime.toISOString() == payload) {
            iteration = i;
            i = -1;
          }
        } catch (error) {
          Log.debug(`Backup ${i} does not exist: ${error}.`);
          continue;
        }
      }
      if (iteration < 0) {
        this.answerGet({data: "saves"}, {isSocket: true});
        return;
      }
      const backupPath = path.resolve(`config/config.js.backup${iteration}`);
      const req = require(backupPath);

      this.answerPost({data: "config"}, {body: req}, {isSocket: true});
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
    if (notification === "REGISTER_API") {
      if ("module" in payload) {
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
  ...require("./API/api.js")
});
