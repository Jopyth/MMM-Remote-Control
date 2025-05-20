/* global Module, Log, MM */

/*
 * MagicMirror²
 * Module: Remote Control
 *
 * By Joseph Bethge
 * MIT Licensed.
 */

Module.register("MMM-Remote-Control", {

  requiresVersion: "2.12.0",

  // Default module config.
  defaults: {
    customCommand: {}
  },

  // Define start sequence.
  start () {
    Log.info(`Starting module: ${this.name}`);

    this.settingsVersion = 2;

    this.addresses = [];
    this.port = "";

    this.brightness = 100;
    this.temp = 327;
  },

  getStyles () {
    return ["MMM-Remote-Control.css"];
  },

  notificationReceived (notification, payload, sender) {
    Log.debug(`${this.name} received a module notification: ${notification} from sender: ${sender}`);
    if (notification === "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("REQUEST_DEFAULT_SETTINGS");
      this.sendCurrentData();
    }
    if (notification === "REMOTE_ACTION") {
      this.sendSocketNotification(notification, payload);
    }
    if (notification === "REGISTER_API") {
      this.sendSocketNotification(notification, payload);
    }
    if (notification === "USER_PRESENCE") {
      this.sendSocketNotification(notification, payload);
    }
  },

  // Override socket notification handler.
  socketNotificationReceived (notification, payload) {
    if (notification === "UPDATE") {
      this.sendCurrentData();
    }
    if (notification === "IP_ADDRESSES") {
      this.addresses = payload;
      if (this.data.position) {
        this.updateDom();
      }
    }
    if (notification === "LOAD_PORT") {
      this.port = payload;
      if (this.data.position) {
        this.updateDom();
      }
    }

    if (notification === "USER_PRESENCE") {
      this.sendNotification(notification, payload);
    }
    if (notification === "DEFAULT_SETTINGS") {
      let {settingsVersion} = payload;

      if (settingsVersion === undefined) {
        settingsVersion = 0;
      }
      if (settingsVersion < this.settingsVersion) {
        if (settingsVersion === 0) {
          // move old data into moduleData
          payload = {moduleData: payload, brightness: 100};
          payload = {moduleData: payload, temp: 327};
        }
      }

      const {moduleData} = payload;
      const hideModules = {};
      for (let i = 0; i < moduleData.length; i++) {
        for (let k = 0; k < moduleData[i].lockStrings.length; k++) {
          if (moduleData[i].lockStrings[k].indexOf("MMM-Remote-Control") >= 0) {
            hideModules[moduleData[i].identifier] = true;
            break;
          }
        }
      }

      const modules = MM.getModules();

      const options = {lockString: this.identifier};

      modules.enumerate((module) => {
        if (Object.hasOwn(hideModules, module.identifier)) {
          module.hide(0, options);
        }
      });

      this.setBrightness(payload.brightness);
      this.setTemp(payload.temp);
    }
    if (notification === "BRIGHTNESS") {
      this.setBrightness(parseInt(payload));
    }
    if (notification === "TEMP") {
      this.setTemp(parseInt(payload));
    }
    if (notification === "REFRESH") {
      document.location.reload();
    }
    if (notification === "RESTART") {
      setTimeout(() => {
        document.location.reload();
        Log.log("Delayed REFRESH");
      }, 60000);
    }
    if (notification === "SHOW_ALERT") {
      this.sendNotification(notification, payload);
    }
    if (notification === "HIDE_ALERT") {
      this.sendNotification(notification);
    }
    if (notification === "HIDE" || notification === "SHOW" || notification === "TOGGLE") {
      const options = {lockString: this.identifier};
      if (payload.force) { options.force = true; }
      let modules = [];
      if (payload.module !== "all") {
        let x = payload.module;
        modules = modules.concat(MM.getModules().filter((m) => {
          if (m && x.includes(m.identifier)) {
            if (typeof x === "object") { x = x.filter((t) => t != m.identifier); } else { x = ""; }
            return true;
          }
        }), MM.getModules().filter((m) => {
          if (m) {
            return x.includes(m.name);
          }
        }));
      } else {
        modules = MM.getModules();
      }
      if (!modules.length) { return; }
      modules.forEach((mod) => {
        if (notification === "HIDE" ||
          notification === "TOGGLE" && !mod.hidden) {
          mod.hide(1000, options);
        } else if (notification === "SHOW" ||
          notification === "TOGGLE" && mod.hidden) {
          mod.show(1000, options);
        }
      });
    }
    if (notification === "NOTIFICATION") {
      this.sendNotification(payload.notification, payload.payload);
    }
  },

  setBrightness (newBrightnessValue) {
    if (newBrightnessValue < 10) {
      newBrightnessValue = 0; // Setting Brightness to 0 turns off some displays backlight, it's neat for power saving
    } else if (newBrightnessValue > 200) {
      newBrightnessValue = 200;
    }
    const filterValue = `brightness(${newBrightnessValue}%)`;
    Log.debug("BRIGHTNESS", newBrightnessValue);
    this.brightness = newBrightnessValue;
    const childNodesList = document.body.childNodes;
    for (let i = 0; i < childNodesList.length; i++) {
      if (childNodesList[i].nodeName !== "SCRIPT" && childNodesList[i].nodeName !== "#text") {
        childNodesList[i].style.filter = filterValue;
      }
    }
  },

  setTemp (temp) {
    let overlay = document.getElementById("remote-control-overlay-temp");
    if (!overlay) {
      // if not existing, create overlay
      overlay = document.createElement("div");
      overlay.id = "remote-control-overlay-temp";
      const parent = document.body;
      parent.insertBefore(overlay, parent.firstChild);
    }

    if (temp > 327) {
      overlay.style.backgroundColor = `rgba(255,215,0,${(temp - 325) / 865})`;
    } else {
      if (temp < 154) {
        temp = 154;
      }
      overlay.style.backgroundColor = `rgba(0, 150, 255,${(325 - temp) / 865})`;
    }
    Log.debug("TEMP", temp);
    this.temp = temp;
  },

  getDom () {
    const wrapper = document.createElement("div");
    let portToShow = "";
    if (this.addresses.length === 0) {
      this.addresses = ["ip-of-your-mirror"];
    }
    switch (this.port) {
      case "": case "8080": portToShow = ":8080"; break;
      case "80": portToShow = ""; break;
      default: portToShow = `:${this.port}`; break;
    }
    wrapper.innerHTML = `http://${this.addresses[0]}${portToShow}/remote.html`;
    wrapper.className = "normal xsmall";
    return wrapper;
  },

  sendCurrentData () {
    const modules = MM.getModules();
    const currentModuleData = [];
    modules.enumerate((module) => {
      const modData = {...module.data};
      modData.hidden = module.hidden;
      modData.lockStrings = module.lockStrings;
      modData.urlPath = module.name.replace(/MMM-/g, "").replace(/-/g, "").toLowerCase();
      modData.config = module.config;
      const modPrototype = Object.getPrototypeOf(module);
      modData.defaults = modPrototype.defaults;
      currentModuleData.push(modData);
    });
    const configData = {
      moduleData: currentModuleData,
      brightness: this.brightness,
      temp: this.temp,
      settingsVersion: this.settingsVersion,
      remoteConfig: this.config
    };
    this.sendSocketNotification("CURRENT_STATUS", configData);
  }
});
