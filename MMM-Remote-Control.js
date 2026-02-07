/* global Module, Log, MM */

/*
 * MagicMirror²
 * Module: Remote Control
 *
 * By Joseph Bethge
 * MIT Licensed.
 */

Module.register("MMM-Remote-Control", {

  // Default module config.
  defaults: {
    customCommand: {},
    showQRCode: true,
    qrCodeSize: 150,
    qrCodePosition: "above" // "below", "above", or "replace"
  },

  // Define start sequence.
  start () {
    Log.info(`Starting module: ${this.name}`);

    this.settingsVersion = 2;

    this.addresses = [];
    this.port = "";

    this.brightness = 100;
    this.temp = 327;

    this.qrCodeDataUrl = null;
  },

  createOverlays () {
    if (!document.getElementById("remote-control-overlay-brightness")) {
      const brightnessOverlay = document.createElement("div");
      brightnessOverlay.id = "remote-control-overlay-brightness";
      document.body.insertBefore(brightnessOverlay, document.body.firstChild);
    }

    if (!document.getElementById("remote-control-overlay-temp")) {
      const tempOverlay = document.createElement("div");
      tempOverlay.id = "remote-control-overlay-temp";
      document.body.insertBefore(tempOverlay, document.body.firstChild);
    }
  },

  getStyles () {
    return ["MMM-Remote-Control.css"];
  },

  notificationReceived (notification, payload, sender) {
    Log.debug(`${this.name} received a module notification: ${notification} from sender: ${sender}`);
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("REQUEST_DEFAULT_SETTINGS");
        this.sendCurrentData();
        break;

      case "REMOTE_ACTION":
      case "REGISTER_API":
      case "USER_PRESENCE":
        this.sendSocketNotification(notification, payload);
        break;

    }
  },

  // Override socket notification handler.
  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "UPDATE":
        this.sendCurrentData();
        break;

      case "IP_ADDRESSES":
        this.addresses = payload;
        if (this.data.position) {
          this.updateDom();
        }
        break;

      case "LOAD_PORT":
        this.port = payload;
        if (this.data.position) {
          this.updateDom();
        }
        break;

      case "QR_CODE_GENERATED":
        this.qrCodeDataUrl = payload;
        if (this.data.position) {
          this.updateDom();
        }
        break;

      case "QR_CODE_ERROR":
        Log.error(`QR Code generation error: ${payload}`);
        break;

      case "USER_PRESENCE":
        this.sendNotification(notification, payload);
        break;

      case "DEFAULT_SETTINGS":
        this.handleDefaultSettings(payload);
        break;

      case "BRIGHTNESS":
        this.setBrightness(Number.parseInt(payload));
        break;

      case "TEMP":
        this.setTemp(Number.parseInt(payload));
        break;

      case "REFRESH":
        document.location.reload();
        break;

      case "RESTART":
        setTimeout(() => {
          document.location.reload();
          Log.log("Delayed REFRESH");
        }, 60_000);
        break;

      case "SHOW_ALERT":
        this.sendNotification(notification, payload);
        break;

      case "HIDE_ALERT":
        this.sendNotification(notification);
        break;

      case "HIDE":
      case "SHOW":
      case "TOGGLE":
        this.handleModuleVisibility(notification, payload);
        break;

      case "NOTIFICATION":
        this.sendNotification(payload.notification, payload.payload);
        break;

    }
  },

  setBrightness (newBrightnessValue) {
    newBrightnessValue = Math.max(0, Math.min(100, newBrightnessValue));
    Log.debug("BRIGHTNESS", newBrightnessValue);

    this.createOverlays();
    const overlay = document.getElementById("remote-control-overlay-brightness");
    const opacity = (100 - newBrightnessValue) / 100;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    this.brightness = newBrightnessValue;
  },

  setTemp (temperature) {
    this.createOverlays();
    const overlay = document.getElementById("remote-control-overlay-temp");

    if (temperature > 327) {
      overlay.style.backgroundColor = `rgba(255,215,0,${(temperature - 325) / 865})`;
    } else {
      if (temperature < 154) {
        temperature = 154;
      }
      overlay.style.backgroundColor = `rgba(0, 150, 255,${(325 - temperature) / 865})`;
    }
    Log.debug("TEMP", temperature);
    this.temp = temperature;
  },

  /**
   * Handle DEFAULT_SETTINGS notification - manage module visibility
   * @param {object} payload - Settings data
   */
  handleDefaultSettings (payload) {
    let {settingsVersion} = payload;

    if (settingsVersion === undefined) {
      settingsVersion = 0;
    }
    if (settingsVersion < this.settingsVersion && settingsVersion === 0) {
      // move old data into moduleData
      payload = {moduleData: payload, brightness: 100};
      payload = {moduleData: payload, temp: 327};
    }

    const {moduleData} = payload;
    const hideModules = {};
    for (const moduleDatum of moduleData) {
      for (const lockString of moduleDatum.lockStrings || []) {
        if (lockString.includes("MMM-Remote-Control")) {
          hideModules[moduleDatum.identifier] = true;
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
  },

  /**
   * Handle HIDE/SHOW/TOGGLE notifications - manage module visibility
   * @param {string} notification - Type of visibility action
   * @param {object} payload - Notification data with module info
   */
  handleModuleVisibility (notification, payload) {
    const options = {lockString: this.identifier};
    if (payload.force) { options.force = true; }

    // Get all modules or filter by identifier/name
    const modules = payload.module === "all"
      ? MM.getModules()
      : this.getModulesByFilter(payload.module);

    if (modules.length === 0) { return; }

    // Apply visibility action to each module
    for (const module of modules) {
      const shouldHide = notification === "HIDE" || (notification === "TOGGLE" && !module.hidden);
      const shouldShow = notification === "SHOW" || (notification === "TOGGLE" && module.hidden);

      if (shouldHide) {
        module.hide(1000, () => {}, options);
      } else if (shouldShow) {
        module.show(1000, () => {}, options);
      }
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

    const url = `http://${this.addresses[0]}${portToShow}/remote.html`;

    // Show QR code if enabled
    if (this.config.showQRCode) {
      const container = document.createElement("div");
      container.className = "qrcode-container";

      // Add URL text above QR code (unless position is "replace")
      if (this.config.qrCodePosition !== "replace") {
        const urlText = document.createElement("div");
        urlText.innerHTML = url;
        urlText.className = "normal xsmall url-text";
        if (this.config.qrCodePosition === "below") {
          container.append(urlText);
        }
      }

      // Request QR code generation if not already done
      if (!this.qrCodeDataUrl) {
        this.sendSocketNotification("GENERATE_QR_CODE", {
          url,
          size: this.config.qrCodeSize
        });
      }

      // Display QR code if available
      if (this.qrCodeDataUrl) {
        const qrImage = document.createElement("img");
        qrImage.src = this.qrCodeDataUrl;
        qrImage.className = "qrcode-image";
        qrImage.alt = "QR Code for Remote Control";
        container.append(qrImage);
      }

      // Add URL text below QR code
      if (this.config.qrCodePosition === "above") {
        const urlText = document.createElement("div");
        urlText.innerHTML = url;
        urlText.className = "normal xsmall url-text";
        container.append(urlText);
      }

      wrapper.append(container);
    } else {
      // Just show URL text
      wrapper.innerHTML = url;
      wrapper.className = "normal xsmall";
    }

    return wrapper;
  },

  sendCurrentData () {
    const modules = MM.getModules();
    const currentModuleData = [];
    modules.enumerate((module) => {
      const moduleData = {...module.data, hidden: module.hidden, lockStrings: module.lockStrings || [], urlPath: module.name.replaceAll("MMM-", "").replaceAll("-", "").toLowerCase(), config: module.config};
      const modulePrototype = Object.getPrototypeOf(module);
      moduleData.defaults = modulePrototype.defaults;
      currentModuleData.push(moduleData);
    });
    const configData = {
      moduleData: currentModuleData,
      brightness: this.brightness,
      temp: this.temp,
      settingsVersion: this.settingsVersion,
      remoteConfig: this.config
    };
    this.sendSocketNotification("CURRENT_STATUS", configData);
  },

  /**
   * Filter modules by identifier or name
   * @param {string|Array<string>} filter - Module identifier(s) or name(s) to match
   * @returns {Array} Matching modules
   */
  getModulesByFilter (filter) {
    const allModules = MM.getModules();
    const filters = Array.isArray(filter) ? filter : [filter];

    return allModules.filter((module) => {
      if (!module) return false;
      return filters.some((f) => module.identifier === f || module.name === f);
    });
  }
});
