/* global MMSocket marked */

// main javascript file for the remote control page

const Remote = {
  name: "MMM-Remote-Control",
  currentMenu: "main-menu",
  types: ["string", "number", "boolean", "array", "object", "null", "undefined"],
  values: ["", 0.0, true, [], {}, null, undefined],
  validPositions: [
    "",
    "top_bar",
    "top_left",
    "top_center",
    "top_right",
    "upper_third",
    "middle_center",
    "lower_third",
    "bottom_left",
    "bottom_center",
    "bottom_right",
    "bottom_bar",
    "fullscreen_above",
    "fullscreen_below"
  ],
  savedData: {},
  translations: {},
  currentConfig: {},
  addModule: "",
  changedModules: [],
  deletedModules: [],
  autoHideTimer: undefined, // Internal: Reference to the active auto-hide timeout (do not modify manually)
  autoHideDelay: 2000, // ms - Time after which success messages are auto hidden
  autoHideDelayError: 30 * 1000, // ms - Time for error messages (0 = no auto-hide, must be clicked away)
  autoHideDelayInfo: 30 * 1000, // ms - Time for info messages like PM2 restart/stop

  /*
   * socket()
   * Returns a socket object. If it doesn't exist, it's created.
   * It also registers the notification handler.
   */
  socket () {
    if (typeof this._socket === "undefined") {
      this._socket = new MMSocket(this.name);
    }

    this._socket.setNotificationCallback((notification, payload) => {
      this.socketNotificationReceived(notification, payload);
    });

    return this._socket;
  },

  /*
   * sendSocketNotification(notification, payload)
   * Send a socket notification to the node helper.
   *
   * argument notification string - The identifier of the notification.
   * argument payload mixed - The payload of the notification.
   */
  sendSocketNotification (notification, payload) {
    this.socket().sendNotification(notification, payload);
  },

  /*
   * socketNotificationReceived(notification, payload)
   * This method is called when a socket notification arrives.
   *
   * argument notification string - The identifier of the notification.
   * argument payload mixed - The payload of the notification.
   */
  socketNotificationReceived (notification, payload) {
    if (notification === "REMOTE_ACTION_RESULT") {
      // console.log("Result received:", JSON.stringify(payload, undefined, 4));
      if ("action" in payload && payload.action === "INSTALL") {
        this.handleInstall(payload);
        return;
      }
      if ("action" in payload && payload.action === "GET_CHANGELOG") {
        this.handleShowChangelog(payload);
        return;
      }
      if ("data" in payload) {
        if (payload.query.data === "config_update") {
          this.handleSaveConfig(payload);
        } else if (payload.query.data === "saves") {
          this.handleRestoreConfigMenu(payload);
        } else if (payload.query.data === "mmUpdateAvailable") {
          this.handleMmUpdate(payload.result);
        } else if (payload.query.data === "brightness") {
          const slider = document.getElementById("brightness-slider");
          slider.value = payload.result;
        } else if (payload.query.data === "translations") {
          this.translations = payload.data;
          this.onTranslationsLoaded();
        } else {
          this.handleLoadList(payload);
        }
        return;
      }
      if ("code" in payload && payload.code === "restart") {
        this.offerRestart(payload.chlog
          ? `${payload.info}<br><div id='changelog'>${marked.parse(payload.chlog)}</div>`
          : payload.info);
        return;
      }
      if ("success" in payload) {
        if (!("status" in payload)) {
          payload.status = payload.success
            ? "success"
            : "error";
        }
        const message = payload.status === "error"
          ? `${this.translate("RESPONSE_ERROR")
          }: <br><pre><code>${JSON.stringify(payload, undefined, 3)}</code></pre>`
          : payload.info;
        this.setStatus(payload.status, message);
        return;
      }
    }
    if (notification === "REFRESH") {
      setTimeout(() => { document.location.reload(); }, 2000);
      return;
    }
    if (notification === "RESTART") {
      setTimeout(() => {
        document.location.reload();
      }, 62000);
      return;
    }
    if (notification === "REMOTE_CLIENT_CUSTOM_MENU") {
      this.customMenu = payload;
      this.createDynamicMenu(this.customMenu);
      return;
    }
    if (notification === "REMOTE_CLIENT_MODULEAPI_MENU") {
      this.moduleApiMenu = payload;
      this.createDynamicMenu(this.moduleApiMenu);

    }
  },

  loadButtons (buttons) {
    Object.keys(buttons).forEach((key) => {
      document.getElementById(key).addEventListener("click", buttons[key], false);
    });
  },

  translate (pattern) {
    return this.translations[pattern];
  },

  hasClass (element, name) {
    return ` ${element.className} `.indexOf(` ${name} `) > -1;
  },

  hide (element) {
    element?.classList.add("hidden");
  },

  show (element) {
    element?.classList.remove("hidden");
  },

  loadToggleButton (element, onToggle) {
    element.addEventListener("click", (event) => {
      if (this.hasClass(event.currentTarget, "toggled-off")) {
        if (onToggle) {
          onToggle(true, event);
        }
      } else if (onToggle) {
        onToggle(false, event);
      }
    }, false);
  },

  filter (pattern) {
    let filterInstalled = false;
    if ("installed".indexOf(pattern) !== -1) {
      filterInstalled = true;
      pattern = pattern.replace("installed");
    }
    pattern = pattern.trim();

    const regex = new RegExp(pattern, "i");
    const searchIn = ["author", "desc", "longname", "name"];

    const data = this.savedData.moduleAvailable;
    data.forEach((currentData, i) => {
      const id = `install-module-${i}`;
      const element = document.getElementById(id);
      if (!pattern) {
        // cleared search input, show all
        element.classList.remove("hidden");
        return;
      }

      let match = filterInstalled && currentData.installed;

      for (const key of searchIn) {
        if (match || currentData[key]?.match(regex)) {
          match = true;
          break;
        }
      }
      element.classList.toggle("hidden", !match);
    });
  },

  updateSliderThumbColor (slider, type) {
    const value = parseInt(slider.value, 10);
    const min = parseInt(slider.min, 10);
    const max = parseInt(slider.max, 10);
    const percent = (value - min) / (max - min);

    let thumbColor, trackGradient;
    if (type === "brightness") {
      // Brightness: dark gray to bright white (neutral, no color)
      const brightness = Math.round(50 + percent * 205);
      thumbColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
      // Track gradient: dark gray (left) to bright white (right)
      trackGradient = "linear-gradient(to right, rgb(50, 50, 50), rgb(255, 255, 255))";
    } else if (type === "temp") {

      /*
       * Color temperature: warm (orange) to cool (blue)
       * Low values (140) = warm, High values (500) = cool
       * Invert: start with cool (low slider %), end with warm (high slider %)
       */
      const warmR = 255,
        warmG = 147,
        warmB = 41; // warm orange
      const coolR = 100,
        coolG = 181,
        coolB = 246; // cool blue
      const r = Math.round(coolR + (warmR - coolR) * percent);
      const g = Math.round(coolG + (warmG - coolG) * percent);
      const b = Math.round(coolB + (warmB - coolB) * percent);
      thumbColor = `rgb(${r}, ${g}, ${b})`;
      // Track gradient: cool blue (left) to warm orange (right)
      trackGradient = `linear-gradient(to right, rgb(${coolR}, ${coolG}, ${coolB}), rgb(${warmR}, ${warmG}, ${warmB}))`;
    }

    if (thumbColor) {
      slider.style.setProperty("--thumb-color", thumbColor);
    }
    if (trackGradient) {
      slider.style.setProperty("--track-gradient", trackGradient);
    }
  },

  closePopup () {
    const popupContainer = document.getElementById("popup-container");
    const popupContents = document.getElementById("popup-contents");
    popupContainer?.classList.add("hidden");
    if (popupContents) popupContents.innerHTML = "";
  },

  showPopup () {
    const popupContainer = document.getElementById("popup-container");
    popupContainer?.classList.remove("hidden");
  },

  getPopupContent (clear = true) {
    if (clear) {
      this.closePopup();
    }
    return document.getElementById("popup-contents");
  },

  loadOtherElements () {
    const slider = document.getElementById("brightness-slider");
    slider.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "BRIGHTNESS", value: slider.value});
    }, false);
    slider.addEventListener("input", () => {
      this.updateSliderThumbColor(slider, "brightness");
    }, false);
    this.updateSliderThumbColor(slider, "brightness");

    const slider2 = document.getElementById("temp-slider");
    slider2.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "TEMP", value: slider2.value});
    }, false);
    slider2.addEventListener("input", () => {
      this.updateSliderThumbColor(slider2, "temp");
    }, false);
    this.updateSliderThumbColor(slider2, "temp");

    const input = document.getElementById("add-module-search");
    const deleteButton = document.getElementById("delete-search-input");

    input.addEventListener("input", () => {
      this.filter(input.value);
      deleteButton.classList.toggle("hidden", input.value === "");
    }, false);

    deleteButton.addEventListener("click", () => {
      input.value = "";
      this.filter(input.value);
      deleteButton.classList.add("hidden");
    }, false);
  },

  async showMenu (newMenu) {
    const self = this;
    if (this.currentMenu === "settings-menu") {
      // check for unsaved changes
      const changes = this.deletedModules.length + this.changedModules.length;
      if (changes > 0) {
        const wrapper = document.createElement("div");
        const text = document.createElement("span");
        text.textContent = this.translate("UNSAVED_CHANGES");
        wrapper.appendChild(text);

        const ok = self.createSymbolText("fa fa-check-circle", this.translate("OK"), () => {
          self.setStatus("none");
        });
        wrapper.appendChild(ok);

        const discard = self.createSymbolText("fa fa-warning", this.translate("DISCARD"), () => {
          self.deletedModules = [];
          self.changedModules = [];
          window.location.hash = newMenu;
        });
        wrapper.appendChild(discard);

        this.setStatus(false, false, wrapper);

        this.skipHashChange = true;
        window.location.hash = this.currentMenu;

        return;
      }
    }


    if (newMenu === "add-module-menu") {
      this.loadModulesToAdd();
    }
    if (newMenu === "edit-menu") {
      this.loadVisibleModules();
      this.loadBrightness();
      this.loadTemp();
    }
    if (newMenu === "settings-menu") {
      this.loadConfigModules();
    }
    if (newMenu === "classes-menu") {
      this.loadClasses();
    }
    if (newMenu === "update-menu") {
      this.loadModulesToUpdate();
    }
    if (newMenu === "links-menu") {
      this.loadLinks();
    }

    if (newMenu === "main-menu") {
      try {
        const {data: configData} = await this.loadList("config-modules", "config");
        const alertElem = document.getElementById("alert-button");
        if (!configData.modules.find((m) => m.module === "alert") && alertElem) { alertElem.remove(); }

        const modConfig = configData.modules.find((m) => m.module === "MMM-Remote-Control").config;
        const classesButton = document.getElementById("classes-button");
        if ((!modConfig || !modConfig.classes) && classesButton) { classesButton.remove(); }
      } catch (error) {
        console.error("Error loading config for main menu:", error);
      }
    }

    const allMenus = Array.from(document.getElementsByClassName("menu-element"));

    allMenus.forEach((menu) => {
      this.hide(menu);
    });

    const currentMenu = Array.from(document.getElementsByClassName(newMenu));

    currentMenu.forEach((menu) => {
      this.show(menu);
    });

    this.setStatus("none");

    this.currentMenu = newMenu;
    // Update header title based on the active menu
    this.updateHeaderTitle(newMenu);
  },

  getMenuTitleKey (menuName) {
    // Map menu identifiers to translation keys
    const menuTitleMap = {
      "main-menu": "TITLE",
      "power-menu": "SHUTDOWN_MENU_NAME",
      "edit-menu": "EDIT_MENU_NAME",
      "settings-menu": "CONFIGURE_MENU_NAME",
      "add-module-menu": "ADD_MODULE",
      "update-menu": "UPDATE_MENU_NAME",
      "alert-menu": "ALERT_MENU_NAME",
      "links-menu": "LINKS"
    };
    return menuTitleMap[menuName];
  },

  updateHeaderTitle (menuName) {
    try {
      const headerTitleEl = document.querySelector(".header .header-title");
      if (!headerTitleEl) { return; }

      const hasTranslations = this.translations && Object.keys(this.translations).length > 0;
      if (!hasTranslations) { return; }

      const key = menuName || this.currentMenu || "main-menu";
      const titleKey = this.getMenuTitleKey(key);
      let titleText = titleKey ? this.translate(titleKey) : null;

      // Special case for classes-menu: use button text if available
      if (!titleText && key === "classes-menu") {
        const classesBtn = document.getElementById("classes-button");
        titleText = classesBtn?.querySelector(".text")?.textContent || this.translate("TITLE");
      }

      if (titleText) {
        headerTitleEl.textContent = titleText;
      }
    } catch (e) {
      console.warn("Failed to update header title:", e);
    }
  },

  loadLinks () {
    const parent = document.getElementById("links-container-nav");
    if (!parent) { return; }
    while (parent.firstChild) parent.removeChild(parent.firstChild);

    const open = (url) => () => window.open(url, "_blank");
    const items = [
      {icon: "fa-book", text: this.translate("API_DOCS"), url: `${window.location.origin}/api/docs/`},
      {icon: "fa-globe", text: this.translate("WEBSITE"), url: "https://magicmirror.builders/"},
      {icon: "fa-comments", text: this.translate("FORUM"), url: "https://forum.magicmirror.builders/"},
      {icon: "fa-github", text: this.translate("REPOSITORY"), url: "https://github.com/Jopyth/MMM-Remote-Control"}
    ];

    items.forEach(({icon, text, url}) => {
      parent.appendChild(this.createSymbolText(`fa fa-fw ${icon}`, text, open(url)));
    });
  },

  setStatus (status, message, customContent) {
    const self = this;

    if (this.autoHideTimer !== undefined) {
      clearTimeout(this.autoHideTimer);
    }

    // Simple status update
    if (status === "success" && !message && !customContent) {
      const successPopup = document.getElementById("success-popup");
      successPopup.classList.remove("hidden");
      this.autoHideTimer = setTimeout(() => { successPopup.classList.add("hidden"); }, this.autoHideDelay);
      return;
    }

    const parent = document.getElementById("result-contents");
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }

    if (status === "none") {
      this.hide(document.getElementById("result-overlay"));
      this.hide(document.getElementById("result"));
      return;
    }

    if (customContent) {
      parent.appendChild(customContent);
      this.show(document.getElementById("result-overlay"));
      this.show(document.getElementById("result"));
      return;
    }

    let symbol;
    let text;
    let onClick;
    if (status === "loading") {
      symbol = "fa-spinner fa-pulse";
      text = this.translate("LOADING");
      onClick = false;
    }
    if (status === "error") {
      symbol = "fa-exclamation-circle";
      text = this.translate("ERROR");
      onClick = () => {
        self.setStatus("none");
      };
      // Only auto-hide errors if autoHideDelayError > 0, otherwise user must click to dismiss
      if (this.autoHideDelayError > 0) {
        this.autoHideTimer = setTimeout(() => {
          self.setStatus("none");
        }, this.autoHideDelayError);
      }
    }
    if (status === "info") {
      symbol = "fa-info-circle";
      text = this.translate("INFO");
      onClick = () => {
        self.setStatus("none");
      };
      // Info messages (like PM2 restart/stop) should be displayed longer
      if (this.autoHideDelayInfo > 0) {
        this.autoHideTimer = setTimeout(() => {
          self.setStatus("none");
        }, this.autoHideDelayInfo);
      }
    }
    if (status === "success") {
      symbol = "fa-check-circle";
      text = this.translate("DONE");
      onClick = () => {
        self.setStatus("none");
      };
      this.autoHideTimer = setTimeout(() => {
        self.setStatus("none");
      }, this.autoHideDelay);
    }
    if (message) {
      text = typeof message === "object" ? JSON.stringify(message, undefined, 3) : message;
    }
    parent.appendChild(this.createSymbolText(`fa fa-fw ${symbol}`, text, onClick));

    this.show(document.getElementById("result-overlay"));
    this.show(document.getElementById("result"));
  },

  async getWithStatus (params) {
    this.setStatus("loading");
    const response = await this.get("remote", params);

    try {
      const result = JSON.parse(response);
      if (result.success) {
        this.setStatus("success", result.info || null);
      } else {
        this.setStatus("error");
      }
    } catch (error) {
      console.error("Error parsing response:", error);
      this.setStatus("error");
    }
  },

  showModule (id, force) {
    if (force) {
      this.sendSocketNotification("REMOTE_ACTION", {action: "SHOW", force: true, module: id});
    } else {
      this.sendSocketNotification("REMOTE_ACTION", {action: "SHOW", module: id});
    }
  },

  hideModule (id) {
    this.sendSocketNotification("REMOTE_ACTION", {action: "HIDE", module: id});
  },

  install (url, index) {
    const downloadButton = document.getElementById("download-button");
    const icon = downloadButton.querySelector("span:first-child");
    const text = downloadButton.querySelector("span:last-child");

    if (icon) {
      icon.classList.remove("fa-download");
      icon.classList.add("fa-spinner", "fa-pulse");
    }

    if (text) {
      text.innerHTML = ` ${this.translate("DOWNLOADING")}`;
    }

    this.sendSocketNotification("REMOTE_ACTION", {action: "INSTALL", url, index});
  },

  handleInstall (result) {
    if (result.success) {
      const bgElement = document.getElementById(`install-module-${result.index}`);
      bgElement.firstChild.className = "fa fa-fw fa-check-circle";
      this.savedData.moduleAvailable[result.index].installed = true;
      this.createAddingPopup(result.index);
    }
  },

  async get (route, params, timeout) {
    const url = `${route}?${params}`;
    const controller = new AbortController();
    const {signal} = controller;

    if (timeout) {
      setTimeout(() => controller.abort(), timeout);
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-type": "application/x-www-form-urlencoded"
        },
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (error.name === "AbortError") {
        console.error("Request was aborted.");
        const errorMessage = document.createElement("div");
        errorMessage.className = "error-message";
        errorMessage.textContent = "The request was aborted. Please try again.";
        document.body.appendChild(errorMessage);
      } else {
        console.error("Fetch error:", error);
      }
      throw error;
    }
  },

  loadList (listname, dataId) {
    const loadingIndicator = document.getElementById(`${listname}-loading`);
    const parent = document.getElementById(`${listname}-results`);

    parent.replaceChildren();
    this.show(loadingIndicator);

    return new Promise((resolve, reject) => {
      this.pendingResolver = (parent, data) => {
        resolve({parent, data});
      };
      this.pendingRejecter = (error) => {
        reject(error);
      };
      this.sendSocketNotification("REMOTE_ACTION", {data: dataId, listname});
    });
  },

  handleLoadList (result) {
    const loadingIndicator = document.getElementById(`${result.query.listname}-loading`);
    const emptyIndicator = document.getElementById(`${result.query.listname}-empty`);
    const parent = document.getElementById(`${result.query.listname}-results`);

    this.hide(loadingIndicator);
    this.savedData[result.query.data] = false;

    try {
      if (result.data.length === 0) {
        this.show(emptyIndicator);
      } else {
        this.hide(emptyIndicator);
      }
      this.savedData[result.query.data] = result.data;

      // Cache moduleInstalled data for repository buttons
      if (result.query.data === "moduleInstalled" && this.installedModulesCacheResolver) {
        this.installedModulesCacheResolver(result);
        delete this.installedModulesCacheResolver;
      }

      if (this.pendingResolver) {
        this.pendingResolver(parent, result.data);
        delete this.pendingResolver;
      }
    } catch (error) {
      console.debug("Error loading list:", error);
      this.show(emptyIndicator);
    }
  },

  formatName (string) {
    string = string.replace(/MMM?-/ig, "").replaceAll("_", " ").replaceAll("-", " ");
    string = string.replace(/([a-z])([A-Z])/g, (txt) => `${txt[0]} ${txt[1]}`);
    string = string.replace(/\w\S*/g, (txt) => txt.at(0).toUpperCase() + txt.slice(1));
    return string.at(0).toUpperCase() + string.slice(1);
  },

  formatLabel (string) {

    /*
     * let result = string.replace(/([A-Z])/g, " $1" );
     * return result.charAt(0).toUpperCase() + result.slice(1);
     */
    return string;
  },

  formatPosition (string) {
    return string.replaceAll("_", " ").replace(/\w\S*/g, (txt) => txt.at(0).toUpperCase() + txt.slice(1).toLowerCase());
  },

  getVisibilityStatus (data) {
    let status = "toggled-on";
    const modules = [];
    if (data.hidden) {
      status = "toggled-off";
      data.lockStrings.forEach((lockString) => {
        if (lockString.indexOf("MMM-Remote-Control") >= 0) {
          return;
        }
        modules.push(lockString);
        if (modules.length === 1) {
          status += " external-locked";
        }
      });
    }
    return {status, modules: modules.join(", ")};
  },

  addToggleElements (parent) {
    const outerSpan = document.createElement("span");
    outerSpan.className = "stack fa-fw";

    const spanClasses = [
      "fa fa-fw fa-toggle-on outer-label fa-stack-1x",
      "fa fa-fw fa-toggle-off outer-label fa-stack-1x",
      "fa fa-fw fa-lock inner-small-label fa-stack-1x"
    ];

    spanClasses.forEach((className) => {
      const innerSpan = document.createElement("span");
      innerSpan.className = className;
      outerSpan.appendChild(innerSpan);
    });

    parent.appendChild(outerSpan);
  },

  loadBrightness () {
    this.sendSocketNotification("REMOTE_ACTION", {data: "brightness"});
  },

  loadTemp () {
    this.sendSocketNotification("REMOTE_ACTION", {data: "temp"});
  },

  makeToggleButton (moduleBox, visibilityStatus) {
    moduleBox.addEventListener("click", (event) => {
      if (this.hasClass(event.currentTarget, "toggled-off")) {
        if (this.hasClass(event.currentTarget, "external-locked")) {
          const wrapper = document.createElement("div");
          const warning = document.createElement("span");
          warning.innerHTML = this.translate("LOCKSTRING_WARNING").replace("LIST_OF_MODULES", visibilityStatus.modules);
          wrapper.appendChild(warning);

          const ok = this.createSymbolText("fa fa-check-circle", this.translate("OK"), () => {
            this.setStatus("none");
          });
          wrapper.appendChild(ok);

          const force = this.createSymbolText("fa fa-warning", this.translate("FORCE_SHOW"), () => {
            event.currentTarget.className = event.currentTarget.className.replace(" external-locked", "").replace("toggled-off", "toggled-on");
            this.showModule(event.currentTarget.id, true);
            this.setStatus("none");
          });
          wrapper.appendChild(force);

          this.setStatus("error", false, wrapper);
        } else {
          event.currentTarget.className = event.currentTarget.className.replace("toggled-off", "toggled-on");
          this.showModule(event.currentTarget.id);
        }
      } else {
        event.currentTarget.className = event.currentTarget.className.replace("toggled-on", "toggled-off");
        this.hideModule(event.currentTarget.id);
      }
    });
  },

  async loadVisibleModules () {
    try {
      const {data: moduleData} = await this.loadList("visible-modules", "modules");
      const parent = document.getElementById("visible-modules-results");
      moduleData.forEach((module) => {
        if (!module.position) {
          // skip invisible modules
          return;
        }
        const visibilityStatus = this.getVisibilityStatus(module);

        const moduleBox = document.createElement("div");
        moduleBox.className = `button module-line ${visibilityStatus.status}`;
        moduleBox.id = module.identifier;

        this.addToggleElements(moduleBox);

        const text = document.createElement("span");
        text.className = "text";
        text.innerHTML = ` ${this.formatName(module.name)}`;
        if ("header" in module) {
          text.innerHTML += ` (${module.header})`;
        }
        moduleBox.appendChild(text);

        parent.appendChild(moduleBox);

        this.makeToggleButton(moduleBox, visibilityStatus);
      });
    } catch (error) {
      console.error("Error loading visible modules:", error);
    }
  },

  createSymbolText (symbol, text, eventListener, element) {
    if (element === undefined) {
      element = "div";
    }
    const wrapper = document.createElement(element);
    if (eventListener) {
      wrapper.className = "button";
    }
    const symbolElement = document.createElement("span");
    symbolElement.className = symbol;
    wrapper.appendChild(symbolElement);
    const textElement = document.createElement("span");
    textElement.innerHTML = text;
    textElement.className = "symbol-text-padding";
    wrapper.appendChild(textElement);
    if (eventListener) {
      wrapper.addEventListener("click", eventListener, false);
    }
    return wrapper;
  },

  recreateConfigElement (key, previousType, newType) {
    const input = document.getElementById(key);
    let oldGUI = input.parentNode;
    if (previousType === "array" || previousType === "object") {
      oldGUI = input;
    }
    const path = key.split("/");
    const name = path[path.length - 1];

    let current = this.currentConfig;
    for (let i = 1; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    const initialValue = this.values[this.types.indexOf(newType)];
    const newGUI = this.createObjectGUI(key, name, initialValue);
    oldGUI.parentNode.replaceChild(newGUI, oldGUI);
  },

  createTypeEditSelection (key, parent, type, oldElement) {
    const self = this;

    const previousType = oldElement.children[1].innerHTML.slice(1).toLowerCase();
    const select = document.createElement("select");
    for (const typeOption of this.types) {
      const option = document.createElement("option");
      option.innerHTML = this.formatName(typeOption);
      option.value = typeOption;
      if (typeOption === type) {
        option.selected = "selected";
      }
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      const newType = select.options[select.selectedIndex].innerHTML.toLowerCase();
      if (previousType !== newType) {
        self.recreateConfigElement(key, previousType, newType);
      } else {
        parent.replaceChild(oldElement, select);
      }
    }, false);
    select.addEventListener("blur", () => {
      parent.replaceChild(oldElement, select);
    }, false);
    return select;
  },

  createConfigLabel (key, name, type, forcedType, symbol = "fa-tag") {
    const self = this;

    if (name.at(0) === "#") {
      symbol = "fa-hashtag";
      name = name.slice(1);
    }
    const label = document.createElement("label");
    label.htmlFor = key;
    label.className = "config-label";
    const desc = Remote.createSymbolText(`fa fa-fw ${symbol}`, this.formatLabel(name), false, "span");
    desc.className = "label-name";
    label.appendChild(desc);

    if (!forcedType) {
      const typeLabel = Remote.createSymbolText("fa fa-fw fa-pencil", this.formatName(type), (event) => {
        const thisElement = event.currentTarget;
        label.replaceChild(self.createTypeEditSelection(key, label, type, thisElement), thisElement);
      }, "span");
      typeLabel.classList.add("module-remove");
      label.appendChild(typeLabel);

      const remove = Remote.createSymbolText("fa fa-fw fa-times-circle", this.translate("REMOVE"), (event) => {
        const thisElement = event.currentTarget;
        const elementToRemove = type === "array" || type === "object"
          ? thisElement.parentNode.parentNode
          : thisElement.parentNode;
        elementToRemove.remove();
      }, "span");
      remove.classList.add("module-remove");
      label.appendChild(remove);
    }
    return label;
  },

  createConfigInput (key, value, omitValue, element = "input") {
    const input = document.createElement(element);
    input.className = "config-input";
    if (!omitValue) {
      input.value = value;
    }
    input.id = key;
    input.addEventListener("focus", (event) => {
      const label = event.currentTarget.parentNode;
      label.className = `${label.className} highlight`;
    }, false);
    input.addEventListener("blur", (event) => {
      const label = event.currentTarget.parentNode;
      label.className = label.className.replace(" highlight", "");
    }, false);

    return input;
  },

  createVisualCheckbox (key, wrapper, input, className) {
    const visualCheckbox = document.createElement("span");
    visualCheckbox.className = `visual-checkbox fa fa-fw ${className}`;
    wrapper.appendChild(visualCheckbox);
  },

  createConfigElement (type) {
    const self = this;

    return {
      string (key, name, value, type, forcedType) {
        const label = self.createConfigLabel(key, name, type, forcedType);
        const input = self.createConfigInput(key, value);
        input.type = "text";
        label.appendChild(input);
        if (key === "<root>/header") {
          input.placeholder = self.translate("NO_HEADER");
        }
        return label;
      },
      number (key, name, value, type, forcedType) {
        const label = self.createConfigLabel(key, name, type, forcedType);
        const input = self.createConfigInput(key, value);
        input.type = "number";
        if (value % 1 !== 0) {
          input.step = 0.01;
        }
        label.appendChild(input);
        return label;
      },
      boolean (key, name, value, type, forcedType) {
        const label = self.createConfigLabel(key, name, type, forcedType);

        const input = self.createConfigInput(key, value, true);
        input.type = "checkbox";
        label.appendChild(input);
        if (value) {
          input.checked = true;
        }

        self.createVisualCheckbox(key, label, input, "fa-check-square-o", false);
        self.createVisualCheckbox(key, label, input, "fa-square-o", true);
        return label;
      },
      undefined (key, name, value, type, forcedType) {
        const label = self.createConfigLabel(key, name, type, forcedType);
        const input = self.createConfigInput(key, value);
        input.type = "text";
        input.disabled = "disabled";
        input.classList.add("disabled", "undefined");
        input.placeholder = "undefined";
        label.appendChild(input);
        return label;
      },
      null (key, name, value, type, forcedType) {
        const label = self.createConfigLabel(key, name, type, forcedType);
        const input = self.createConfigInput(key, value);
        input.type = "text";
        input.disabled = "disabled";
        input.classList.add("disabled", "null");
        input.placeholder = "null";
        label.appendChild(input);
        return label;
      },
      position (key, name, value, type, forcedType) {
        const label = self.createConfigLabel(key, name, type, forcedType);
        const select = self.createConfigInput(key, value, false, "select");
        select.className = "config-input";
        select.id = key;
        self.validPositions.forEach((position) => {
          const option = document.createElement("option");
          option.value = position;
          if (position) {
            option.innerHTML = self.formatPosition(position);
          } else {
            option.innerHTML = self.translate("NO_POSITION");
          }
          if (position === value) {
            option.selected = "selected";
          }
          select.appendChild(option);
        });
        label.appendChild(select);
        return label;
      }
    }[type];
  },

  getTypeAsString (dataToEdit, path) {
    let type = typeof dataToEdit;
    if (path === "<root>/position") {
      type = "position";
    }
    if (this.createConfigElement(type)) {
      return type;
    }
    if (Array.isArray(dataToEdit)) {
      return "array";
    }
    if (dataToEdit === null) {
      return "null";
    }
    if (dataToEdit === undefined) {
      return "undefined";
    }
    return "object";
  },

  hasForcedType (path) {
    let forcedType = false;
    if ((path.match(/\//g) || []).length === 1) {
      // disable type editing in root layer
      forcedType = true;
    }
    return forcedType;
  },

  createObjectGUI (path, name, dataToEdit) {
    const self = this;

    const type = this.getTypeAsString(dataToEdit, path);
    const forcedType = this.hasForcedType(path);
    if (this.createConfigElement(type)) {
      // recursion stop
      return this.createConfigElement(type)(path, name, dataToEdit, type, forcedType);
    }

    // object and array
    const wrapper = document.createElement("div");
    wrapper.id = path;
    wrapper.className = `indent config-input ${type}`;
    if (type === "array") {
      // array
      const add = this.createSymbolText("fa fa-fw fa-plus", this.translate("ADD_ENTRY"));
      add.classList.add("bottom-spacing", "button");
      wrapper.appendChild(this.createConfigLabel(path, name, type, forcedType, "fa-list-ol"));
      wrapper.appendChild(add);
      dataToEdit.forEach((item, i) => {
        const newName = `#${i}`;
        wrapper.appendChild(this.createObjectGUI(`${path}/${newName}`, newName, item));
      });
      add.addEventListener("click", () => {
        const lastIndex = dataToEdit.length - 1;
        const lastType = self.getTypeAsString(`${path}/#${lastIndex}`, dataToEdit[lastIndex]);
        dataToEdit.push(self.values[self.types.indexOf(lastType)]);
        const nextName = `#${lastIndex + 1}`;
        wrapper.appendChild(self.createObjectGUI(`${path}/${nextName}`, nextName, dataToEdit[dataToEdit.length - 1]));
      }, false);
      return wrapper;
    }

    // object
    if (path !== "<root>") {
      wrapper.appendChild(this.createConfigLabel(path, name, type, forcedType, "fa-list-ul"));

      const addElement = self.createConfigLabel(`${path}/<add>`, this.translate("ADD_ENTRY"), type, true, "fa-plus");
      addElement.classList.add("bottom-spacing");
      const inputWrapper = document.createElement("div");
      inputWrapper.className = "add-input-wrapper";
      const input = self.createConfigInput(`${path}/<add>`, "");
      input.type = "text";
      input.placeholder = this.translate("NEW_ENTRY_NAME");
      addElement.appendChild(inputWrapper);
      inputWrapper.appendChild(input);
      const addFunction = () => {
        const existingKey = Object.keys(dataToEdit)[0];
        const lastType = self.getTypeAsString(`${path}/${existingKey}`, dataToEdit[existingKey]);
        const key = input.value;
        if (key === "" || document.getElementById(`${path}/${key}`)) {
          if (!self.hasClass(input, "input-error")) {
            input.classList.add("input-error");
          }
          return;
        }
        input.className = input.className.replace(" input-error", "");
        dataToEdit[key] = self.values[self.types.indexOf(lastType)];
        const newElement = self.createObjectGUI(`${path}/${key}`, key, dataToEdit[key]);
        wrapper.insertBefore(newElement, addElement.nextSibling);
        input.value = "";
      };
      const symbol = document.createElement("span");
      symbol.className = "fa fa-fw fa-plus-square button";
      symbol.addEventListener("click", addFunction, false);
      inputWrapper.appendChild(symbol);
      input.onkeypress = (e) => {
        if (!e) { e = window.event; }
        const keyCode = e.keyCode || e.which;
        if (keyCode == "13") {
          addFunction();
        }
      };
      wrapper.appendChild(addElement);
    }
    let keys = Object.keys(dataToEdit);
    if (path === "<root>") {
      keys = [
        "module",
        "disabled",
        "position",
        "header",
        "config"
      ];
    }
    keys.forEach((key) => {
      if (Object.hasOwn(dataToEdit, key)) {
        wrapper.appendChild(this.createObjectGUI(`${path}/${key}`, key, dataToEdit[key]));
      }
    });
    if (path === "<root>") {
      // additional css classes on root element
      wrapper.className = "flex-fill small";
    }
    return wrapper;
  },

  appendConfigMenu (index, wrapper) {
    const self = this;

    const menuDiv = document.createElement("div");
    menuDiv.className = "fixed-size sub-menu";

    const help = self.createSymbolText("fa fa-fw fa-question-circle", self.translate("HELP"), () => {
      window.open(`config-help.html?module=${self.currentConfig.module}`, "_blank");
    });
    menuDiv.appendChild(help);
    const undo = self.createSymbolText("fa fa-fw fa-undo", self.translate("RESET"), () => {
      self.createConfigPopup(index);
    });
    menuDiv.appendChild(undo);
    const save = self.createSymbolText("fa fa-fw fa-save", self.translate("SAVE"), () => {
      self.savedData.config.modules[index] = self.getModuleConfigFromUI();
      self.changedModules.push(index);
      const parent = document.getElementById(`edit-module-${index}`).parentNode;
      if (parent.children.length === 2) {
        parent.insertBefore(self.createChangedWarning(), parent.children[1]);
      }
      self.closePopup();
    });
    menuDiv.appendChild(save);

    wrapper.appendChild(menuDiv);

  },

  setValue (parent, name, value) {
    if (name.indexOf("#") !== -1) {
      parent.push(value);
    } else {
      parent[name] = value;
    }
  },

  navigate (parent, name) {
    if (name.indexOf("#") !== -1) {
      return parent[parent.length - 1];
    }
    return parent[name];

  },

  getModuleConfigFromUI () {
    const rootElement = {};
    const elements = Array.from(document.getElementsByClassName("config-input"));
    for (const element of elements) {
      const path = element.id;
      const splitPath = path.split("/");
      let parent = rootElement;
      for (let k = 1; k < splitPath.length - 1; k++) {
        parent = this.navigate(parent, splitPath[k]);
      }
      const name = splitPath[splitPath.length - 1];
      if (this.hasClass(element, "null")) {
        this.setValue(parent, name, null);
        continue;
      }
      if (this.hasClass(element, "undefined")) {
        this.setValue(parent, name, undefined);
        continue;
      }
      if (this.hasClass(element, "array")) {
        this.setValue(parent, name, []);
        continue;
      }
      if (this.hasClass(element, "object")) {
        this.setValue(parent, name, {});
        continue;
      }

      let {value} = element;
      if (name === "<add>" || path === "<root>/position" && value === "") {
        continue;
      }
      if (element.type === "checkbox") {
        value = element.checked;
      }
      if (element.type === "number") {
        value = parseFloat(value);
      }
      this.setValue(parent, name, value);
    }
    return rootElement;
  },

  createConfigPopup (index) {
    const self = this;
    if (typeof index === "string") {
      index = parseInt(index);
    }

    const moduleData = this.savedData.config.modules;
    const data = moduleData[index];

    self.currentConfig = data;
    if (!("header" in self.currentConfig)) {
      self.currentConfig.header = "";
    }
    if (!("position" in self.currentConfig)) {
      self.currentConfig.position = "";
    }

    const wrapper = this.getPopupContent();

    const name = document.createElement("div");
    name.innerHTML = self.formatName(data.module);
    name.className = "bright title medium";
    wrapper.appendChild(name);

    const n = document.createElement("div");
    n.innerHTML = `${data.module} (#${index + 1})`;
    n.className = "subtitle xsmall dimmed";
    wrapper.appendChild(n);

    self.appendConfigMenu(index, wrapper);

    wrapper.append(self.createObjectGUI("<root>", "", self.currentConfig));

    // disable input for module name
    document.getElementById("<root>/module").disabled = true;
    document.getElementById("<root>/module").classList.add("disabled");

    this.showPopup();
  },

  createChangedWarning () {
    const self = this;
    const changed = Remote.createSymbolText("fa fa-fw fa-warning", this.translate("UNSAVED_CHANGES"), () => {
      const saveButton = document.getElementById("save-config");
      if (!self.hasClass(saveButton, "highlight")) {
        saveButton.classList.add("highlight");
      }
    }, "span");
    changed.classList.add("module-remove");
    return changed;
  },

  appendModuleEditElements (wrapper, moduleData) {
    const self = this;
    moduleData.forEach((data, i) => {
      const innerWrapper = document.createElement("div");
      innerWrapper.className = "module-line";

      // Module name (left side)
      const moduleName = document.createElement("div");
      moduleName.className = "module-name";
      moduleName.textContent = self.formatName(data.module);
      innerWrapper.appendChild(moduleName);

      // Buttons container (right side)
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "module-buttons";

      // Add repository button if URL is available (first button)
      self.getModuleUrl(data.module).then((url) => {
        if (url) {
          const repoButton = self.createSymbolText("fa fa-fw fa-github", this.translate("REPOSITORY"), () => {
            window.open(url, "_blank");
          }, "span");
          repoButton.className = "button";
          buttonsContainer.insertBefore(repoButton, buttonsContainer.firstChild);
        }
      });

      const moduleBox = self.createSymbolText("fa fa-fw fa-pencil", this.translate("EDIT"), (event) => {
        const i = event.currentTarget.id.replace("edit-module-", "");
        self.createConfigPopup(i);
      }, "span");
      moduleBox.id = `edit-module-${i}`;
      buttonsContainer.appendChild(moduleBox);

      if (self.changedModules.indexOf(i) !== -1) {
        buttonsContainer.appendChild(self.createChangedWarning());
      }

      const remove = Remote.createSymbolText("fa fa-fw fa-times-circle", this.translate("REMOVE"), (event) => {
        const i = event.currentTarget.parentNode.parentNode.firstChild.nextSibling.firstChild.id.replace("edit-module-", "");
        self.deletedModules.push(parseInt(i));
        const thisElement = event.currentTarget.parentNode.parentNode;
        thisElement.parentNode.removeChild(thisElement);
      }, "span");
      remove.classList.add("module-remove");
      buttonsContainer.appendChild(remove);

      innerWrapper.appendChild(buttonsContainer);
      wrapper.appendChild(innerWrapper);
    });
  },

  async loadConfigModules () {
    this.changedModules = [];

    try {
      const {data: configData} = await this.loadList("config-modules", "config");
      const parent = document.getElementById("config-modules-results");
      const moduleData = configData.modules;
      if (this.addModule) {
        const name = this.addModule;
        // we came here from adding a module
        try {
          const response = await this.get("get", `data=defaultConfig&module=${name}`);
          const newData = JSON.parse(response);
          moduleData.push({module: name, config: newData.data});
          const index = moduleData.length - 1;
          this.changedModules.push(index);
          this.appendModuleEditElements(parent, moduleData);
          this.createConfigPopup(index);
        } catch (error) {
          console.error("Error loading default config:", error);
        }
        this.addModule = "";
      } else {
        this.appendModuleEditElements(parent, moduleData);
      }
    } catch (error) {
      console.error("Error loading config modules:", error);
    }
  },

  loadInstalledModulesCache () {
    if (this.installedModulesCachePromise) {
      return this.installedModulesCachePromise;
    }

    this.installedModulesCachePromise = new Promise((resolve) => {
      const handleResponse = (result) => {
        if (result.success && result.data) {
          this.installedModulesCache = result.data;
        } else {
          this.installedModulesCache = [];
        }
        resolve();
      };

      // Temporarily store the resolver
      this.installedModulesCacheResolver = handleResponse;
      this.sendSocketNotification("REMOTE_ACTION", {data: "moduleInstalled"});
    });

    return this.installedModulesCachePromise;
  },

  async getModuleUrl (moduleName) {
    try {
      if (!this.installedModulesCache) {
        await this.loadInstalledModulesCache();
      }
      const module = this.installedModulesCache.find((m) => m.longname === moduleName);
      return module?.url || "";
    } catch (error) {
      console.error("Error loading module URL:", error);
      return "";
    }
  },

  async loadClasses () {
    try {
      const {data: classes} = await this.loadList("classes", "classes");
      for (const i in classes) {
        const node = document.createElement("div");
        node.id = "classes-before-result";
        node.hidden = true;
        document.getElementById("classes-results").appendChild(node);

        const content = {
          id: i,
          text: i,
          icon: "dot-circle-o",
          type: "item",
          action: "MANAGE_CLASSES",
          content: {
            payload: {
              classes: i
            }
          }
        };

        const existingButton = document.getElementById(`${content.id}-button`);
        if (existingButton) {
          existingButton.remove();
        }

        this.createMenuElement(content, "classes", node);
      }
    } catch (error) {
      console.error("Error loading classes:", error);
    }
  },

  createAddingPopup (index) {
    const self = this;
    if (typeof index === "string") {
      index = parseInt(index);
    }

    const data = this.savedData.moduleAvailable[index];
    const wrapper = this.getPopupContent();

    const name = document.createElement("div");
    name.innerHTML = data.name;
    name.className = "bright title";
    wrapper.appendChild(name);

    const author = document.createElement("div");
    author.innerHTML = `${self.translate("BY")} ${data.author}`;
    author.className = "subtitle small";
    wrapper.appendChild(author);

    const desc = document.createElement("div");
    desc.innerHTML = data.desc;
    desc.className = "small flex-fill";
    wrapper.appendChild(desc);

    const footer = document.createElement("div");
    footer.className = "fixed-size sub-menu";

    if (data.installed) {
      const add = self.createSymbolText("fa fa-fw fa-plus", self.translate("ADD_THIS"), () => {
        self.closePopup();
        self.addModule = data.longname;
        window.location.hash = "settings-menu";
      });
      footer.appendChild(add);
    }

    if (data.installed) {
      const statusElement = self.createSymbolText("fa fa-fw fa-check-circle", self.translate("INSTALLED"));
      footer.appendChild(statusElement);
    } else {
      const statusElement = self.createSymbolText("fa fa-fw fa-download", self.translate("DOWNLOAD"), () => {
        self.install(data.url, index);
      });
      statusElement.id = "download-button";
      footer.appendChild(statusElement);
    }

    const githubElement = self.createSymbolText("fa fa-fw fa-github", self.translate("CODE_LINK"), () => {
      window.open(data.url, "_blank");
    });
    footer.appendChild(githubElement);

    wrapper.appendChild(footer);

    this.showPopup();
  },

  async loadModulesToAdd () {
    try {
      const {data: modules} = await this.loadList("add-module", "moduleAvailable");
      const parent = document.getElementById("add-module-results");
      modules.forEach((module, i) => {
        const moduleWrapper = document.createElement("div");
        moduleWrapper.className = "module-line";

        // Left side: Module name and description
        const moduleInfo = document.createElement("div");
        moduleInfo.className = "module-info";

        const moduleName = document.createElement("div");
        moduleName.className = "module-name";
        moduleName.textContent = module.name;
        moduleInfo.appendChild(moduleName);

        if (module.desc) {
          const moduleDesc = document.createElement("div");
          moduleDesc.className = "module-description";
          moduleDesc.innerHTML = module.desc;
          moduleInfo.appendChild(moduleDesc);
        }

        moduleWrapper.appendChild(moduleInfo);

        // Right side: Buttons
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "module-buttons";

        // Repository button
        if (module.url) {
          const repoButton = this.createSymbolText("fa fa-fw fa-github", "Repository", () => {
            window.open(module.url, "_blank");
          }, "span");
          repoButton.className = "button";
          buttonsContainer.appendChild(repoButton);
        }

        // Install/Installed button
        let symbol = "fa fa-fw fa-cloud";
        let buttonText = "Install";
        let buttonClass = "button";
        if (module.installed) {
          symbol = "fa fa-fw fa-check-circle";
          buttonText = "Installed";
          buttonClass = "button disabled";
        }

        const installButton = this.createSymbolText(symbol, buttonText, (event) => {
          if (!module.installed) {
            const index = event.currentTarget.id.replace("install-module-", "");
            this.createAddingPopup(index);
          }
        }, "span");
        installButton.className = buttonClass;
        installButton.id = `install-module-${i}`;
        buttonsContainer.appendChild(installButton);

        moduleWrapper.appendChild(buttonsContainer);
        parent.appendChild(moduleWrapper);
      });
    } catch (error) {
      console.error("Error loading modules to add:", error);
    }
  },

  offerRestart (message) {
    const wrapper = document.createElement("div");

    const info = document.createElement("span");
    info.innerHTML = message;
    wrapper.appendChild(info);

    const restart = this.createSymbolText("fa fa-fw fa-recycle", this.translate("RESTARTMM"), buttons["restart-mm-button"]);
    restart.children[1].classList.add("text");
    wrapper.appendChild(restart);
    this.setStatus("success", false, wrapper);
  },

  offerReload (message) {
    const wrapper = document.createElement("div");

    const info = document.createElement("span");
    info.innerHTML = message;
    wrapper.appendChild(info);

    const restart = this.createSymbolText("fa fa-fw fa-recycle", this.translate("RESTARTMM"), buttons["restart-mm-button"]);
    restart.children[1].classList.add("text");
    wrapper.appendChild(restart);

    const reload = this.createSymbolText("fa fa-fw fa-globe", this.translate("REFRESHMM"), buttons["refresh-mm-button"]);
    reload.children[1].classList.add("text");
    wrapper.appendChild(reload);

    this.setStatus("success", false, wrapper);
  },

  offerOptions (message, data) {
    const wrapper = document.createElement("div");
    const info = document.createElement("span");
    info.innerHTML = message;
    wrapper.appendChild(info);

    for (const b in data) {
      const restart = this.createSymbolText("fa fa-fw fa-recycle", b, data[b]);
      restart.children[1].classList.add("text");
      wrapper.appendChild(restart);
    }

    this.setStatus("success", false, wrapper);
  },

  updateModule (module) {
    this.sendSocketNotification("REMOTE_ACTION", {action: "UPDATE", module});
  },

  handleMmUpdate (result) {
    if (window.location.hash.substring(1) == "update-menu") {
      const updateButton = document.getElementById("update-mm-button");
      if (result) {
        updateButton?.classList.remove("hidden");
        updateButton?.classList.add("bright");
      } else {
        updateButton?.classList.add("hidden");
        updateButton?.classList.remove("bright");
      }
    }
  },

  async loadModulesToUpdate () {
    // also update mm info notification
    this.sendSocketNotification("REMOTE_ACTION", {data: "mmUpdateAvailable"});

    try {
      const {data: modules} = await this.loadList("update-module", "moduleInstalled");
      const parent = document.getElementById("update-module-results");

      // Create MagicMirror² update line first
      const mmWrapper = document.createElement("div");
      mmWrapper.id = "mm-update-container";
      mmWrapper.className = "module-line mm-update-line";

      const mmName = document.createElement("div");
      mmName.className = "module-name";
      mmName.textContent = "MagicMirror²";
      mmWrapper.appendChild(mmName);

      const mmButtons = document.createElement("div");
      mmButtons.className = "module-buttons";

      // MM Update button (initially hidden, shown by handleMmUpdate)
      const mmUpdateButton = this.createSymbolText("fa fa-fw fa-toggle-up", "Update", () => {
        this.updateModule(undefined);
      });
      mmUpdateButton.id = "update-mm-button";
      mmUpdateButton.className = "button hidden";
      mmButtons.appendChild(mmUpdateButton);

      // MM Changelog button (always visible) - opens GitHub releases
      const mmChangelogButton = this.createSymbolText("fa fa-fw fa-file-text-o", "Changelog", () => {
        window.open("https://github.com/MagicMirrorOrg/MagicMirror/releases", "_blank");
      });
      mmChangelogButton.className = "button";
      mmButtons.appendChild(mmChangelogButton);

      mmWrapper.appendChild(mmButtons);
      parent.appendChild(mmWrapper);

      // Now load module updates
      modules.forEach((module) => {
        const innerWrapper = document.createElement("div");
        innerWrapper.className = "module-line";

        // Module name (non-clickable)
        const moduleName = document.createElement("div");
        moduleName.className = "module-name";
        moduleName.textContent = module.name;
        innerWrapper.appendChild(moduleName);

        // Buttons container
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "module-buttons";

        // Update button - only if update available
        if (module.updateAvailable) {
          const updateButton = this.createSymbolText("fa fa-fw fa-toggle-up", "Update", (event) => {
            const module = event.currentTarget.id.replace("update-module-", "");
            this.updateModule(module);
          });
          updateButton.className = "button bright";
          updateButton.id = `update-module-${module.longname}`;
          buttonsContainer.appendChild(updateButton);
        }

        // Add changelog button if module has changelog
        if (module.hasChangelog) {
          const changelogButton = this.createSymbolText("fa fa-fw fa-file-text-o", "Changelog", (event) => {
            event.stopPropagation();
            this.showChangelog(module.longname);
          });
          changelogButton.className = "button";
          buttonsContainer.appendChild(changelogButton);
        }

        innerWrapper.appendChild(buttonsContainer);
        parent.appendChild(innerWrapper);
      });
    } catch (error) {
      console.error("Error loading modules to update:", error);
    }
  },

  showChangelog (moduleName) {
    this.setStatus("loading");
    this.sendSocketNotification("REMOTE_ACTION", {action: "GET_CHANGELOG", module: moduleName});
  },

  handleShowChangelog (result) {
    if (result.success && result.changelog) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `<h3>${result.module || "Changelog"}</h3><div id='changelog'>${marked.parse(result.changelog)}</div>`;
      this.setStatus("success", false, wrapper);
    } else {
      this.setStatus("error", "Changelog not found");
    }
  },

  restoreConfigMenu () {
    if (this.saving) {
      return;
    }
    const restoreButton = document.getElementById("restore-config");
    restoreButton.className = restoreButton.className.replace(" highlight", "");
    this.setStatus("loading");
    this.sendSocketNotification("REMOTE_ACTION", {data: "saves"});
  },

  handleRestoreConfigMenu (result) {
    if (result.success) {
      const dates = {};
      for (const i in result.data) {
        dates[new Date(result.data[i])] = () => {
          this.restoreConfig(result.data[i]);
        };
      }
      this.offerOptions(this.translate("RESTORE"), dates);
    } else {
      this.setStatus("error");
    }
  },

  restoreConfig (date) {
    // prevent saving before current saving is finished
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.setStatus("loading");

    this.sendSocketNotification("UNDO_CONFIG", date);
  },

  saveConfig () {
    // prevent saving before current saving is finished
    if (this.saving) {
      return;
    }
    const saveButton = document.getElementById("save-config");
    saveButton.className = saveButton.className.replace(" highlight", "");
    this.saving = true;
    this.setStatus("loading");
    const configData = this.savedData.config;
    configData.modules = configData.modules.filter((_, i) => this.deletedModules.indexOf(i) === -1);
    this.deletedModules = [];
    this.sendSocketNotification("NEW_CONFIG", configData);
  },

  handleSaveConfig (result) {
    const self = this;

    if (result.success) {
      self.offerReload(self.translate("DONE"));
    } else {
      self.setStatus("error");
    }
    self.saving = false;
    self.loadConfigModules();
  },

  onTranslationsLoaded () {
    this.createDynamicMenu();
    // Ensure header reflects the current menu once translations are available
    this.updateHeaderTitle(this.currentMenu);
    // If currently on links page, rebuild with translated labels
    if (this.currentMenu === "links-menu") {
      this.loadLinks();
    }
  },

  createMenuElement (content, menu, insertAfter) {
    if (!content) { return; }
    const item = document.createElement("div");
    item.id = `${content.id}-button`;
    item.className = `menu-element button ${menu}-menu`;

    if (content.icon) {
      const mcmIcon = document.createElement("span");
      mcmIcon.className = `fa fa-fw fa-${content.icon}`;
      mcmIcon.setAttribute("aria-hidden", "true");
      item.appendChild(mcmIcon);
    }

    if (content.text) {
      const mcmText = document.createElement("span");
      mcmText.className = "text";
      mcmText.textContent = content.text;
      item.appendChild(mcmText);
    }

    if (content.type === "menu") {
      const mcmArrow = document.createElement("span");
      mcmArrow.className = "fa fa-fw fa-angle-right";
      mcmArrow.setAttribute("aria-hidden", "true");
      item.appendChild(mcmArrow);
      item.setAttribute("data-parent", menu);
      item.setAttribute("data-type", "menu");
      document.getElementById("back-button").classList.add(`${content.id}-menu`);
      const menuContent = document.querySelector(".menu-content");
      if (menuContent) {
        menuContent.classList.add(`${content.id}-menu`);
      }
      item.addEventListener("click", () => {
        window.location.hash = `${content.id}-menu`;
      });
    } else if (content.type === "slider") {
      const contain = document.createElement("div");
      contain.classList.add("flex-1");

      const slide = document.createElement("input");
      slide.id = `${content.id}-slider`;
      slide.className = "slider";
      slide.type = "range";
      slide.min = content.min || 0;
      slide.max = content.max || 100;
      slide.step = content.step || 10;
      slide.value = content.defaultValue || 50;

      slide.addEventListener("change", () => {
        this.sendSocketNotification("REMOTE_ACTION", {
          action: content.action.toUpperCase(),
          ...content.content,
          payload: {
            ...content.content === undefined ? {} : typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload,
            value: slide.value
          },
          value: slide.value
        });
      });

      contain.appendChild(slide);
      item.appendChild(contain);
    } else if (content.type === "input") {
      const input = document.createElement("input");
      input.id = `${content.id}-input`;
      input.className = `menu-element ${menu}-menu medium`;
      input.type = "text";
      input.placeholder = content.text;

      input.addEventListener("focusout", () => {
        this.sendSocketNotification("REMOTE_ACTION", {
          action: content.action.toUpperCase(),
          ...content.content,
          payload: {
            ...content.content === undefined ? {} : typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload,
            value: input.value
          },
          value: input.value
        });
      });

      return input;
    } else if (content.action && content.content) {
      item.setAttribute("data-type", "item");
      item.addEventListener("click", () => {
        this.sendSocketNotification("REMOTE_ACTION", {
          action: content.action.toUpperCase(),
          payload: {},
          ...content.content
        });
      });
    }

    if (!window.location.hash && menu !== "main" ||
      window.location.hash && window.location.hash.substring(1) !== `${menu}-menu`) {
      item.classList.add("hidden");
    }

    insertAfter.parentNode.insertBefore(item, insertAfter.nextSibling);

    if ("items" in content) {
      content.items.forEach((i) => {
        this.createMenuElement(i, content.id, item);
      });
    }

    return item;
  },

  createDynamicMenu (content) {
    if (content) {
      const buttonElement = document.getElementById(`${content.id}-button`);
      if (buttonElement) {
        buttonElement.remove();
      }

      const menuElements = document.querySelectorAll(`.${content.id}-menu`);
      menuElements.forEach((menuElement) => menuElement.remove());

      if (window.location.hash === `#${content.id}-menu`) {
        window.location.hash = "main-menu";
      }
    }
    this.createMenuElement(content, "main", document.getElementById("alert-button"));
  }
};

