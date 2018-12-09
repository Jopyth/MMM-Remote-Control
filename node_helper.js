/* Magic Mirror
 * Module: Remote Control
 *
 * By Joseph Bethge
 * MIT Licensed.
 */
/* jshint node: true, esversion: 6 */

const NodeHelper = require("node_helper");
const path = require("path");
const url = require("url");
const fs = require("fs");
const exec = require("child_process").exec;
const os = require("os");
const simpleGit = require("simple-git");
const bodyParser = require("body-parser");
const express = require("express");

var defaultModules = require(path.resolve(__dirname + "/../default/defaultmodules.js"));

Module = {
    configDefaults: {},
    register: function(name, moduleDefinition) {
        // console.log("Module config loaded: " + name);
        Module.configDefaults[name] = moduleDefinition.defaults;
    }
};

module.exports = NodeHelper.create({
    // Subclass start method.
    start: function() {
        var self = this;

        console.log("Starting node helper for: " + self.name);

        // load fall back translation
        self.loadTranslation("en");

        this.configOnHd = {};
        this.configData = {};

        this.waiting = [];

        this.template = "";
        this.modulesAvailable = [];
        this.modulesInstalled = [];

        fs.readFile(path.resolve(__dirname + "/remote.html"), function(err, data) {
            self.template = data.toString();
        });

        this.combineConfig();
        this.readModuleData();
        this.createRoutes();
        this.createApiRoutes();
    },

    combineConfig: function() {
        // function copied from MichMich (MIT)
        var defaults = require(__dirname + "/../../js/defaults.js");
        var configFilename = path.resolve(__dirname + "/../../config/config.js");
        try {
            fs.accessSync(configFilename, fs.F_OK);
            var c = require(configFilename);
            var config = Object.assign({}, defaults, c);
            this.configOnHd = config;
        } catch (e) {
            if (e.code == "ENOENT") {
                console.error("WARNING! Could not find config file. Please create one. Starting with default configuration.");
                this.configOnHd = defaults;
            } else if (e instanceof ReferenceError || e instanceof SyntaxError) {
                console.error("WARNING! Could not validate config file. Please correct syntax errors. Starting with default configuration.");
                this.configOnHd = defaults;
            } else {
                console.error("WARNING! Could not load config file. Starting with default configuration. Error found: " + e);
                this.configOnHd = defaults;
            }
        }

        this.loadTranslation(this.configOnHd.language);
    },

    createRoutes: function() {
        var self = this;

        this.expressApp.get("/remote.html", function(req, res) {
            if (self.template === "") {
                res.send(503);
            } else {
                res.contentType("text/html");
                var transformedData = self.fillTemplates(self.template);
                res.send(transformedData);
            }
        });

        this.expressApp.get("/get", function(req, res) {
            var query = url.parse(req.url, true).query;

            self.answerGet(query, res);
        });
        this.expressApp.post("/post", function(req, res) {
            var query = url.parse(req.url, true).query;

            self.answerPost(query, req, res);
        });

        this.expressApp.get("/config-help.html", function(req, res) {
            var query = url.parse(req.url, true).query;

            self.answerConfigHelp(query, res);
        });

        this.expressApp.get("/remote", function(req, res) {
            var query = url.parse(req.url, true).query;

            if (query.action) {
                var result = self.executeQuery(query, res);
                if (result === true) {
                    return;
                }
            }
            res.send({ "status": "error", "reason": "unknown_command", "info": "original input: " + JSON.stringify(query) });
        });
    },

    getApiKey: function() {
        let thisConfig = this.configOnHd.modules.find(x => x.module === "MMM-Remote-Control");
        if (typeof "thisConfig" !== "undefined" &&
            "config" in thisConfig &&
            "apiKey" in thisConfig.config) {
            this.apiKey = thisConfig.config.apiKey;
        } else {
            this.apiKey = undefined;
        }
    },

    createApiRoutes: function() {
        var self = this;

        this.getApiKey();

        this.expressApp.use(bodyParser.urlencoded({ extended: true }));
        this.expressApp.use(bodyParser.json());

        this.expressRouter = express.Router();

        // Check for authorization if apiKey is defined in the config.
        // Can be passed as a header "Authorization: apiKey YOURAPIKEY"
        // or can be passed in the url ?apiKey=YOURAPIKEY
        this.expressRouter.use((req, res, next) => {
            if (typeof this.apiKey !== "undefined") {
                if (!("authorization" in req.headers) && req.headers.authorization.indexOf("apiKey") !== 0) {
                    // API Key was not provided as a header. Check the URL.
                    var query = url.parse(req.url, true).query;
                    if ("apiKey" in query) {
                        if (query.apiKey !== this.apiKey) {
                            return res.status(401).end();
                        }
                    } else {
                        return res.status(403).end();
                    }
                } else if (req.headers.authorization.split(" ")[1] !== this.apiKey) {
                    return res.status(401).end();
                }
            }

            next(); // make sure we go to the next routes and don't stop here
        });

        // Route for testing the api at http://mirror:8080/api/test
        this.expressRouter.route('/test')
            .get((req, res) => {
                res.json({ success: true });
            });

        this.expressRouter.route(['/modules',
            '/modulesInstalled',
            '/modulesAvailable',
            '/brightness',
            '/translations',
            '/mmUpdateAvailable',
            '/config',
            '/defaultConfig'
        ]).get((req, res) => {
            self.answerGet({ data: req.path.substring(1) }, res);
        });

        this.expressRouter.route('/modules/:moduleName')
            .get((req, res) => {
                res.json({ success: false, message: "API not yet implemented" });
            });

        this.expressRouter.route('/monitor/:action')
            .get((req, res) => {
                var actionName = req.params.action.toUpperCase();
                this.executeQuery({ action: `MONITOR${actionName}` }, res);
            });

        this.expressRouter.route('/brightness/:setting(\\d+)')
            .get((req, res) => {
                this.executeQuery({ action: `BRIGHTNESS`, value: req.params.setting }, res);
            });

        this.expressApp.use('/api', this.expressRouter);
    },

    capitalizeFirst: function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    formatName: function(string) {
        string = string.replace(/MMM?-/ig, "").replace(/_/g, " ").replace(/-/g, " ");
        string = string.replace(/([a-z])([A-Z])/g, function(txt) {
            // insert space into camel case
            return txt.charAt(0) + " " + txt.charAt(1);
        });
        string = string.replace(/\w\S*/g, function(txt) {
            // make character after white space upper case
            return txt.charAt(0).toUpperCase() + txt.substr(1);
        });
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    readModuleData: function() {
        var self = this;

        fs.readFile(path.resolve(__dirname + "/modules.json"), (err, data) => {
            self.modulesAvailable = JSON.parse(data.toString());

            for (var i = 0; i < self.modulesAvailable.length; i++) {
                self.modulesAvailable[i].name = self.formatName(self.modulesAvailable[i].longname);
                self.modulesAvailable[i].isDefaultModule = false;
            }

            for (var i = 0; i < defaultModules.length; i++) {
                self.modulesAvailable.push({
                    longname: defaultModules[i],
                    name: self.capitalizeFirst(defaultModules[i]),
                    isDefaultModule: true,
                    installed: true,
                    author: "MichMich",
                    desc: "",
                    id: "MichMich/MagicMirror",
                    url: "https://github.com/MichMich/MagicMirror/wiki/MagicMirror%C2%B2-Modules#default-modules"
                });
                var module = self.modulesAvailable[self.modulesAvailable.length - 1];
                var modulePath = self.configOnHd.paths.modules + "/default/" + defaultModules[i];
                self.loadModuleDefaultConfig(module, modulePath);
            }

            // now check for installed modules
            fs.readdir(path.resolve(__dirname + "/.."), function(err, files) {
                for (var i = 0; i < files.length; i++) {
                    if (files[i] !== "node_modules" && files[i] !== "default") {
                        self.addModule(files[i]);
                    }
                }
            });
        });
    },

    addModule: function(folderName) {
        var self = this;

        var modulePath = this.configOnHd.paths.modules + "/" + folderName;
        fs.stat(modulePath, (err, stats) => {
            if (stats.isDirectory()) {
                var isInList = false;
                var currentModule;
                self.modulesInstalled.push(folderName);
                for (var i = 0; i < self.modulesAvailable.length; i++) {
                    if (self.modulesAvailable[i].longname === folderName) {
                        isInList = true;
                        self.modulesAvailable[i].installed = true;
                        currentModule = self.modulesAvailable[i];
                    }
                }
                if (!isInList) {
                    var newModule = {
                        longname: folderName,
                        name: self.formatName(folderName),
                        isDefaultModule: false,
                        installed: true,
                        author: "unknown",
                        desc: "",
                        id: "local/" + folderName,
                        url: ""
                    };
                    self.modulesAvailable.push(newModule);
                    currentModule = newModule;
                }
                self.loadModuleDefaultConfig(currentModule, modulePath);

                // check for available updates
                var stat;
                try {
                    stat = fs.statSync(path.join(modulePath, '.git'));
                } catch (err) {
                    // Error when directory .git doesn't exist
                    // This module is not managed with git, skip
                    return;
                }

                var sg = simpleGit(modulePath);
                sg.fetch().status(function(err, data) {
                    if (!err) {
                        if (data.behind > 0) {
                            currentModule.updateAvailable = true;
                        }
                    }
                });
                if (!isInList) {
                    sg.getRemotes(true, function(error, result) {
                        if (error) {
                            console.log(error);
                        }
                        var baseUrl = result[0].refs.fetch;
                        // replacements
                        baseUrl = baseUrl.replace(".git", "").replace("github.com:", "github.com/")
                        // if cloned with ssh
                        currentModule.url = baseUrl.replace("git@", "https://");
                    });
                }
            }
        });
    },

    loadModuleDefaultConfig: function(module, modulePath) {
        // function copied from MichMich (MIT)
        var filename = path.resolve(modulePath + "/" + module.longname + ".js");
        try {
            fs.accessSync(filename, fs.F_OK);
            var jsfile = require(filename);
            // module.configDefault = Module.configDefaults[module.longname];
        } catch (e) {
            if (e.code == "ENOENT") {
                console.error("ERROR! Could not find main module js file for " + module.longname);
            } else if (e instanceof ReferenceError || e instanceof SyntaxError) {
                console.error("ERROR! Could not validate main module js file.");
                console.error(e);
            } else {
                console.error("ERROR! Could not load main module js file. Error found: " + e);
            }
        }
    },

    answerConfigHelp: function(query, res) {
        if (defaultModules.indexOf(query.module) !== -1) {
            // default module
            var dir = path.resolve(__dirname + "/..");
            var git = simpleGit(dir);
            git.revparse(["HEAD"], function(error, result) {
                if (error) {
                    console.log(error);
                }
                res.writeHead(302, { 'Location': "https://github.com/MichMich/MagicMirror/tree/" + result.trim() + "/modules/default/" + query.module });
                res.end();
            });
            return;
        }
        var modulePath = this.configOnHd.paths.modules + "/" + query.module;
        var git = simpleGit(modulePath);
        git.getRemotes(true, function(error, result) {
            if (error) {
                console.log(error);
            }
            var baseUrl = result[0].refs.fetch;
            // replacements
            baseUrl = baseUrl.replace(".git", "").replace("github.com:", "github.com/")
            // if cloned with ssh
            baseUrl = baseUrl.replace("git@", "https://");
            git.revparse(["HEAD"], function(error, result) {
                if (error) {
                    console.log(error);
                }
                res.writeHead(302, { 'Location': baseUrl + "/tree/" + result.trim() });
                res.end();
            });
        });
    },

    getConfig: function() {
        var config = this.configOnHd;
        for (var i = 0; i < config.modules.length; i++) {
            var current = config.modules[i];
            var def = Module.configDefaults[current.module];
            if (!("config" in current)) {
                current.config = {};
            }
            if (!def) {
                def = {};
            }
            for (var key in def) {
                if (!(key in current.config)) {
                    current.config[key] = def[key];
                }
            }
        }
        return config;
    },

    removeDefaultValues: function(config) {
        // remove cached version
        delete require.cache[require.resolve(__dirname + "/../../js/defaults.js")];
        // then reload default config
        var defaultConfig = require(__dirname + "/../../js/defaults.js");

        for (var key in defaultConfig) {
            if (defaultConfig.hasOwnProperty(key) && config.hasOwnProperty(key) && defaultConfig[key] === config[key]) {
                delete config[key];
            }
        }

        for (var i = 0; i < config.modules.length; i++) {
            var current = config.modules[i];
            var def = Module.configDefaults[current.module];
            if (!def) {
                def = {};
            }
            for (var key in def) {
                if (def.hasOwnProperty(key) && current.config.hasOwnProperty(key) && def[key] === current.config[key]) {
                    delete current.config[key];
                }
            }
            console.log(current.config);
            if (current.config === {}) {
                delete current[config];
                continue;
            }
            console.log(current);
        }

        return config;
    },

    answerPost: function(query, req, res) {
        var self = this;

        if (query.data === "config") {
            var backupHistorySize = 5;
            var configPath = path.resolve("config/config.js");

            var best = -1;
            var bestTime = null;
            for (var i = backupHistorySize - 1; i > 0; i--) {
                var backupPath = path.resolve("config/config.js.backup" + i);
                try {
                    var stats = fs.statSync(backupPath);
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
                console.log("MMM-Remote-Control Error! Backing up config failed, not saving!");
                return;
            }
            var backupPath = path.resolve("config/config.js.backup" + best);

            var source = fs.createReadStream(configPath);
            var destination = fs.createWriteStream(backupPath);

            // back up last config
            source.pipe(destination, { end: false });
            source.on("end", function() {
                self.configOnHd = self.removeDefaultValues(req.body);

                var header = "/*************** AUTO GENERATED BY REMOTE CONTROL MODULE ***************/\n\nvar config = \n";
                var footer = "\n\n/*************** DO NOT EDIT THE LINE BELOW ***************/\nif (typeof module !== 'undefined') {module.exports = config;}\n";

                fs.writeFile(configPath, header + self.convertToText(req.body) + footer);

                console.log("MMM-Remote-Control saved new config!");
                console.log("Used backup: " + backupPath);

                res.json({ success: true });
            });
        }
    },

    convertToText: function(obj, indentation) {
        var simpleIdentifier = new RegExp("^[a-zA-Z_$][0-9a-zA-Z_$]*$");
        if (indentation === undefined) {
            indentation = 0;
        }
        var indent = [];
        for (var i = 0; i <= indentation; i++) {
            indent.push("");
        }

        var nl = "\n" + indent.join("\t");
        var inl = nl + "\t";

        //create an array that will later be joined into a string.
        var string = [];

        if (obj == undefined) {
            return String(obj);
        } else if (typeof(obj) == "object" && !(Array.isArray(obj))) {
            for (prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    var leftHand = prop;
                    if (!simpleIdentifier.test(prop)) {
                        leftHand = "\"" + prop + "\"";
                    }
                    string.push(leftHand + ": " + this.convertToText(obj[prop], indentation + 1));
                }
            };
            return "{" + inl + string.join("," + inl) + nl + "}";
        } else if (typeof(obj) == "object" && Array.isArray(obj)) {
            for (prop in obj) {
                string.push(this.convertToText(obj[prop], indentation + 1));
            }
            return "[" + inl + string.join("," + inl) + nl + "]";
        } else if (typeof(obj) == "function") {
            string.push(obj.toString())
        } else {
            string.push(JSON.stringify(obj))
        }

        return string.join("," + nl);
    },

    answerGet: function(query, res) {
        var self = this;

        if (query.data === "modulesAvailable") {
            this.modulesAvailable.sort(function(a, b) { return a.name.localeCompare(b.name); });
            res.json(this.modulesAvailable);
        }
        if (query.data === "modulesInstalled") {
            var filterInstalled = function(value) {
                return value.installed && !value.isDefaultModule;
            };
            var installed = self.modulesAvailable.filter(filterInstalled);
            installed.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });
            res.json(installed);
        }
        if (query.data === "translations") {
            res.json(this.translation);
        }
        if (query.data === "mmUpdateAvailable") {
            var sg = simpleGit(__dirname + "/..");
            sg.fetch().status(function(err, data) {
                if (!err) {
                    if (data.behind > 0) {
                        res.json(true);
                        return;
                    }
                }
                res.json(false);
            });
        }
        if (query.data === "config") {
            res.json(this.getConfig());
        }
        if (query.data === "defaultConfig") {
            if (!(query.module in Module.configDefaults)) {
                res.json({});
            } else {
                res.json(Module.configDefaults[query.module]);
            }
        }
        if (query.data === "modules") {
            this.callAfterUpdate(function() {
                res.json(self.configData.moduleData);
            });
        }
        if (query.data === "brightness") {
            this.callAfterUpdate(function() {
                res.json(self.configData.brightness);
            });
        }
    },

    callAfterUpdate: function(callback, timeout) {
        if (timeout === undefined) {
            timeout = 3000;
        }

        var waitObject = {
            finished: false,
            run: function() {
                if (this.finished) {
                    return;
                }
                this.finished = true;
                this.callback();
            },
            callback: callback
        };

        this.waiting.push(waitObject);
        this.sendSocketNotification("UPDATE");
        setTimeout(function() {
            waitObject.run();
        }, timeout);
    },

    sendResponse: function(res, error, data) {
        let response = { success: true };
        if (error) {
            console.log(error);
            if (res) {
                response = { success: false, status: "error", reason: "unknown", info: error };
            }
        }
        if (data) {
            response = Object.assign({}, response, data);
        }
        if (res) {
            if ("isSocket" in res && res.isSocket) {
                this.sendSocketNotification("REMOTE_ACTION_RESULT", response);
            } else {
                res.json(response);
            }
        }
    },

    executeQuery: function(query, res) {
        var self = this;
        var opts = { timeout: 15000 };

        // If the query came from a socket notification, send result on same
        if ("isSocket" in query && query.isSocket && typeof res === "undefined") {
            res = { isSocket: true };
        }

        if (query.action === "SHUTDOWN") {
            exec("sudo shutdown -h now", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr, res); });
            return true;
        }
        if (query.action === "REBOOT") {
            exec("sudo shutdown -r now", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr, res); });
            return true;
        }
        if (query.action === "RESTART") {
            exec("pm2 ls", opts, (error, stdout, stderr) => {
                if (stdout.indexOf(" MagicMirror ") > -1) {
                    exec("pm2 restart MagicMirror", opts, (error, stdout, stderr) => {
                        self.sendSocketNotification("RESTART");
                        self.checkForExecError(error, stdout, stderr, res);
                    });
                    return;
                }
                if (stdout.indexOf(" mm ") > -1) {
                    exec("pm2 restart mm", opts, (error, stdout, stderr) => {
                        self.sendSocketNotification("RESTART");
                        self.checkForExecError(error, stdout, stderr, res);
                    });
                    return;
                }
                self.sendResponse(res, error);
            });
            return true;
        }
        if (query.action === "MONITORON") {
            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr, res); });
            return true;
        }
        if (query.action === "MONITOROFF") {
            exec("tvservice -o", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr, res); });
            return true;
        }
        if (query.action === "HIDE" || query.action === "SHOW") {
            self.sendResponse(res);
            var payload = { module: query.module };
            if (query.action === "SHOW" && query.force === "true") {
                payload.force = true;
            }
            self.sendSocketNotification(query.action, payload);
            return true;
        }
        if (query.action === "BRIGHTNESS") {
            self.sendResponse(res);
            self.sendSocketNotification(query.action, query.value);
            return true;
        }
        if (query.action === "SAVE") {
            self.sendResponse(res);
            self.callAfterUpdate(function() { self.saveDefaultSettings(); });
            return true;
        }
        if (query.action === "MODULE_DATA") {
            self.callAfterUpdate(function() {
                self.sendResponse(res, undefined, self.configData);
            });
            return true;
        }
        if (query.action === "INSTALL") {
            self.installModule(query.url, res);
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

            var type = query.type ? query.type : "alert";
            var title = query.title ? query.title : "Note";
            var message = query.message ? query.message : "Attention!";
            var timer = query.timer ? query.timer : 4;

            self.sendSocketNotification(query.action, {
                type: type,
                title: title,
                message: message,
                timer: timer * 1000
            });
            return true;
        }
        if (query.action === "UPDATE") {
            self.updateModule(decodeURI(query.module), res);
            return true;
        }
        if (query.action === 'NOTIFICATION') {
            try {
                var payload = {}; // Assume empty JSON-object if no payload is provided
                if (typeof query.payload === 'undefined') {
                    payload = query.payload;
                } else {
                    payload = JSON.parse(query.payload);
                }

                this.sendSocketNotification(query.action, { 'notification': query.notification, 'payload': payload });
                this.sendResponse(res);
                return true;
            } catch (err) {
                console.log("ERROR: ", err);
                this.sendResponse(res, err, { reason: err.message });
                return true;
            }
        }
        self.sendResponse(res, new Error(`Invalid Option: ${ query.action }`));
        return false;
    },

    installModule: function(url, res) {
        var self = this;

        res.contentType("application/json");

        simpleGit(path.resolve(__dirname + "/..")).clone(url, path.basename(url), function(error, result) {
            if (error) {
                console.log(error);
                self.sendResponse(res, error);
            } else {
                var workDir = path.resolve(__dirname + "/../" + path.basename(url));
                exec("npm install", { cwd: workDir, timeout: 120000 }, (error, stdout, stderr) => {
                    if (error) {
                        console.log(error);
                        this.sendResponse(res, error, { stdout: stdout, stderr: stderr });
                    } else {
                        // success part
                        self.readModuleData();
                        this.sendResponse(res, undefined, { stdout: stdout });
                    }
                });
            }
        });
    },

    updateModule: function(module, res) {
        console.log("UPDATE " + module);

        var self = this;

        var path = __dirname + "/../../";
        var name = "MM";

        if (module !== undefined && module !== 'undefined') {
            if (self.modulesAvailable) {
                var modData = self.modulesAvailable.find(m => m.longname === module);
                if (modData === undefined) {
                    this.sendResponse(res, new Error("Unknown Module"), { info: modules });
                    return;
                }

                path = __dirname + "/../" + modData.longname;
                name = modData.name;
            }
        }

        console.log("path: " + path + " name: " + name);

        var git = simpleGit(path);
        git.pull((error, result) => {
            if (error) {
                console.log(error);
                self.sendResponse(res, error);
                return;
            }
            if (result.summary.changes) {
                exec("npm install", { cwd: path, timeout: 120000 }, (error, stdout, stderr) => {
                    if (error) {
                        console.log(error);
                        self.sendResponse(res, error, { stdout: stdout, stderr: stderr });
                    } else {
                        // success part
                        self.readModuleData();
                        self.sendResponse(res, undefined, { code: "restart", info: name + " updated." });
                    }
                });
            } else {
                self.sendResponse(res, undefined, { code: "up-to-date", info: name + " already up to date." });
            }
        });
    },

    checkForExecError: function(error, stdout, stderr, res) {
        console.log(stdout);
        console.log(stderr);
        this.sendResponse(res, error);
    },

    translate: function(data) {
        for (var key in this.translation) {
            var pattern = "%%TRANSLATE:" + key + "%%";
            while (data.indexOf(pattern) > -1) {
                data = data.replace(pattern, this.translation[key]);
            }
        }
        return data;
    },

    saveDefaultSettings: function() {
        var moduleData = this.configData.moduleData;
        var simpleModuleData = [];
        for (var k = 0; k < moduleData.length; k++) {
            simpleModuleData.push({});
            simpleModuleData[k].identifier = moduleData[k].identifier;
            simpleModuleData[k].hidden = moduleData[k].hidden;
            simpleModuleData[k].lockStrings = moduleData[k].lockStrings;
        }

        var text = JSON.stringify({
            moduleData: simpleModuleData,
            brightness: this.configData.brightness,
            settingsVersion: this.configData.settingsVersion
        });

        fs.writeFile(path.resolve(__dirname + "/settings.json"), text, function(err) {
            if (err) {
                throw err;
            }
        });
    },

    in: function(pattern, string) {
        return string.indexOf(pattern) !== -1;
    },

    loadDefaultSettings: function() {
        var self = this;

        fs.readFile(path.resolve(__dirname + "/settings.json"), function(err, data) {
            if (err) {
                if (self.in("no such file or directory", err.message)) {
                    return;
                }
                console.log(err);
            } else {
                var data = JSON.parse(data.toString());
                self.sendSocketNotification("DEFAULT_SETTINGS", data);
            }
        });
    },

    fillTemplates: function(data) {
        return this.translate(data);
    },

    loadTranslation: function(language) {
        var self = this;

        fs.readFile(path.resolve(__dirname + "/translations/" + language + ".json"), function(err, data) {
            if (err) {
                return;
            } else {
                self.translation = Object.assign({}, self.translation, JSON.parse(data.toString()));
            }
        });
    },

    getIpAddresses: function() {
        // module started, answer with current IP address
        var interfaces = os.networkInterfaces();
        var addresses = [];
        for (var k in interfaces) {
            for (var k2 in interfaces[k]) {
                var address = interfaces[k][k2];
                if (address.family === "IPv4" && !address.internal) {
                    addresses.push(address.address);
                }
            }
        }
        return addresses;
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;

        if (notification === "CURRENT_STATUS") {
            this.configData = payload;
            for (var i = 0; i < this.waiting.length; i++) {
                var waitObject = this.waiting[i];

                waitObject.run();
            }
            this.waiting = [];
        }
        if (notification === "REQUEST_DEFAULT_SETTINGS") {
            // module started, answer with current ip addresses
            self.sendSocketNotification("IP_ADDRESSES", self.getIpAddresses());

            // check if we have got saved default settings
            self.loadDefaultSettings();
        }

        if (notification === "REMOTE_ACTION") {
            payload.isSocket = true;
            this.executeQuery(payload);
        }

        if (notification === "REMOTE_CLIENT_CONNECTED") {
            this.sendSocketNotification("REMOTE_CLIENT_CONNECTED");
        }
    }
});