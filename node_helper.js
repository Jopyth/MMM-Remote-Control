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
        Log.error("[MMM-Remote-Control] Could not find config file. Please create one. Starting with default configuration.");
        this.configOnHd = defaults;
      } else if (error instanceof ReferenceError || error instanceof SyntaxError) {
        Log.error("[MMM-Remote-Control] Could not validate config file. Please correct syntax errors. Starting with default configuration.");
        this.configOnHd = defaults;
      } else {
        Log.error(`[MMM-Remote-Control] Could not load config file. Starting with default configuration. Error found: ${error}`);
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

  capitalizeFirst (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },

  formatName (string) {
    string = string.replace(/MMM-/g, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(^|[-_])(\w)/g, ($0, $1, $2) => ($1 && " ") + $2.toUpperCase());
    return string;
  },

  updateModuleList (force) {
    const downloadModules = require("./scripts/download_modules");
    downloadModules({
      force,
      callback: (result) => {
        if (result && result.startsWith("ERROR")) { Log.error("[MMM-Remote-Control]", result); }
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

        // check for available updates
        try {
          fs.statSync(path.join(modulePath, ".git"));
        } catch (error) {
          Log.debug(`[MMM-Remote-Control] Module ${folderName} is not managed with git. Skip checking for updates: ${error}`);
          return;
        }

        const sg = simpleGit(modulePath);
        sg.fetch().status((err, data) => {
          if (!err) {
            if (data.behind > 0) {
              currentModule.updateAvailable = true;
            }
          }
        });
        if (!isInList) {
          sg.getRemotes(true, (error, result) => {
            if (error) {
              Log.error("[MMM-Remote-Control]", error);
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
      }
    });
  },

  loadModuleDefaultConfig (module, modulePath, lastOne) {
    const filename = path.resolve(`${modulePath}/${module.longname}.js`);

    try {
      fs.accessSync(filename, fs.constants.F_OK);

      /* Defaults are stored when Module.register is called during require(filename); */
      require(filename);
    } catch (e) {
      if (e instanceof ReferenceError) {
        Log.log(`[MMM-Remote-Control] Could not get defaults for ${module.longname}. See #335.`);
      } else if (e.code == "ENOENT") {
        Log.error(`[MMM-Remote-Control] Could not find main module js file for ${module.longname}`);
      } else if (e instanceof SyntaxError) {
        Log.error(`[MMM-Remote-Control] Could not validate main module js file for ${module.longname}`);
        Log.error(e);
      } else {
        Log.error(`[MMM-Remote-Control] Could not load main module js file for ${module.longname}. Error found: ${e}`);
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
          Log.error("[MMM-Remote-Control]", error);
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
        Log.error("[MMM-Remote-Control]", error);
      }
      let baseUrl = result[0].refs.fetch;
      // replacements
      baseUrl = baseUrl.replace(".git", "").replace("github.com:", "github.com/");
      // if cloned with ssh
      baseUrl = baseUrl.replace("git@", "https://");
      git.revparse(["HEAD"], (error, result) => {
        if (error) {
          Log.error("[MMM-Remote-Control]", error);
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
      const moduleDataFromBrowser = this.configData.moduleData.find((item) => item.name === current.module);

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
    // remove cached version
    delete require.cache[require.resolve(`${__dirname}/../../js/defaults.js`)];
    // then reload default config
    const defaultConfig = require(`${__dirname}/../../js/defaults.js`);

    for (const key in defaultConfig) {
      if (Object.hasOwn(defaultConfig, key) && config && Object.hasOwn(config, key) && JSON.stringify(defaultConfig[key]) === JSON.stringify(config[key])) {
        delete config[key];
      }
    }

    for (let i = 0; i < config.modules.length; i++) {
      const current = config.modules[i];
      const moduleDefaultsFromRequire = Module.configDefaults[current.module];
      // We need moduleDataFromBrowser for bundled modules like MMM-RAIN-MAP. See #331.
      const moduleDataFromBrowser = this.configData.moduleData.find((item) => item.name === current.module);
      const moduleDefaults = moduleDefaultsFromRequire || moduleDataFromBrowser?.defaults;

      if (!current.config) current.config = {};
      if (moduleDefaults) {
        for (const key in moduleDefaults) {
          if (Object.hasOwn(moduleDefaults, key) && Object.hasOwn(current.config, key) && JSON.stringify(moduleDefaults[key]) === JSON.stringify(current.config[key])) {
            delete current.config[key];
          }
        }
      }

      if (current.config["position"] === "") {
        delete current.config["position"];
      }

      if (current.header === "") {
        delete current.header;
      }

      Log.debug(current);
    }

    return config;
  },

  answerPost (query, req, res) {
    const self = this;

    if (query.data === "config") {
      const backupHistorySize = 5;
      const configPath = this.getConfigPath();

      let best = -1;
      let bestTime = null;
      for (let i = backupHistorySize - 1; i > 0; i--) {
        const backupPath = path.resolve(`config/config.js.backup${i}`);
        try {
          const stats = fs.statSync(backupPath);
          if (best === -1 || stats.mtime < bestTime) {
            best = i;
            bestTime = stats.mtime;
          }
        } catch (e) {
          if (e.code === "ENOENT") {
            // does not exist yet
            best = i;
            bestTime = "0000-00-00T00:00:00Z";
          }
        }
      }
      if (best === -1) {
        // can not backup, panic!
        Log.error("[MMM-Remote-Control] Backing up config failed, not saving!");
        self.sendResponse(res, new Error("Backing up config failed, not saving!"), {query});
        return;
      }
      const backupPath = path.resolve(`config/config.js.backup${best}`);

      const source = fs.createReadStream(configPath);
      const destination = fs.createWriteStream(backupPath);

      // back up last config
      source.pipe(destination, {end: false});
      source.on("end", () => {
        self.configOnHd = self.removeDefaultValues(req.body);

        const header = "/*************** AUTO GENERATED BY REMOTE CONTROL MODULE ***************/\n\nlet config = \n";
        const footer = "\n\n/*************** DO NOT EDIT THE LINE BELOW ***************/\nif (typeof module !== 'undefined') {module.exports = config;}\n";

        fs.writeFile(
          configPath, header + util.inspect(self.configOnHd, {
            showHidden: false,
            depth: null,
            maxArrayLength: null,
            compact: false
          }) + footer,
          (error) => {
            query.data = "config_update";
            if (error) {
              self.sendResponse(res, error, {query, backup: backupPath, data: self.configOnHd});
            }
            Log.info("MMM-Remote-Control saved new config!");
            Log.info(`Used backup: ${backupPath}`);
            self.sendResponse(res, undefined, {query, backup: backupPath, data: self.configOnHd});
          }
        );
      });
    }
  },

  answerGet (query, res) {
    const self = this;

    if (query.data === "moduleAvailable") {
      this.modulesAvailable.sort((a, b) => a.name.localeCompare(b.name));
      this.sendResponse(res, undefined, {query, data: this.modulesAvailable});
      return;
    }
    if (query.data === "moduleInstalled") {
      const filterInstalled = function (value) {
        return value.installed && !value.isDefaultModule;
      };
      const installed = self.modulesAvailable.filter(filterInstalled);
      installed.sort((a, b) => a.name.localeCompare(b.name));
      this.sendResponse(res, undefined, {query, data: installed});
      return;
    }
    if (query.data === "translations") {
      this.sendResponse(res, undefined, {query, data: this.translation});
      return;
    }
    if (query.data === "mmUpdateAvailable") {
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
      return;
    }
    if (query.data === "config") {
      this.sendResponse(res, undefined, {query, data: this.getConfig()});
      return;
    }
    if (query.data === "classes") {
      const thisConfig = this.getConfig().modules.find((m) => m.module === "MMM-Remote-Control").config || {};
      this.sendResponse(res, undefined, {query, data: thisConfig.classes
        ? thisConfig.classes
        : {}});
      return;
    }
    if (query.data === "saves") {
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
      return;
    }
    if (query.data === "defaultConfig") {
      if (!(query.module in Module.configDefaults)) {
        this.sendResponse(res, undefined, {query, data: {}});
      } else {
        this.sendResponse(res, undefined, {query, data: Module.configDefaults[query.module]});
      }
      return;
    }
    if (query.data === "modules") {
      if (!this.checkInitialized(res)) { return; }
      this.callAfterUpdate(() => {
        this.sendResponse(res, undefined, {query, data: self.configData.moduleData});
      });
      return;
    }
    if (query.data === "brightness") {
      if (!this.checkInitialized(res)) { return; }
      this.callAfterUpdate(() => {
        this.sendResponse(res, undefined, {query, result: self.configData.brightness});
      });
      return;
    }
    if (query.data === "temp") {
      if (!this.checkInitialized(res)) { return; }
      this.callAfterUpdate(() => {
        this.sendResponse(res, undefined, {query, result: self.configData.temp});
      });
      return;
    }
    if (query.data === "userPresence") {
      this.sendResponse(res, undefined, {query, result: this.userPresence});
      return;
    }
    // Unknown Command, Return Error
    this.sendResponse(res, "Unknown or Bad Command.", query);
  },

  callAfterUpdate (callback, timeout) {
    if (timeout === undefined) {
      timeout = 3000;
    }

    const waitObject = {
      finished: false,
      run () {
        if (this.finished) {
          return;
        }
        this.finished = true;
        this.callback();
      },
      callback
    };

    this.waiting.push(waitObject);
    this.sendSocketNotification("UPDATE");
    setTimeout(() => {
      waitObject.run();
    }, timeout);
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
      Log.error("[MMM-Remote-Control]", error);
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

  executeQuery (query, res) {
    const self = this;
    const opts = {timeout: 15000};

    if (["SHUTDOWN", "REBOOT"].indexOf(query.action) !== -1) {
      this.shutdownControl(query.action, opts, res);
      return true;
    }
    if (query.action === "RESTART" || query.action === "STOP") {
      this.controlPm2(res, query);
      return true;
    }
    if (query.action === "COMMAND") {
      if (this.thisConfig.customCommand && this.thisConfig.customCommand[query.command]) {
        exec(this.thisConfig.customCommand[query.command], opts, (error, stdout, stderr) => {
          self.checkForExecError(error, stdout, stderr, res, {stdout});
        });
      } else {
        self.sendResponse(res, new Error("Command not found"), query);
      }
      return true;
    }
    if (query.action === "USER_PRESENCE") {
      this.sendSocketNotification("USER_PRESENCE", query.value);
      this.userPresence = query.value;
      this.sendResponse(res, undefined, query);
      return true;
    }
    if (["MONITORON", "MONITOROFF", "MONITORTOGGLE", "MONITORSTATUS"].indexOf(query.action) !== -1) {
      this.monitorControl(query.action, opts, res);
      return true;
    }
    if (query.action === "HIDE" || query.action === "SHOW" || query.action === "TOGGLE") {
      self.sendSocketNotification(query.action, query);
      self.sendResponse(res);
      return true;
    }
    if (query.action === "BRIGHTNESS") {
      self.sendResponse(res);
      self.sendSocketNotification(query.action, query.value);
      return true;
    }
    if (query.action === "TEMP") {
      self.sendResponse(res);
      self.sendSocketNotification(query.action, query.value);
      return true;
    }
    if (query.action === "SAVE") {
      self.sendResponse(res);
      self.callAfterUpdate(() => { self.saveDefaultSettings(); });
      return true;
    }
    if (query.action === "MODULE_DATA") {
      self.callAfterUpdate(() => {
        self.sendResponse(res, undefined, self.configData);
      });
      return true;
    }
    if (query.action === "INSTALL") {
      self.installModule(query.url, res, query);
      return true;
    }
    if (query.action === "REFRESH") {
      self.sendResponse(res);
      self.sendSocketNotification(query.action);
      return true;
    }
    if (query.action === "HIDE_ALERT") {
      self.sendResponse(res);
      self.sendSocketNotification(query.action);
      return true;
    }
    if (query.action === "SHOW_ALERT") {
      self.sendResponse(res);

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

      self.sendSocketNotification(query.action, {
        type,
        title,
        message,
        timer: timer * 1000
      });
      return true;
    }
    if (query.action === "UPDATE") {
      self.updateModule(decodeURI(query.module), res);
      return true;
    }
    if (query.action === "NOTIFICATION") {
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
        Log.error("[MMM-Remote-Control]", error);
        this.sendResponse(res, error, {reason: error.message});
        return true;
      }
    }
    if (query.action === "MANAGE_CLASSES") {
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
      return;
    }
    if ([
      "MINIMIZE",
      "TOGGLEFULLSCREEN",
      "DEVTOOLS"
    ].indexOf(query.action) !== -1) {
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
      return;
    }
    if (query.action === "DELAYED") {

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
      return;
    }
    self.sendResponse(res, new Error(`Invalid Option: ${query.action}`));
    return false;
  },

  installModule (url, res, data) {
    const self = this;

    simpleGit(path.resolve(`${__dirname}/..`)).clone(url, path.basename(url), (error) => {
      if (error) {
        Log.error("[MMM-Remote-Control]", error);
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
                Log.error("[MMM-Remote-Control]", error);
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

  updateModule (module, res) {
    Log.log(`UPDATE ${module || "MagicMirror"}`);

    const self = this;

    let path = `${__dirname}/../../`;
    let name = "MM";

    if (typeof module !== "undefined" && module !== "undefined") {
      if (self.modulesAvailable) {
        const modData = self.modulesAvailable.find((m) => m.longname === module);
        if (modData === undefined) {
          this.sendResponse(res, new Error("Unknown Module"), {info: module});
          return;
        }

        path = `${__dirname}/../${modData.longname}`;
        name = modData.name;
      }
    }

    Log.log(`[MMM-Remote-Control] path: ${path} name: ${name}`);

    const git = simpleGit(path);
    git.reset("hard").then(() => {
      git.pull((error, result) => {
        if (error) {
          Log.error("[MMM-Remote-Control]", error);
          self.sendResponse(res, error);
          return;
        }
        if (result.summary.changes) {
          const packageJsonExists = fs.existsSync(`${path}/package.json`);
          if (packageJsonExists) {
            const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, "utf8"));
            const installNecessary = packageJson.dependencies || packageJson.scripts?.preinstall || packageJson.scripts?.postinstall;
            if (installNecessary) {
              const packageLockExists = fs.existsSync(`${path}/package-lock.json`);
              const command = packageLockExists
                ? "npm ci --omit=dev"
                : "npm install --omit=dev";

              exec(command, {cwd: path, timeout: 120000}, (error, stdout, stderr) => {
                if (error) {
                  Log.error("[MMM-Remote-Control]", error);
                  self.sendResponse(res, error, {stdout, stderr});
                } else {
                  // success part
                  self.readModuleData();

                  const changelogExists = fs.existsSync(`${path}/CHANGELOG.md`);
                  if (changelogExists) {
                    const changelog = fs.readFileSync(`${path}/CHANGELOG.md`, "utf-8");
                    self.sendResponse(res, undefined, {code: "restart", info: `${name} updated.`, chlog: changelog});
                  } else {
                    self.sendResponse(res, undefined, {code: "restart", info: `${name} updated.`});
                  }
                }
              });
            } else {
              self.sendResponse(res, undefined, {code: "up-to-date", info: `${name} already up to date.`});
            }
          }
        }
      });
    });

  },

  checkForExecError (error, stdout, stderr, res, data) {
    if (error) { Log.error("[MMM-Remote-Control]", stderr); }
    this.sendResponse(res, error, data);
  },

  controlPm2 (res, query) {
    try { require("pm2"); } catch (err) {
      this.sendResponse(res, err, {reason: "PM2 not installed or unlinked"});
      return;
    }
    const pm2 = require("pm2");
    const processName = query.processName || this.thisConfig.pm2ProcessName || "mm";

    pm2.connect((err) => {
      if (err) {
        this.sendResponse(res, err);
        return;
      }

      const actionName = query.action.toLowerCase();
      Log.log(`[MMM-Remote-Control] PM2 process: ${actionName} ${processName}`);

      switch (actionName) {
        case "restart":
          pm2.restart(processName, (err) => {
            this.sendResponse(res, undefined, {action: actionName, processName});
            if (err) { this.sendResponse(res, err); }
          });
          break;
        case "stop":
          pm2.stop(processName, (err) => {
            this.sendResponse(res, undefined, {action: actionName, processName});
            pm2.disconnect();
            if (err) { this.sendResponse(res, err); }
          });
          break;
      }
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

  in (pattern, string) {
    return string.indexOf(pattern) !== -1;
  },

  loadDefaultSettings () {
    const self = this;

    fs.readFile(path.resolve(`${__dirname}/settings.json`), (error, data) => {
      if (error) {
        if (self.in("no such file or directory", error.message)) {
          return;
        }
        Log.error("[MMM-Remote-Control]", error);
      } else {
        data = JSON.parse(data.toString());
        self.sendSocketNotification("DEFAULT_SETTINGS", data);
      }
    });
  },

  fillTemplates (data) {
    return this.translate(data);
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
        Log.log(`[MMM-Remote-Control] customMenu requested, but file:${menuPath} was not found.`);
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
