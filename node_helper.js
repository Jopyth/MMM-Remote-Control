/* Magic Mirror
 * Module: Remote Control
 *
 * By Joseph Bethge
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const path = require("path");
const url = require("url");
const fs = require("fs");
const exec = require("child_process").exec;
const os = require("os");
const simpleGit = require("simple-git");
const bodyParser = require("body-parser");

var defaultModules = require(path.resolve(__dirname + "/../default/defaultmodules.js"));

Module = {
	configDefaults: {},
	register: function (name, moduleDefinition) {
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

		this.expressApp.use(bodyParser.json());

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

		this.expressApp.get("/remote", function (req, res) {
			var query = url.parse(req.url, true).query;

			if (query.action)
			{
				var result = self.executeQuery(query, res);
				if (result === true) {
					return;
				}
			}
			res.send({"status": "error", "reason": "unknown_command", "info": "original input: " + JSON.stringify(query)});
		});
	},

	capitalizeFirst: function(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},

	formatName: function(string) {
		string = string.replace(/MMM?-/ig, "").replace(/_/g, " ").replace(/-/g, " ");
		string = string.replace(/([a-z])([A-Z])/g, function(txt){
			// insert space into camel case
			return txt.charAt(0) + " " + txt.charAt(1);
		});
		string = string.replace(/\w\S*/g, function(txt){
			// make character after white space upper case
			return txt.charAt(0).toUpperCase() + txt.substr(1);
		});
		return string.charAt(0).toUpperCase() + string.slice(1);
	},

	readModuleData: function() {
		var self = this;

		fs.readFile(path.resolve(__dirname + "/modules.json"), function(err, data) {
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
		fs.stat(modulePath, function(err, stats) {
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
				} catch(err) {
					// Error when directory .git doesn't exist
					// This module is not managed with git, skip
					return;
				}

				var sg = simpleGit(modulePath);
				sg.fetch().status(function(err, data) {
					if (!err) {
						if (data.behind > 0)
						{
							currentModule.updateAvailable = true;
						}
					}
				});
				if (!isInList)
				{
					sg.getRemotes(true, function (error, result) {
						if (error) {
							console.log(error);
						}
						var baseUrl = result[0].refs.fetch;
						// replacements
						baseUrl = baseUrl.replace(".git", "").replace("github.com:","github.com/")
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
			git.revparse(["HEAD"], function (error, result) {
				if (error) {
					console.log(error);
				}
				res.writeHead(302, {'Location': "https://github.com/MichMich/MagicMirror/tree/" + result.trim() + "/modules/default/" + query.module});
				res.end();
			});
			return;
		}
		var modulePath = this.configOnHd.paths.modules + "/" + query.module;
		var git = simpleGit(modulePath);
		git.getRemotes(true, function (error, result) {
			if (error) {
				console.log(error);
			}
			var baseUrl = result[0].refs.fetch;
			// replacements
			baseUrl = baseUrl.replace(".git", "").replace("github.com:","github.com/")
			// if cloned with ssh
			baseUrl = baseUrl.replace("git@", "https://");
			git.revparse(["HEAD"], function (error, result) {
				if (error) {
					console.log(error);
				}
				res.writeHead(302, {'Location': baseUrl + "/tree/" + result.trim()});
				res.end();
			});
		});
	},

	getConfig: function () {
		var config = this.configOnHd;
		for (var i = 0; i < config.modules.length; i++) {
			var current = config.modules[i];
			var def = Module.configDefaults[current.module];
			if (! ("config" in current)) {
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

				var text = JSON.stringify({"status": "success"});
				res.contentType("application/json");
				res.send(text);
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

		if (query.data === "modulesAvailable")
		{
			this.modulesAvailable.sort(function(a, b){return a.name.localeCompare(b.name);});
			var text = JSON.stringify(this.modulesAvailable);
			res.contentType("application/json");
			res.send(text);
		}
		if (query.data === "modulesInstalled")
		{
			var filterInstalled = function(value){
				return value.installed && !value.isDefaultModule;
			};
			var installed = self.modulesAvailable.filter(filterInstalled);
			installed.sort(function(a, b) {
				return a.name.localeCompare(b.name);
			});
			var text = JSON.stringify(installed);
			res.contentType("application/json");
			res.send(text);
		}
		if (query.data === "translations")
		{
			var text = JSON.stringify(this.translation);
			res.contentType("application/json");
			res.send(text);
		}
		if (query.data === "mmUpdateAvailable")
		{
			var sg = simpleGit(__dirname + "/..");
			sg.fetch().status(function(err, data) {
				if (!err) {
					if (data.behind > 0)
					{
						res.contentType("application/json");
						res.send(JSON.stringify(true));
						return;
					}
				}
				res.contentType("application/json");
				res.send(JSON.stringify(false));
			});
		}
		if (query.data === "config")
		{
			var text = JSON.stringify(this.getConfig());
			res.contentType("application/json");
			res.send(text);
		}
		if (query.data === "defaultConfig")
		{
			if (!(query.module in Module.configDefaults)) {
				res.contentType("application/json");
				res.send({});
			} else {
				var text = JSON.stringify(Module.configDefaults[query.module]);
				res.contentType("application/json");
				res.send(text);
			}
		}
		if (query.data === "modules")
		{
			this.callAfterUpdate(function () {
				var text = JSON.stringify(self.configData.moduleData);
				res.contentType("application/json");
				res.send(text);
			});
		}
		if (query.data === "brightness")
		{
			this.callAfterUpdate(function () {
				var text = JSON.stringify(self.configData.brightness);
				res.contentType("application/json");
				res.send(text);
			});
		}
	},

	callAfterUpdate: function(callback, timeout) {
		if (timeout === undefined) {
			timeout = 3000;
		}

		var waitObject = {
			finished: false,
			run: function () {
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

	executeQuery: function(query, res) {
		var self = this;
		var opts = {timeout: 15000};

		if (query.action === "SHUTDOWN")
		{
			exec("sudo shutdown -h now", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "REBOOT")
		{
			exec("sudo shutdown -r now", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "RESTART")
		{
			exec("pm2 ls", opts, function(error, stdout, stderr) {
				if (stdout.indexOf(" MagicMirror ") > -1)
				{
					exec("pm2 restart MagicMirror", opts, function(error, stdout, stderr) {
						self.sendSocketNotification("RESTART");
						self.checkForExecError(error, stdout, stderr, res);
					});
					return;
				}
				if (stdout.indexOf(" mm ") > -1)
				{
					exec("pm2 restart mm", opts, function(error, stdout, stderr) {
						self.sendSocketNotification("RESTART");
						self.checkForExecError(error, stdout, stderr, res);
					});
					return;
				}
				if (res) { res.send({"status": "error", "reason": "unknown", "info": error}); }
			});
			return true;
		}
		if (query.action === "MONITORON")
		{
			exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "MONITOROFF")
		{
			exec("tvservice -o", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "HIDE" || query.action === "SHOW")
		{
			if (res) { res.send({"status": "success"}); }
			var payload = { module: query.module};
			if (query.action === "SHOW" && query.force === "true") {
				payload.force = true;
			}
			self.sendSocketNotification(query.action, payload);
			return true;
		}
		if (query.action === "BRIGHTNESS")
		{
			res.send({"status": "success"});
			self.sendSocketNotification(query.action, query.value);
			return true;
		}
		if (query.action === "SAVE")
		{
			if (res) { res.send({"status": "success"}); }
			self.callAfterUpdate(function () { self.saveDefaultSettings(); });
			return true;
		}
		if (query.action === "MODULE_DATA")
		{
			self.callAfterUpdate(function () {
				var text = JSON.stringify(self.configData);
				res.contentType("application/json");
				res.send(text);
			});
			return true;
		}
		if (query.action === "INSTALL")
		{
			self.installModule(query.url, res);
			return true;
		}
		if (query.action === "REFRESH")
		{
			if (res) { res.send({"status": "success"}); }
			self.sendSocketNotification(query.action);
			return true;
		}
		if (query.action === "HIDE_ALERT")
		{
			if (res) { res.send({"status": "success"}); }
			self.sendSocketNotification(query.action);
			return true;
		}
		if (query.action === "SHOW_ALERT")
		{
			if (res) { res.send({"status": "success"}); }

			var type = query.type ? query.type : "alert";
			var title = query.title ? query.title : "Note";
			var message = query.message ? query.message : "Attention!";
			var timer = query.timer ? query.timer : 4;

			self.sendSocketNotification(query.action, {
				type: type, title: title, message: message, timer: timer * 1000
			});
			return true;
		}
		if (query.action === "UPDATE")
		{
			self.updateModule(decodeURI(query.module), res);
			return true;
		}
		if (query.action === 'NOTIFICATION')
		{
			try {
				var payload = {}; // Assume empty JSON-object if no payload is provided
				if (typeof query.payload === 'undefined') {
					payload = query.payload;
				} else {
					payload = JSON.parse(query.payload);
				}

				this.sendSocketNotification(query.action, {'notification': query.notification, 'payload': payload});
				res.send({'status': 'success'});
				return true;
			} catch(err) {
				console.log("ERROR: ", err);
				res.send({'status': err.message});
				return true;
			}
		}
		return false;
	},

	installModule: function(url, res) {
		var self = this;

		res.contentType("application/json");

		simpleGit(path.resolve(__dirname + "/..")).clone(url, path.basename(url), function(error, result) {
			if (error) {
				console.log(error);
				res.send({"status": "error"});
			} else {
				var workDir = path.resolve(__dirname + "/../" + path.basename(url));
				exec("npm install", {cwd: workDir, timeout: 120000}, function(error, stdout, stderr)
				{
					if (error) {
						console.log(error);
						res.send({"status": "error", "stdout": stdout, "stderr": stderr});
					} else {
						// success part
						self.readModuleData();
						res.send({"status": "success", "stdout": stdout});
					}
				});
			}
		});
	},

	updateModule: function(module, res) {
		console.log("UPDATE "+ module);

		var self = this;

		var path = __dirname + "/../../";
		var name = "MM";

		if (module !== undefined && module !== 'undefined') {
			if(self.modulesAvailable) {
				var modData = self.modulesAvailable.find(m => m.longname === module);
				if (modData === undefined) {
					if (res) {
						res.send({"status": "error", "reason": "unknown module", "info": module});
					}
					return;
				}

				path = __dirname + "/../" + modData.longname;
				name = modData.name;
			}
		}

		console.log("path: " + path + " name: " + name);

		var git = simpleGit(path);
		git.pull(function (error, result) {
			if (error)
			{
				console.log(error);
				if (res) {
					res.send({"status": "error", "reason": "unknown", "info": error});
				}
				return;
			}
			if (result.summary.changes)
			{
				exec("npm install", {cwd: path, timeout: 120000}, function(error, stdout, stderr)
				{
					if (error) {
						console.log(error);
						if (res) { res.send({"status": "error", "stdout": stdout, "stderr": stderr}); }
					} else {
						// success part
						self.readModuleData();
						if (res) { res.send({"status": "success", "code": "restart", "info": name + " updated."}); }
					}
				});
			} else {
				if (res) { res.send({"status": "success", "code": "up-to-date", "info": name + " already up to date."}); }
			}
		});
	},

	checkForExecError: function(error, stdout, stderr, res) {
		console.log(stdout);
		console.log(stderr);
		if (error) {
			console.log(error);
			if (res) { res.send({"status": "error", "reason": "unknown", "info": error}); }
			return;
		}
		if (res) { res.send({"status": "success"}); }
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
			}
			else {
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

		if (notification === "CURRENT_STATUS")
		{
			this.configData = payload;
			for (var i = 0; i < this.waiting.length; i++) {
				var waitObject = this.waiting[i];

				waitObject.run();
			}
			this.waiting = [];
		}
		if (notification === "REQUEST_DEFAULT_SETTINGS")
		{
			// module started, answer with current ip addresses
			self.sendSocketNotification("IP_ADDRESSES", self.getIpAddresses());

			// check if we have got saved default settings
			self.loadDefaultSettings();
		}

		if (notification === "REMOTE_ACTION")
		{
			this.executeQuery(payload);
		}

	}
});
