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

		this.addresses = [];

		this.sendSocketNotification("LANG", config.language);
	},

	notificationReceived: function(notification, payload, sender) {
		if (notification === "DOM_OBJECTS_CREATED") {
			this.sendModuleData();
		}
	},

	// Override socket notification handler.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "IP_ADDRESSES") {
			this.addresses = payload;
			if (this.config.position)
			{
				this.updateDom();
			}
		}
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

	// Override required translations.
	getTranslations: function() {
		return {
			en: "translations/en.json",
			de: "translations/de.json",
		};
	},

	getDom: function() {
		var wrapper = document.createElement("div");
		if (this.addresses.length === 0) {
			this.addresses = ["ip-of-your-mirror"];
		}
		wrapper.innerHTML = "http://" + this.addresses[0] + ":8080/remote.html";
		wrapper.className = "normal xsmall";
		return wrapper;
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
