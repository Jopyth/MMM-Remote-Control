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

		this.brightness = 100;
	},

	notificationReceived: function(notification, payload, sender) {
		if (notification === "DOM_OBJECTS_CREATED") {
			this.sendSocketNotification("LANG", config.language);
			this.sendSocketNotification("REQUEST_DEFAULT_SETTINGS");
			this.sendCurrentData();
		}
	},

	// Override socket notification handler.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "IP_ADDRESSES") {
			this.addresses = payload;
			if (this.data.position)
			{
				this.updateDom();
			}
		}
		if (notification === "DEFAULT_SETTINGS") {
			var moduleData = payload.moduleData;
			var modules = MM.getModules();
			for (var k = 0; k < moduleData.length; k++) {
				for (var i = 0; i < modules.length; i++) {
					if (modules[i].identifier === moduleData[k].identifier) {
						if (moduleData[k].hidden) {
							modules[i].hide();
						}
					}
				}
			}
			this.setBrightness(payload.brightness);
			this.sendCurrentData();
		}
		if (notification === "BRIGHTNESS") {
			this.setBrightness(parseInt(payload));
			this.sendCurrentData();
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
			this.sendCurrentData();
		}
	},

	setBrightness: function(newValue) {
		this.brightness = newValue;

		var style = document.getElementById('remote-control-styles');
		if (!style) {
			// create custom css if not existing
			style = document.createElement('style');
			style.type = 'text/css';
			style.id = 'remote-control-styles';
			document.getElementsByTagName('head')[0].appendChild(style);
		}

		var css = "";
		var defaults = {
			"header": parseInt("99", 16),
			".dimmed": parseInt("66", 16),
			".normal": parseInt("99", 16),
			".bright": parseInt("ff", 16)
		}
		for (var key in defaults) {
			var value = defaults[key] / 100 * newValue;
			value = Math.round(value);
			value = Math.min(value, 255);
			if (value < 16)
			{
				value = "0" + value.toString(16);
			} else {
				value = value.toString(16);
			}
			var extra = "";
			if (key === "header") {
				extra = "border-bottom: 1px solid #" + value + value + value + ";"
			}
			css += key + " { color: #" + value + value + value + "; " + extra + "} ";
		}
		style.innerHTML = css;
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

	sendCurrentData: function() {
		var modules = MM.getModules();
		var currentModuleData = [];
		for (var i = 0; i < modules.length; i++) {
			currentModuleData.push({});
			currentModuleData[i]["hidden"] = modules[i].hidden;
			currentModuleData[i]["name"] = modules[i].name;
			currentModuleData[i]["identifier"] = modules[i].identifier;
			currentModuleData[i]["position"] = modules[i].data.position;
		}
		var configData = {
			moduleData: currentModuleData,
			brightness: this.brightness
		};
		this.sendSocketNotification("CURRENT_STATUS", configData);		
	},
});
