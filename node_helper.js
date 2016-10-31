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
const simpleGit = require("simple-git")(path.resolve(__dirname + "/.."));

module.exports = NodeHelper.create({
	// Subclass start method.
	start: function() {
		var self = this;

		console.log("Starting node helper for: " + self.name);

		// load fall back translation
		self.loadTranslation("en");

		this.configData = {};

		this.waiting = [];

		this.template = "";
		this.modulesAvailable = {};
		this.modulesInstalled = [];

		fs.readFile(path.resolve(__dirname + "/remote.html"), function(err, data) {
			self.template = data.toString();
		});

		this.readModuleData();

		this.expressApp.get("/remote.html", function(req, res) {
			if (self.template === "") {
				res.send(503);
			} else {
				self.callAfterUpdate(function () {
					res.contentType("text/html");
					var transformedData = self.fillTemplates(self.template);
					res.send(transformedData);
				});
			}
		});

		this.expressApp.get("/get", function(req, res) {
			var query = url.parse(req.url, true).query;

			self.answerGet(query, res);
		});

		this.expressApp.get("/remote", (req, res) => {
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

	readModuleData: function() {
		var self = this;

		fs.readFile(path.resolve(__dirname + "/modules.json"), function(err, data) {
			self.modulesAvailable = JSON.parse(data.toString());

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

	addModule: function(module) {
		var self = this;

		var modulePath = path.resolve(__dirname + "/../" + module);
		fs.stat(modulePath, function(err, stats) {
			if (stats.isDirectory()) {
				self.modulesInstalled.push(module);
				for (var i = 0; i < self.modulesAvailable.length; i++) {
					if (self.modulesAvailable[i].longname === module) {
						self.modulesAvailable[i].installed = true;
					}
				}
			}
		});
	},

	answerGet: function(query, res) {
		var self = this;

		if (query.data === "modulesAvailable")
		{
			var text = JSON.stringify(this.modulesAvailable);
			res.contentType("application/json");
			res.send(text);
		}
		if (query.data === "translations")
		{
			var text = JSON.stringify(this.translation);
			res.contentType("application/json");
			res.send(text);
		}
		if (query.data === "modules")
		{
			this.callAfterUpdate(function () {
				var text = JSON.stringify(self.configData.moduleData);
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
		}

		this.waiting.push(waitObject);
		this.sendSocketNotification("UPDATE");
		setTimeout(function() {
			waitObject.run();
		}, timeout);
	},
	
	executeQuery: function(query, res) {
		var self = this;
		var opts = {timeout: 8000};

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
			exec("pm2 restart mm", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "MONITORON")
		{
			exec("/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "MONITOROFF")
		{
			exec("/opt/vc/bin/tvservice -o", opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === "HIDE" || query.action === "SHOW")
		{
			if (res) { res.send({"status": "success"}); }
			var payload = { module: query.module, useLockStrings: query.useLockStrings };
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
		return false;
	},

	installModule: function(url, res) {
		var self = this;

		res.contentType("application/json");

		simpleGit.clone(url, path.basename(url), function(error, result) {
			if (error) {
				console.log(error);
				res.send({"status": "error"});
			} else {
				var workDir = path.resolve(__dirname + "/../" + path.basename(url));
				exec("npm install", {cwd: workDir, timeout: 120000}, function(error, stdout, stderr)
				{
					if (error) {
						console.log(error);
						res.send({"status": "error"});
					} else {
						// success part
						self.readModuleData();
						res.send({"status": "success"});
					}
				});
			}
		});
	},
	
	checkForExecError: function(error, stdout, stderr, res) {
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
		var text = JSON.stringify(this.configData);

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

	format: function(string) {
		string = string.replace(/MMM-/ig, "");
		return string.charAt(0).toUpperCase() + string.slice(1);
	},

	fillTemplates: function(data) {
		data = this.translate(data);

		var brightness = 100;
		if (this.configData) {
			brightness = this.configData.brightness;
		}
		data = data.replace("%%REPLACE:BRIGHTNESS%%", brightness);

		return data;
	},

	loadTranslation: function(language) {
		var self = this;

		fs.readFile(path.resolve(__dirname + "/translations/" + language + ".json"), function(err, data) {
			if (err) {
				return;
			}
			else {
				self.translation = JSON.parse(data.toString());
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
			// check if we have got saved default settings
			self.loadDefaultSettings();
		}
		if (notification === "LANG")
		{
			self.loadTranslation(payload);

			// module started, answer with current ip addresses
			self.sendSocketNotification("IP_ADDRESSES", self.getIpAddresses());
		}
		
		if (notification === "REMOTE_ACTION")
		{
			this.executeQuery(payload);
		}
		
	},
});
