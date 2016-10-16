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
const exec = require('child_process').exec;
const os = require('os');

module.exports = NodeHelper.create({
	// Subclass start method.
	start: function() {
		var self = this;
		console.log("Starting node helper for: " + self.name);

		// load fall back translation
		self.loadTranslation("en");

		this.expressApp.get("/remote.html", function(req, res) {
			fs.readFile(path.resolve(__dirname + "/remote.html"), function(err, data) {
				if (err) {
					res.send(404);
				}
				else {
					res.contentType('text/html');
					var transformedData = self.fillTemplate(data.toString());
					res.send(transformedData);
				}
			});
		});

		this.expressApp.get('/remote', (req, res) => {
			var query = url.parse(req.url, true).query;


			if (query.action)
			{
				var result = self.executeQuery(query, res);
				if (result === true) {
					return;
				}
			}
			res.send({'status': 'error', 'reason': 'unknown_command', 'info': 'original input: ' + query});
		});
	},
	
	executeQuery: function(query, res) {
		var self = this;
		var opts = {timeout: 5000};

		if (query.action === 'SHUTDOWN')
		{
			exec('sudo shutdown -h now', opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === 'REBOOT')
		{
			exec('sudo shutdown -r now', opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === 'RESTART')
		{
			exec('pm2 restart mm', opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === 'MONITORON')
		{
			exec('/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7', opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === 'MONITOROFF')
		{
			exec('/opt/vc/bin/tvservice -o', opts, function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr, res); });
			return true;
		}
		if (query.action === 'HIDE' || query.action === 'SHOW')
		{
			if (res) { res.send({'status': 'success'}); }
			self.sendSocketNotification(query.action, query.module);
			return true;
		}
		if (query.action === 'SAVE')
		{
			if (res) { res.send({'status': 'success'}); }
			self.saveDefaultSettings();
			return true;
		}		
	},
	
	checkForExecError: function(error, stdout, stderr, res) {
		if (error) {
			console.log(error);
			if (res) { res.send({'status': 'error', 'reason': 'unknown', 'info': error}); }
			return;
		}
		if (res) { res.send({'status': 'success'}); }
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
		var text = JSON.stringify(this.moduleData);

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

	fillTemplate: function(data) {
		data = this.translate(data);

		if (!this.moduleData) {
			var error =
				'<div class="menu-button edit-menu">\n' +
					'<span class="fa fa-fw fa-exclamation-circle" aria-hidden="true"></span>\n' +
					'<span class="text">%%TRANSLATE:NO_MODULES_LOADED%%</span>\n' +
				'</div>\n';
			error = this.translate(error);
			return data.replace("<!-- EDIT_MENU_TEMPLATE -->", error);
		}

		var editMenu = [];

		for (var i = 0; i < this.moduleData.length; i++) {
			if (!this.moduleData[i]["position"]) {
				continue;
			}

			var hiddenStatus = 'shown-on-mirror';
			if (this.moduleData[i].hidden) {
				hiddenStatus = 'hidden-on-mirror';
			}

			var moduleElement =
				'<div id="' + this.moduleData[i].identifier + '" class="menu-button edit-button edit-menu ' + hiddenStatus + '">\n' +
					'<span class="symbol-on-show fa fa-fw fa-toggle-on" aria-hidden="true"></span>\n' +
					'<span class="symbol-on-hide fa fa-fw fa-toggle-off" aria-hidden="true"></span>\n' +
					'<span class="text">' + this.format(this.moduleData[i].name) + '</span>\n' +
				'</div>\n';

			editMenu.push(moduleElement);
		}
		return data.replace("<!-- EDIT_MENU_TEMPLATE -->", editMenu.join("\n"));
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
				if (address.family === 'IPv4' && !address.internal) {
					addresses.push(address.address);
				}
			}
		}
		return addresses;
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === "MODULE_STATUS")
		{
			this.moduleData = payload;
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
