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
		// updateInterval: 10 * 1000, // every 10 seconds
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);
	},

	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");
		wrapper.innerHTML = "Remote Control: 192.168.178.30:8080/remote.html";
		wrapper.className = "dimmed small";
		return wrapper;
	}
});