const buttons = {
  // navigation buttons
  "power-button" () {
    window.location.hash = "power-menu";
  },
  "edit-button" () {
    window.location.hash = "edit-menu";
  },
  "settings-button" () {
    window.location.hash = "settings-menu";
  },
  "mirror-link-button" () {
    window.open("/", "_blank");
  },
  "classes-button" () {
    window.location.hash = "classes-menu";
  },
  "back-button" () {
    if (window.location.hash === "#add-module-menu") {
      window.location.hash = "settings-menu";
      return;
    }
    const currentButton = document.querySelector(window.location.hash.replace("-menu", "-button"));
    if (currentButton && currentButton.dataset.parent) {
      window.location.hash = `${currentButton.dataset.parent}-menu`;
      return;
    }
    window.location.hash = "main-menu";
  },
  "update-button" () {
    window.location.hash = "update-menu";
  },
  "alert-button" () {
    window.location.hash = "alert-menu";
  },
  "links-button" () {
    window.location.hash = "links-menu";
  },

  // settings menu buttons
  "brightness-reset" () {
    const element = document.getElementById("brightness-slider");
    element.value = 100;
    Remote.updateSliderThumbColor(element, "brightness");
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "BRIGHTNESS", value: element.value});
  },

  "temp-reset" () {
    const element = document.getElementById("temp-slider");
    element.value = 327;
    Remote.updateSliderThumbColor(element, "temp");
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "TEMP", value: element.value});
  },

  // edit menu buttons
  "show-all-button" () {
    const parent = document.getElementById("visible-modules-results");
    const buttons = Array.from(parent.children);
    for (const button of buttons) {
      if (Remote.hasClass(button, "external-locked")) {
        continue;
      }
      button.className = button.className.replace("toggled-off", "toggled-on");
      Remote.showModule(button.id);
    }
  },
  "hide-all-button" () {
    const parent = document.getElementById("visible-modules-results");
    const buttons = Array.from(parent.children);
    for (const button of buttons) {
      button.className = button.className.replace("toggled-on", "toggled-off");
      Remote.hideModule(button.id);
    }
  },

  // power menu buttons
  "shut-down-button" () {
    const self = Remote;

    const wrapper = document.createElement("div");
    const text = document.createElement("span");
    text.innerHTML = self.translate("CONFIRM_SHUTDOWN");
    wrapper.appendChild(text);

    const ok = self.createSymbolText("fa fa-power-off", self.translate("SHUTDOWN"), () => {
      Remote.sendSocketNotification("REMOTE_ACTION", {action: "SHUTDOWN"});
    });
    wrapper.appendChild(ok);

    const cancel = self.createSymbolText("fa fa-times", self.translate("CANCEL"), () => {
      self.setStatus("none");
    });
    wrapper.appendChild(cancel);

    self.setStatus(false, false, wrapper);
  },
  "restart-button" () {
    const self = Remote;

    const wrapper = document.createElement("div");
    const text = document.createElement("span");
    text.innerHTML = self.translate("CONFIRM_RESTART");
    wrapper.appendChild(text);

    const ok = self.createSymbolText("fa fa-refresh", self.translate("RESTART"), () => {
      Remote.sendSocketNotification("REMOTE_ACTION", {action: "REBOOT"});
    });
    wrapper.appendChild(ok);

    const cancel = self.createSymbolText("fa fa-times", self.translate("CANCEL"), () => {
      self.setStatus("none");
    });
    wrapper.appendChild(cancel);

    self.setStatus(false, false, wrapper);
  },
  "restart-mm-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "RESTART"});
    setTimeout(() => {
      document.location.reload();
    }, 60000);
  },
  "monitor-on-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "MONITORON"});
  },
  "monitor-off-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "MONITOROFF"});
  },
  "refresh-mm-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "REFRESH"});
  },
  "fullscreen-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "TOGGLEFULLSCREEN"});
  },
  "minimize-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "MINIMIZE"});
  },
  "devtools-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "DEVTOOLS"});
  },

  // config menu buttons
  "add-module" () {
    window.location.hash = "add-module-menu";
  },
  "save-config" () {
    Remote.saveConfig();
  },

  "restore-config" () {
    Remote.restoreConfigMenu();
  },
  // main menu
  "save-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "SAVE"});
  },
  "close-popup" () {
    Remote.closePopup();
  },
  "close-result" () {
    Remote.setStatus("none");
  },

  // alert menu
  "send-alert-button" () {
    const kvpairs = {};
    const form = document.getElementById("alert");
    for (const e of form.elements) {
      kvpairs[e.name] = e.value;
    }
    Remote.sendSocketNotification("REMOTE_ACTION", kvpairs);
  },
  "hide-alert-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "HIDE_ALERT"});
  }
};

// Initialize socket connection
Remote.sendSocketNotification("REMOTE_CLIENT_CONNECTED");
Remote.sendSocketNotification("REMOTE_ACTION", {data: "translations"});
Remote.loadButtons(buttons);
Remote.loadOtherElements();

Remote.setStatus("none");

if (window.location.hash) {
  Remote.showMenu(window.location.hash.substring(1));
} else {
  Remote.showMenu("main-menu");
}

window.onhashchange = () => {
  if (Remote.skipHashChange) {
    Remote.skipHashChange = false;
    return;
  }
  if (window.location.hash) {
    Remote.showMenu(window.location.hash.substring(1));
  } else {
    Remote.showMenu("main-menu");
  }
};

// loading successful, remove error message
const loadError = document.getElementById("load-error");
loadError.parentNode.removeChild(loadError);
