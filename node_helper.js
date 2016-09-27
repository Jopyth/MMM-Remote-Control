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

module.exports = NodeHelper.create({
    // Subclass start method.
    start: function() {
        var self = this;
        console.log("Starting node helper for: " + self.name);

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
					exec('sudo shutdown -h now', function(error, stdout, stderr){ callback(stdout); });
					return;
				}
				if (query.action === 'REBOOT')
				{
					res.send({'status': 'success'});
					exec('sudo shutdown -r now', function(error, stdout, stderr){ callback(stdout); });
					return;
				}
				if (query.action === 'HIDE' || query.action === 'SHOW')
				{
	                self.sendSocketNotification(query.action, query.module);
					res.send({'status': 'success'});
	                return;
				}
			}
			res.send({'status': 'error', 'reason': 'unknown_command', 'original_input': query});
		});
    },

    translate: function(data) {
        console.log(this.translation);
        
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
                '<div class="menu-button edit-menu">' +
                    '<span class="fa fa-exclamation-circle" aria-hidden="true"></span>' +
                    '<span class="text">Keine Module geladen.</span>' +
                '</div>'
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
                    '<span class="symbol-on-show fa fa-check-square-o" aria-hidden="true"></span>\n' +
                    '<span class="symbol-on-hide fa fa-square-o" aria-hidden="true"></span>\n' +
                    '<span class="text">' + this.moduleData[i].name + '</span>\n' +
                '</div>\n'

            editMenu.push(moduleElement);
        }
        return data.replace("<!-- EDIT_MENU_TEMPLATE -->", editMenu.join("\n"));
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;

        if (notification === "MODULE_STATUS")
        {
            this.moduleData = payload;
        }
        if (notification === "LANG")
        {
            fs.readFile(path.resolve(__dirname + "/translations/" + payload + ".json"), function(err, data) {
                console.log(data);
                if (err) {
                    return;
                }
                else {
                    self.translation = JSON.parse(data.toString());
                }
            });
        }
    },
});
