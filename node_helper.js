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
		            // transform(data);
		            res.send(data)
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
			}
			res.send({'status': 'error', 'reason': 'unknown_command', 'original_input': query});
		});
    },

	socketNotificationReceived: function(notification, payload) {
		if (notification === "MODULE_STATUS")
		{
			// get modules position + id ?
		}
	},
});
