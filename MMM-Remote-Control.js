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
    return ["remote-control.css"];
  },

  notificationReceived (notification, payload, sender) {
    // Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
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
      let settingsVersion = payload.settingsVersion;

      if (settingsVersion === undefined) {
        settingsVersion = 0;
      }
      if (settingsVersion < this.settingsVersion) {
        if (settingsVersion === 0) {
          // move old data into moduleData
          payload = {moduleData: payload, brightness: 100};
          payload = {moduleData: payload, temp: 370};
        }
      }

      const moduleData = payload.moduleData;
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

      modules.enumerate(function (module) {
        if (Object.prototype.hasOwnProperty.call(hideModules, module.identifier)) {
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
      setTimeout(function () {
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
            if (typeof x == "object") x = x.filter((t) => t != m.identifier);
            else x = "";
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

  buildCssContent (brightness) {
    let css = "";

    const defaults = {
      "body": parseInt("aa", 16),
      "header": parseInt("99", 16),
      ".dimmed": parseInt("66", 16),
      ".normal": parseInt("99", 16),
      ".bright": parseInt("ff", 16)
    };

    for (const key in defaults) {
      let value = defaults[key] / 100 * brightness;
      value = Math.round(value);
      value = Math.min(value, 255);
      if (value < 16) {
        value = `0${value.toString(16)}`;
      } else {
        value = value.toString(16);
      }
      let extra = "";
      if (key === "header") {
        extra = `border-bottom: 1px solid #${value}${value}${value};`;
      }
      css += `${key} { color: #${value}${value}${value}; ${extra}} `;
    }
    return css;
  },

  setBrightness (newBrightnessValue) {
    if (newBrightnessValue < 10) {
      newBrightnessValue = 0; // Setting Brightness to 0 turns off some displays backlight, it's neat for power saving
    }
    if (newBrightnessValue > 200) {
      newBrightnessValue = 200;
    }

    this.brightness = newBrightnessValue;

    let style = document.getElementById("remote-control-styles");
    if (!style) {
      // create custom css if not existing
      style = document.createElement("style");
      style.type = "text/css";
      style.id = "remote-control-styles";
      const parent = document.getElementsByTagName("head")[0];
      parent.appendChild(style);
    }

    if (newBrightnessValue < 100) {
      const filterValue = `brightness(${newBrightnessValue}%)`;
      document.body.style.filter = filterValue;
      return;
    }
    if (newBrightnessValue >= 100) {
      style.innerHTML = this.buildCssContent(newBrightnessValue);
      const filterValue = "brightness(100%)";
      document.body.style.filter = filterValue;
      return;
    }
  },

  buildCssContentTemp (temp) {
    let css = "";

    const defaults = {
      "body": parseInt("aa", 16),
      "header": parseInt("99", 16),
      ".dimmed": parseInt("66", 16),
      ".normal": parseInt("99", 16),
      ".bright": parseInt("ff", 16)
    };

    for (const key in defaults) {
      let value = defaults[key] / 100 * temp;
      value = Math.round(value);
      value = Math.min(value, 255);
      if (value < 16) {
        value = `0${value.toString(16)}`;
      } else {
        value = value.toString(16);
      }
      let extra = "";
      if (key === "header") {
        extra = `border-bottom: 1px solid #${value}${value}${value};`;
      }
      css += `${key} { color: #${value}${value}${value}; ${extra}} `;
    }
    return css;
  },

  setTemp (newTempValue) {
    if (newTempValue < 154) {
      newTempValue = 154;
    }

    this.temp = newTempValue;

    let style = document.getElementById("remote-control-styles");
    if (!style) {
      // create custom css if not existing
      style = document.createElement("style");
      style.type = "text/css";
      style.id = "remote-control-styles";
      const parent = document.getElementsByTagName("head")[0];
      parent.appendChild(style);
    }

    if (newTempValue) {
      style.innerHTML = "";
      this.createOverlayTemp(newTempValue);
      return;
    }
  },

  createOverlayTemp (temp) {
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
      overlay.style.backgroundColor = `rgba(0, 150, 255,${(325 - temp) / 865})`;
    }
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
    modules.enumerate(function (module) {
      const modData = Object.assign({}, module.data);
      modData.hidden = module.hidden;
      modData.lockStrings = module.lockStrings;
      modData.urlPath = module.name.replace(/MMM-/g, "").replace(/-/g, "").toLowerCase();
      modData.config = module.config;
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
