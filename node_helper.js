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
					res.send(transformedData)
				}
			});
		});

		this.expressApp.get('/remote', (req, res) => {
			var query = url.parse(req.url, true).query;

			if (query.action)
			{
				if (query.action === 'SHUTDOWN')
				{
					res.send({'status': 'success'});
					exec('sudo shutdown -h now', function(error, stdout, stderr){ console.log(stdout); });
					return;
				}
				if (query.action === 'REBOOT')
				{
					res.send({'status': 'success'});
					exec('sudo shutdown -r now', function(error, stdout, stderr){ console.log(stdout); });
					return;
				}
				if (query.action === 'RESTART')
				{
					res.send({'status': 'success'});
					exec('pm2 restart mm', function(error, stdout, stderr){ console.log(stdout); });
					return;
				}
				if (query.action === 'MONITORON')
				{
					res.send({'status': 'success'});
					exec('/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7', function(error, stdout, stderr){ console.log(stdout); });
					return;
				}
				if (query.action === 'MONITOROFF')
				{
					res.send({'status': 'success'});
					exec('/opt/vc/bin/tvservice -o', function(error, stdout, stderr){ console.log(stdout); });
					return;
				}
				if (query.action === 'HIDE' || query.action === 'SHOW')
				{
					res.send({'status': 'success'});
					self.sendSocketNotification(query.action, query.module);
					return;
				}
			}
			res.send({'status': 'error', 'reason': 'unknown_command', 'original_input': query});
		});
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
					'<span class="text">' + this.moduleData[i].name + '</span>\n' +
				'</div>\n'

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

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === "MODULE_STATUS")
		{
			this.moduleData = payload;
		}
		if (notification === "LANG")
		{
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
			self.sendSocketNotification("IP_ADDRESSES", addresses);

			// load default english translation
			self.loadTranslation("en");

			// try to load translation in user language
			self.loadTranslation(payload);
		}
	},
});
