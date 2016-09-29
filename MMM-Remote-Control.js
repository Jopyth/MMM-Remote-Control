/* global Module */

/* Magic Mirror
 * Module: Remote Control
 *
 * By Joseph Bethge
 * MIT Licensed.
 */

Module.register("MMM-Remote-Control", {

	// Default module config.
	defaults: {
		// no config options at the moment
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);

		this.sendSocketNotification("LANG", config.language);
	},

	notificationReceived: function(notification, payload, sender) {
		if (notification === "DOM_OBJECTS_CREATED") {
			this.sendModuleData();
		}
	},

	// Override socket notification handler.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "UPDATE") {
			this.sendModuleData();
		}
		if (notification === "HIDE" || notification === "SHOW") {
			var modules = MM.getModules();
			for (var i = 0; i < modules.length; i++) {
				if (modules[i].identifier === payload) {
					if (notification === "HIDE") {
						modules[i].hide(1000);
					} else {
						modules[i].show(1000);
					}
				}
			}
			this.sendModuleData();
		}
	},

	sendModuleData: function() {
		var modules = MM.getModules();
		var moduleData = [];
		for (var i = 0; i < modules.length; i++) {
			moduleData.push({});
			moduleData[i]["hidden"] = modules[i].hidden;
			moduleData[i]["name"] = modules[i].name;
			moduleData[i]["identifier"] = modules[i].identifier;
			moduleData[i]["position"] = modules[i].data.position;
		}
		this.sendSocketNotification("MODULE_STATUS", moduleData);		
	},
});
