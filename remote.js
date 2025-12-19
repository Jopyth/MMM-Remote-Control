/* global MMSocket marked */

// main javascript file for the remote control page

const Remote = {
  name: "MMM-Remote-Control",
  currentMenu: "main-menu",
  types: ["string", "number", "boolean", "array", "object", "null", "undefined"],
  values: ["", 0, true, [], {}, null, undefined],
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
    if (this._socket === undefined) {
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
        switch (payload.query.data) {
          case "config_update":
            this.handleSaveConfig(payload);

            break;

          case "saves":
            this.handleRestoreConfigMenu(payload);

            break;

          case "mmUpdateAvailable":
            this.handleMmUpdate(payload.result);

            break;

          case "brightness": {
            const slider = document.querySelector("#brightness-slider");
            slider.value = payload.result;

            break;
          }
          case "translations":
            this.translations = payload.data;
            this.onTranslationsLoaded();

            break;

          default:
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
    switch (notification) {
      case "REFRESH":
        setTimeout(() => { document.location.reload(); }, 2000);
        return;

      case "RESTART":
        setTimeout(() => {
          document.location.reload();
        }, 62_000);
        return;

      case "REMOTE_CLIENT_CUSTOM_MENU":
        this.customMenu = payload;
        this.createDynamicMenu(this.customMenu);
        return;

      case "REMOTE_CLIENT_MODULEAPI_MENU":
        this.moduleApiMenu = payload;
        this.createDynamicMenu(this.moduleApiMenu);
        return;

    }
  },

  loadButtons (buttons) {
    for (const key of Object.keys(buttons)) {
      document.getElementById(key).addEventListener("click", buttons[key], false);
    }
  },

  translate (pattern) {
    return this.translations[pattern];
  },

  hasClass (element, name) {
    return ` ${element.className} `.includes(` ${name} `);
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
    if ("installed".includes(pattern)) {
      filterInstalled = true;
      pattern = pattern.replace("installed");
    }
    pattern = pattern.trim();

    const regex = new RegExp(pattern, "i");
    const searchIn = ["author", "desc", "longname", "name"];

    const data = this.savedData.moduleAvailable;
    for (const [index, currentData] of data.entries()) {
      const id = `install-module-${index}`;
      const element = document.getElementById(id);
      if (!pattern) {
        // cleared search input, show all
        element.classList.remove("hidden");
        continue;
      }

      let match = filterInstalled && currentData.installed;

      for (const key of searchIn) {
        if (match || currentData[key]?.match(regex)) {
          match = true;
          break;
        }
      }
      element.classList.toggle("hidden", !match);
    }
  },

  updateSliderThumbColor (slider, type) {
    const value = Number.parseInt(slider.value, 10);
    const min = Number.parseInt(slider.min, 10);
    const max = Number.parseInt(slider.max, 10);
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
    const popupContainer = document.querySelector("#popup-container");
    const popupContents = document.querySelector("#popup-contents");
    popupContainer?.classList.add("hidden");
    if (popupContents) popupContents.innerHTML = "";
  },

  showPopup () {
    const popupContainer = document.querySelector("#popup-container");
    popupContainer?.classList.remove("hidden");
  },

  getPopupContent (clear = true) {
    if (clear) {
      this.closePopup();
    }
    return document.querySelector("#popup-contents");
  },

  loadOtherElements () {
    const slider = document.querySelector("#brightness-slider");
    slider.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "BRIGHTNESS", value: slider.value});
    }, false);
    slider.addEventListener("input", () => {
      this.updateSliderThumbColor(slider, "brightness");
    }, false);
    this.updateSliderThumbColor(slider, "brightness");

    const slider2 = document.querySelector("#temp-slider");
    slider2.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "TEMP", value: slider2.value});
    }, false);
    slider2.addEventListener("input", () => {
      this.updateSliderThumbColor(slider2, "temp");
    }, false);
    this.updateSliderThumbColor(slider2, "temp");

    const input = document.querySelector("#add-module-search");
    const deleteButton = document.querySelector("#delete-search-input");

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
    if (this.currentMenu === "settings-menu") {
      // check for unsaved changes
      const changes = this.deletedModules.length + this.changedModules.length;
      if (changes > 0) {
        const wrapper = document.createElement("div");
        const text = document.createElement("span");
        text.textContent = this.translate("UNSAVED_CHANGES");
        wrapper.append(text);

        const ok = this.createSymbolText("fa fa-check-circle", this.translate("OK"), () => {
          this.setStatus("none");
        });
        wrapper.append(ok);

        const discard = this.createSymbolText("fa fa-warning", this.translate("DISCARD"), () => {
          this.deletedModules = [];
          this.changedModules = [];
          globalThis.location.hash = newMenu;
        });
        wrapper.append(discard);

        this.setStatus(false, false, wrapper);

        this.skipHashChange = true;
        globalThis.location.hash = this.currentMenu;

        return;
      }
    }


    switch (newMenu) {
      case "add-module-menu":
        this.loadModulesToAdd();
        break;

      case "edit-menu":
        this.loadVisibleModules();
        this.loadBrightness();
        this.loadTemp();
        break;

      case "settings-menu":
        this.loadConfigModules();
        break;

      case "classes-menu":
        this.loadClasses();
        break;

      case "update-menu":
        this.loadModulesToUpdate();
        break;

      case "links-menu":
        this.loadLinks();
        break;

    }

    if (newMenu === "main-menu") {
      try {
        const {data: configData} = await this.loadList("config-modules", "config");
        const alertElement = document.querySelector("#alert-button");
        if (!configData.modules.some((m) => m.module === "alert") && alertElement) { alertElement.remove(); }

        const moduleConfig = configData.modules.find((m) => m.module === "MMM-Remote-Control").config;
        const classesButton = document.querySelector("#classes-button");
        if ((!moduleConfig || !moduleConfig.classes) && classesButton) { classesButton.remove(); }
      } catch (error) {
        console.error("Error loading config for main menu:", error);
      }
    }

    const allMenus = [...document.querySelectorAll(".menu-element")];

    for (const menu of allMenus) {
      this.hide(menu);
    }

    const currentMenu = [...document.getElementsByClassName(newMenu)];

    for (const menu of currentMenu) {
      this.show(menu);
    }

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
      const headerTitleElement = document.querySelector(".header .header-title");
      if (!headerTitleElement) { return; }

      const hasTranslations = this.translations && Object.keys(this.translations).length > 0;
      if (!hasTranslations) { return; }

      const key = menuName || this.currentMenu || "main-menu";
      const titleKey = this.getMenuTitleKey(key);
      let titleText = titleKey ? this.translate(titleKey) : null;

      // Special case for classes-menu: use button text if available
      if (!titleText && key === "classes-menu") {
        const classesButton = document.querySelector("#classes-button");
        titleText = classesButton?.querySelector(".text")?.textContent || this.translate("TITLE");
      }

      if (titleText) {
        headerTitleElement.textContent = titleText;
      }
    } catch (error) {
      console.warn("Failed to update header title:", error);
    }
  },

  openLink (url) {
    return () => window.open(url, "_blank");
  },

  loadLinks () {
    const parent = document.querySelector("#links-container-nav");
    if (!parent) { return; }
    while (parent.firstChild) parent.firstChild.remove();

    const items = [
      {icon: "fa-book", text: this.translate("API_DOCS"), url: `${globalThis.location.origin}/api/docs/`},
      {icon: "fa-globe", text: this.translate("WEBSITE"), url: "https://magicmirror.builders/"},
      {icon: "fa-comments", text: this.translate("FORUM"), url: "https://forum.magicmirror.builders/"},
      {icon: "fa-github", text: this.translate("REPOSITORY"), url: "https://github.com/Jopyth/MMM-Remote-Control"}
    ];

    for (const {icon, text, url} of items) {
      parent.append(this.createSymbolText(`fa fa-fw ${icon}`, text, this.openLink(url)));
    }
  },

  setStatus (status, message, customContent) {

    if (this.autoHideTimer !== undefined) {
      clearTimeout(this.autoHideTimer);
    }

    // Simple status update
    if (status === "success" && !message && !customContent) {
      const successPopup = document.querySelector("#success-popup");
      successPopup.classList.remove("hidden");
      this.autoHideTimer = setTimeout(() => { successPopup.classList.add("hidden"); }, this.autoHideDelay);
      return;
    }

    const parent = document.querySelector("#result-contents");
    while (parent.firstChild) {
      parent.firstChild.remove();
    }

    if (status === "none") {
      this.hide(document.querySelector("#result-overlay"));
      this.hide(document.querySelector("#result"));
      return;
    }

    if (customContent) {
      parent.append(customContent);
      this.show(document.querySelector("#result-overlay"));
      this.show(document.querySelector("#result"));
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
        this.setStatus("none");
      };
      // Only auto-hide errors if autoHideDelayError > 0, otherwise user must click to dismiss
      if (this.autoHideDelayError > 0) {
        this.autoHideTimer = setTimeout(() => {
          this.setStatus("none");
        }, this.autoHideDelayError);
      }
    }
    if (status === "info") {
      symbol = "fa-info-circle";
      text = this.translate("INFO");
      onClick = () => {
        this.setStatus("none");
      };
      // Info messages (like PM2 restart/stop) should be displayed longer
      if (this.autoHideDelayInfo > 0) {
        this.autoHideTimer = setTimeout(() => {
          this.setStatus("none");
        }, this.autoHideDelayInfo);
      }
    }
    if (status === "success") {
      symbol = "fa-check-circle";
      text = this.translate("DONE");
      onClick = () => {
        this.setStatus("none");
      };
      this.autoHideTimer = setTimeout(() => {
        this.setStatus("none");
      }, this.autoHideDelay);
    }
    if (message) {
      text = typeof message === "object" ? JSON.stringify(message, undefined, 3) : message;
    }
    parent.append(this.createSymbolText(`fa fa-fw ${symbol}`, text, onClick));

    this.show(document.querySelector("#result-overlay"));
    this.show(document.querySelector("#result"));
  },

  async getWithStatus (parameters) {
    this.setStatus("loading");
    const response = await this.get("remote", parameters);

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
    const downloadButton = document.querySelector("#download-button");
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

  async get (route, parameters, timeout) {
    const url = `${route}?${parameters}`;
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
        document.body.append(errorMessage);
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

  formatLabel (string) {

    /*
     * let result = string.replace(/([A-Z])/g, " $1" );
     * return result.charAt(0).toUpperCase() + result.slice(1);
     */
    return string;
  },

  formatPosition (string) {
    return string.replaceAll("_", " ").replaceAll(/\w\S*/g, (txt) => txt.at(0).toUpperCase() + txt.slice(1).toLowerCase());
  },

  getVisibilityStatus (data) {
    let status = "toggled-on";
    const modules = [];
    if (data.hidden) {
      status = "toggled-off";
      for (const lockString of data.lockStrings) {
        if (lockString.includes("MMM-Remote-Control")) {
          continue;
        }
        modules.push(lockString);
        if (modules.length === 1) {
          status += " external-locked";
        }
      }
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

    for (const className of spanClasses) {
      const innerSpan = document.createElement("span");
      innerSpan.className = className;
      outerSpan.append(innerSpan);
    }

    parent.append(outerSpan);
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
          wrapper.append(warning);

          const ok = this.createSymbolText("fa fa-check-circle", this.translate("OK"), () => {
            this.setStatus("none");
          });
          wrapper.append(ok);

          const force = this.createSymbolText("fa fa-warning", this.translate("FORCE_SHOW"), () => {
            event.currentTarget.classList.remove("external-locked", "toggled-off");
            event.currentTarget.classList.add("toggled-on");
            this.showModule(event.currentTarget.id, true);
            this.setStatus("none");
          });
          wrapper.append(force);

          this.setStatus("error", false, wrapper);
        } else {
          event.currentTarget.classList.remove("toggled-off");
          event.currentTarget.classList.add("toggled-on");
          this.showModule(event.currentTarget.id);
        }
      } else {
        event.currentTarget.classList.remove("toggled-on");
        event.currentTarget.classList.add("toggled-off");
        this.hideModule(event.currentTarget.id);
      }
    });
  },

  async loadVisibleModules () {
    try {
      const {data: moduleData} = await this.loadList("visible-modules", "modules");
      const parent = document.querySelector("#visible-modules-results");
      for (const module of moduleData) {
        if (!module.position) {
          // skip invisible modules
          continue;
        }
        const visibilityStatus = this.getVisibilityStatus(module);

        const moduleBox = document.createElement("div");
        moduleBox.className = `button module-line ${visibilityStatus.status}`;
        moduleBox.id = module.identifier;

        this.addToggleElements(moduleBox);

        const text = document.createElement("span");
        text.className = "text";
        text.innerHTML = ` ${module.name}`;
        if ("header" in module) {
          text.innerHTML += ` (${module.header})`;
        }
        moduleBox.append(text);

        parent.append(moduleBox);

        this.makeToggleButton(moduleBox, visibilityStatus);
      }
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
    wrapper.append(symbolElement);
    const textElement = document.createElement("span");
    textElement.innerHTML = text;
    textElement.className = "symbol-text-padding";
    wrapper.append(textElement);
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
    const name = path.at(-1);

    let current = this.currentConfig;
    for (let index = 1; index < path.length - 1; index++) {
      current = current[path[index]];
    }
    const initialValue = this.values[this.types.indexOf(newType)];
    const newGUI = this.createObjectGUI(key, name, initialValue);
    oldGUI.parentNode.replaceChild(newGUI, oldGUI);
  },

  createTypeEditSelection (key, parent, type, oldElement) {
    const previousType = oldElement.children[1].innerHTML.slice(1).toLowerCase();
    const select = document.createElement("select");
    for (const typeOption of this.types) {
      const option = document.createElement("option");
      option.innerHTML = typeOption;
      option.value = typeOption;
      if (typeOption === type) {
        option.selected = "selected";
      }
      select.append(option);
    }
    select.addEventListener("change", () => {
      const newType = select.options[select.selectedIndex].innerHTML.toLowerCase();
      if (previousType === newType) {
        select.replaceWith(oldElement);
      } else {
        this.recreateConfigElement(key, previousType, newType);
      }
    }, false);
    select.addEventListener("blur", () => {
      select.replaceWith(oldElement);
    }, false);
    return select;
  },

  createConfigLabel (key, name, type, forcedType, symbol = "fa-tag") {

    if (name.at(0) === "#") {
      symbol = "fa-hashtag";
      name = name.slice(1);
    }
    const label = document.createElement("label");
    label.htmlFor = key;
    label.className = "config-label";
    const desc = Remote.createSymbolText(`fa fa-fw ${symbol}`, this.formatLabel(name), false, "span");
    desc.className = "label-name";
    label.append(desc);

    if (!forcedType) {
      const typeLabel = Remote.createSymbolText("fa fa-fw fa-pencil", type, (event) => {
        const thisElement = event.currentTarget;
        label.replaceChild(this.createTypeEditSelection(key, label, type, thisElement), thisElement);
      }, "span");
      typeLabel.classList.add("module-remove");
      label.append(typeLabel);

      const remove = Remote.createSymbolText("fa fa-fw fa-times-circle", this.translate("REMOVE"), (event) => {
        const thisElement = event.currentTarget;
        const elementToRemove = type === "array" || type === "object"
          ? thisElement.parentNode.parentNode
          : thisElement.parentNode;
        elementToRemove.remove();
      }, "span");
      remove.classList.add("module-remove");
      label.append(remove);
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
      label.classList.add("highlight");
    }, false);
    input.addEventListener("blur", (event) => {
      const label = event.currentTarget.parentNode;
      label.classList.remove("highlight");
    }, false);

    return input;
  },

  createVisualCheckbox (key, wrapper, input, className) {
    const visualCheckbox = document.createElement("span");
    visualCheckbox.className = `visual-checkbox fa fa-fw ${className}`;
    wrapper.append(visualCheckbox);
  },

  createConfigElement (type) {
    return {
      string: (key, name, value, type, forcedType) => {
        const label = this.createConfigLabel(key, name, type, forcedType);
        const input = this.createConfigInput(key, value);
        input.type = "text";
        label.append(input);
        if (key === "<root>/header") {
          input.placeholder = this.translate("NO_HEADER");
        }
        return label;
      },
      number: (key, name, value, type, forcedType) => {
        const label = this.createConfigLabel(key, name, type, forcedType);
        const input = this.createConfigInput(key, value);
        input.type = "number";
        if (value % 1 !== 0) {
          input.step = 0.01;
        }
        label.append(input);
        return label;
      },
      boolean: (key, name, value, type, forcedType) => {
        const label = this.createConfigLabel(key, name, type, forcedType);

        const input = this.createConfigInput(key, value, true);
        input.type = "checkbox";
        label.append(input);
        if (value) {
          input.checked = true;
        }

        this.createVisualCheckbox(key, label, input, "fa-check-square-o", false);
        this.createVisualCheckbox(key, label, input, "fa-square-o", true);
        return label;
      },
      undefined: (key, name, value, type, forcedType) => {
        const label = this.createConfigLabel(key, name, type, forcedType);
        const input = this.createConfigInput(key, value);
        input.type = "text";
        input.disabled = "disabled";
        input.classList.add("disabled", "undefined");
        input.placeholder = "undefined";
        label.append(input);
        return label;
      },
      null: (key, name, value, type, forcedType) => {
        const label = this.createConfigLabel(key, name, type, forcedType);
        const input = this.createConfigInput(key, value);
        input.type = "text";
        input.disabled = "disabled";
        input.classList.add("disabled", "null");
        input.placeholder = "null";
        label.append(input);
        return label;
      },
      position: (key, name, value, type, forcedType) => {
        const label = this.createConfigLabel(key, name, type, forcedType);
        const select = this.createConfigInput(key, value, false, "select");
        select.className = "config-input";
        select.id = key;
        for (const position of this.validPositions) {
          const option = document.createElement("option");
          option.value = position;
          option.innerHTML = position ? this.formatPosition(position) : this.translate("NO_POSITION");
          if (position === value) {
            option.selected = "selected";
          }
          select.append(option);
        }
        label.append(select);
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
      wrapper.append(this.createConfigLabel(path, name, type, forcedType, "fa-list-ol"));
      wrapper.append(add);
      for (const [index, item] of dataToEdit.entries()) {
        const newName = `#${index}`;
        wrapper.append(this.createObjectGUI(`${path}/${newName}`, newName, item));
      }
      add.addEventListener("click", () => {
        const lastIndex = dataToEdit.length - 1;
        const lastType = this.getTypeAsString(`${path}/#${lastIndex}`, dataToEdit[lastIndex]);
        dataToEdit.push(this.values[this.types.indexOf(lastType)]);
        const nextName = `#${lastIndex + 1}`;
        wrapper.append(this.createObjectGUI(`${path}/${nextName}`, nextName, dataToEdit.at(-1)));
      }, false);
      return wrapper;
    }

    // object
    if (path !== "<root>") {
      wrapper.append(this.createConfigLabel(path, name, type, forcedType, "fa-list-ul"));

      const addElement = this.createConfigLabel(`${path}/<add>`, this.translate("ADD_ENTRY"), type, true, "fa-plus");
      addElement.classList.add("bottom-spacing");
      const inputWrapper = document.createElement("div");
      inputWrapper.className = "add-input-wrapper";
      const input = this.createConfigInput(`${path}/<add>`, "");
      input.type = "text";
      input.placeholder = this.translate("NEW_ENTRY_NAME");
      addElement.append(inputWrapper);
      inputWrapper.append(input);
      const addFunction = () => {
        const existingKey = Object.keys(dataToEdit)[0];
        const lastType = this.getTypeAsString(`${path}/${existingKey}`, dataToEdit[existingKey]);
        const key = input.value.trim();

        if (!key || document.getElementById(`${path}/${key}`)) {
          input.classList.add("input-error");
          return;
        }

        input.classList.remove("input-error");
        dataToEdit[key] = this.values[this.types.indexOf(lastType)];
        const newElement = this.createObjectGUI(`${path}/${key}`, key, dataToEdit[key]);
        wrapper.insertBefore(newElement, addElement.nextSibling);
        input.value = "";
      };
      const symbol = document.createElement("span");
      symbol.className = "fa fa-fw fa-plus-square button";
      symbol.addEventListener("click", addFunction, false);
      inputWrapper.append(symbol);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addFunction();
        }
      });
      wrapper.append(addElement);
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
    for (const key of keys) {
      if (Object.hasOwn(dataToEdit, key)) {
        wrapper.append(this.createObjectGUI(`${path}/${key}`, key, dataToEdit[key]));
      }
    }
    if (path === "<root>") {
      // additional css classes on root element
      wrapper.className = "flex-fill small";
    }
    return wrapper;
  },

  appendConfigMenu (index, wrapper) {

    const menuDiv = document.createElement("div");
    menuDiv.className = "fixed-size sub-menu";

    const help = this.createSymbolText("fa fa-fw fa-question-circle", this.translate("HELP"), () => {
      window.open(`config-help.html?module=${this.currentConfig.module}`, "_blank");
    });
    menuDiv.append(help);
    const undo = this.createSymbolText("fa fa-fw fa-undo", this.translate("RESET"), () => {
      this.createConfigPopup(index);
    });
    menuDiv.append(undo);
    const save = this.createSymbolText("fa fa-fw fa-save", this.translate("SAVE"), () => {
      this.savedData.config.modules[index] = this.getModuleConfigFromUI();
      this.changedModules.push(index);
      const parent = document.getElementById(`edit-module-${index}`).parentNode;
      if (parent.children.length === 2) {
        parent.insertBefore(this.createChangedWarning(), parent.children[1]);
      }
      this.closePopup();
    });
    menuDiv.append(save);

    wrapper.append(menuDiv);

  },

  setValue (parent, name, value) {
    if (name.includes("#")) {
      parent.push(value);
    } else {
      parent[name] = value;
    }
  },

  navigate (parent, name) {
    if (name.includes("#")) {
      return parent.at(-1);
    }
    return parent[name];

  },

  getModuleConfigFromUI () {
    const rootElement = {};
    const elements = [...document.querySelectorAll(".config-input")];
    for (const element of elements) {
      const path = element.id;
      const splitPath = path.split("/");
      let parent = rootElement;
      for (let k = 1; k < splitPath.length - 1; k++) {
        parent = this.navigate(parent, splitPath[k]);
      }
      const name = splitPath.at(-1);
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
        value = Number.parseFloat(value);
      }
      this.setValue(parent, name, value);
    }
    return rootElement;
  },

  createConfigPopup (index) {
    if (typeof index === "string") {
      index = Number.parseInt(index);
    }

    const moduleData = this.savedData.config.modules;
    const data = moduleData[index];

    this.currentConfig = data;
    if (!("header" in this.currentConfig)) {
      this.currentConfig.header = "";
    }
    if (!("position" in this.currentConfig)) {
      this.currentConfig.position = "";
    }

    const wrapper = this.getPopupContent();

    const name = document.createElement("div");
    name.innerHTML = data.module;
    name.className = "bright title medium";
    wrapper.append(name);

    const n = document.createElement("div");
    n.innerHTML = `${data.module} (#${index + 1})`;
    n.className = "subtitle xsmall dimmed";
    wrapper.append(n);

    this.appendConfigMenu(index, wrapper);

    wrapper.append(this.createObjectGUI("<root>", "", this.currentConfig));

    // disable input for module name
    const moduleInput = document.getElementById("<root>/module");
    moduleInput.disabled = true;
    moduleInput.classList.add("disabled");

    this.showPopup();
  },

  createChangedWarning () {
    const changed = Remote.createSymbolText("fa fa-fw fa-warning", this.translate("UNSAVED_CHANGES"), () => {
      const saveButton = document.querySelector("#save-config");
      if (!this.hasClass(saveButton, "highlight")) {
        saveButton.classList.add("highlight");
      }
    }, "span");
    changed.classList.add("module-remove");
    return changed;
  },

  appendModuleEditElements (wrapper, moduleData) {
    for (const [index, data] of moduleData.entries()) {
      const innerWrapper = document.createElement("div");
      innerWrapper.className = "module-line";

      // Module name (left side)
      const moduleName = document.createElement("div");
      moduleName.className = "module-name";
      moduleName.textContent = data.module;
      innerWrapper.append(moduleName);

      // Buttons container (right side)
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "module-buttons";

      // Add repository button if URL is available (first button)
      this.getModuleUrl(data.module).then((url) => {
        if (url) {
          const repoButton = this.createSymbolText("fa fa-fw fa-github", this.translate("REPOSITORY"), () => {
            window.open(url, "_blank");
          }, "span");
          repoButton.className = "button";
          buttonsContainer.insertBefore(repoButton, buttonsContainer.firstChild);
        }
      });

      const moduleBox = this.createSymbolText("fa fa-fw fa-pencil", this.translate("EDIT"), (event) => {
        const index_ = event.currentTarget.id.replace("edit-module-", "");
        this.createConfigPopup(index_);
      }, "span");
      moduleBox.id = `edit-module-${index}`;
      buttonsContainer.append(moduleBox);

      if (this.changedModules.includes(index)) {
        buttonsContainer.append(this.createChangedWarning());
      }

      const remove = Remote.createSymbolText("fa fa-fw fa-times-circle", this.translate("REMOVE"), (event) => {
        const index = event.currentTarget.parentNode.parentNode.firstChild.nextSibling.firstChild.id.replace("edit-module-", "");
        this.deletedModules.push(Number.parseInt(index));
        const thisElement = event.currentTarget.parentNode.parentNode;
        thisElement.remove();
      }, "span");
      remove.classList.add("module-remove");
      buttonsContainer.append(remove);

      innerWrapper.append(buttonsContainer);
      wrapper.append(innerWrapper);
    }
  },

  async loadConfigModules () {
    this.changedModules = [];

    try {
      const {data: configData} = await this.loadList("config-modules", "config");
      const parent = document.querySelector("#config-modules-results");
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
        this.installedModulesCache = result.success && result.data ? result.data : [];
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
      for (const index in classes) {
        const node = document.createElement("div");
        node.id = "classes-before-result";
        node.hidden = true;
        document.querySelector("#classes-results").append(node);

        const content = {
          id: index,
          text: index,
          icon: "dot-circle-o",
          type: "item",
          action: "MANAGE_CLASSES",
          content: {
            payload: {
              classes: index
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
    if (typeof index === "string") {
      index = Number.parseInt(index);
    }

    const data = this.savedData.moduleAvailable[index];
    const wrapper = this.getPopupContent();

    const name = document.createElement("div");
    name.innerHTML = data.name;
    name.className = "bright title";
    wrapper.append(name);

    const author = document.createElement("div");
    author.innerHTML = `${this.translate("BY")} ${data.author}`;
    author.className = "subtitle small";
    wrapper.append(author);

    const desc = document.createElement("div");
    desc.innerHTML = data.desc;
    desc.className = "small flex-fill";
    wrapper.append(desc);

    const footer = document.createElement("div");
    footer.className = "fixed-size sub-menu";

    if (data.installed) {
      const add = this.createSymbolText("fa fa-fw fa-plus", this.translate("ADD_THIS"), () => {
        this.closePopup();
        this.addModule = data.longname;
        globalThis.location.hash = "settings-menu";
      });
      footer.append(add);
    }

    if (data.installed) {
      const statusElement = this.createSymbolText("fa fa-fw fa-check-circle", this.translate("INSTALLED"));
      footer.append(statusElement);
    } else {
      const statusElement = this.createSymbolText("fa fa-fw fa-download", this.translate("DOWNLOAD"), () => {
        this.install(data.url, index);
      });
      statusElement.id = "download-button";
      footer.append(statusElement);
    }

    const githubElement = this.createSymbolText("fa fa-fw fa-github", this.translate("CODE_LINK"), () => {
      window.open(data.url, "_blank");
    });
    footer.append(githubElement);

    wrapper.append(footer);

    this.showPopup();
  },

  async loadModulesToAdd () {
    try {
      const {data: modules} = await this.loadList("add-module", "moduleAvailable");
      const parent = document.querySelector("#add-module-results");
      for (const [index, module] of modules.entries()) {
        const moduleWrapper = document.createElement("div");
        moduleWrapper.className = "module-line";

        // Left side: Module name and description
        const moduleInfo = document.createElement("div");
        moduleInfo.className = "module-info";

        const moduleName = document.createElement("div");
        moduleName.className = "module-name";
        moduleName.textContent = module.name;
        moduleInfo.append(moduleName);

        if (module.desc) {
          const moduleDesc = document.createElement("div");
          moduleDesc.className = "module-description";
          moduleDesc.innerHTML = module.desc;
          moduleInfo.append(moduleDesc);
        }

        moduleWrapper.append(moduleInfo);

        // Right side: Buttons
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "module-buttons";

        // Repository button
        if (module.url) {
          const repoButton = this.createSymbolText("fa fa-fw fa-github", "Repository", () => {
            window.open(module.url, "_blank");
          }, "span");
          repoButton.className = "button";
          buttonsContainer.append(repoButton);
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
        installButton.id = `install-module-${index}`;
        buttonsContainer.append(installButton);

        moduleWrapper.append(buttonsContainer);
        parent.append(moduleWrapper);
      }
    } catch (error) {
      console.error("Error loading modules to add:", error);
    }
  },

  offerRestart (message) {
    const wrapper = document.createElement("div");

    const info = document.createElement("span");
    info.innerHTML = message;
    wrapper.append(info);

    const restart = this.createSymbolText("fa fa-fw fa-recycle", this.translate("RESTARTMM"), buttons["restart-mm-button"]);
    restart.children[1].classList.add("text");
    wrapper.append(restart);
    this.setStatus("success", false, wrapper);
  },

  offerReload (message) {
    const wrapper = document.createElement("div");

    const info = document.createElement("span");
    info.innerHTML = message;
    wrapper.append(info);

    const restart = this.createSymbolText("fa fa-fw fa-recycle", this.translate("RESTARTMM"), buttons["restart-mm-button"]);
    restart.children[1].classList.add("text");
    wrapper.append(restart);

    const reload = this.createSymbolText("fa fa-fw fa-globe", this.translate("REFRESHMM"), buttons["refresh-mm-button"]);
    reload.children[1].classList.add("text");
    wrapper.append(reload);

    this.setStatus("success", false, wrapper);
  },

  offerOptions (message, data) {
    const wrapper = document.createElement("div");
    const info = document.createElement("span");
    info.innerHTML = message;
    wrapper.append(info);

    for (const b in data) {
      const restart = this.createSymbolText("fa fa-fw fa-recycle", b, data[b]);
      restart.children[1].classList.add("text");
      wrapper.append(restart);
    }

    this.setStatus("success", false, wrapper);
  },

  updateModule (module) {
    this.sendSocketNotification("REMOTE_ACTION", {action: "UPDATE", module});
  },

  handleMmUpdate (result) {
    if (globalThis.location.hash.slice(1) == "update-menu") {
      const updateButton = document.querySelector("#update-mm-button");
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
      const parent = document.querySelector("#update-module-results");

      // Create MagicMirror² update line first
      const mmWrapper = document.createElement("div");
      mmWrapper.id = "mm-update-container";
      mmWrapper.className = "module-line mm-update-line";

      const mmName = document.createElement("div");
      mmName.className = "module-name";
      mmName.textContent = "MagicMirror²";
      mmWrapper.append(mmName);

      const mmButtons = document.createElement("div");
      mmButtons.className = "module-buttons";

      // MM Update button (initially hidden, shown by handleMmUpdate)
      const mmUpdateButton = this.createSymbolText("fa fa-fw fa-toggle-up", "Update", () => {
        this.updateModule();
      });
      mmUpdateButton.id = "update-mm-button";
      mmUpdateButton.className = "button hidden";
      mmButtons.append(mmUpdateButton);

      // MM Changelog button (always visible) - opens GitHub releases
      const mmChangelogButton = this.createSymbolText("fa fa-fw fa-file-text-o", "Changelog", () => {
        window.open("https://github.com/MagicMirrorOrg/MagicMirror/releases", "_blank");
      });
      mmChangelogButton.className = "button";
      mmButtons.append(mmChangelogButton);

      mmWrapper.append(mmButtons);
      parent.append(mmWrapper);

      // Now load module updates
      for (const module of modules) {
        const innerWrapper = document.createElement("div");
        innerWrapper.className = "module-line";

        // Module name (non-clickable)
        const moduleName = document.createElement("div");
        moduleName.className = "module-name";
        moduleName.textContent = module.name;
        innerWrapper.append(moduleName);

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
          buttonsContainer.append(updateButton);
        }

        // Add changelog button if module has changelog
        if (module.hasChangelog) {
          const changelogButton = this.createSymbolText("fa fa-fw fa-file-text-o", "Changelog", (event) => {
            event.stopPropagation();
            this.showChangelog(module.longname);
          });
          changelogButton.className = "button";
          buttonsContainer.append(changelogButton);
        }

        innerWrapper.append(buttonsContainer);
        parent.append(innerWrapper);
      }
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
    const restoreButton = document.querySelector("#restore-config");
    restoreButton.classList.remove("highlight");
    this.setStatus("loading");
    this.sendSocketNotification("REMOTE_ACTION", {data: "saves"});
  },

  handleRestoreConfigMenu (result) {
    if (result.success) {
      const dates = {};
      for (const index in result.data) {
        dates[new Date(result.data[index])] = () => {
          this.restoreConfig(result.data[index]);
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
    const saveButton = document.querySelector("#save-config");
    saveButton.classList.remove("highlight");
    this.saving = true;
    this.setStatus("loading");
    const configData = this.savedData.config;
    configData.modules = configData.modules.filter((_, index) => !this.deletedModules.includes(index));
    this.deletedModules = [];
    this.sendSocketNotification("NEW_CONFIG", configData);
  },

  handleSaveConfig (result) {
    if (result.success) {
      this.offerReload(this.translate("DONE"));
    } else {
      this.setStatus("error");
    }
    this.saving = false;
    this.loadConfigModules();
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
      item.append(mcmIcon);
    }

    if (content.text) {
      const mcmText = document.createElement("span");
      mcmText.className = "text";
      mcmText.textContent = content.text;
      item.append(mcmText);
    }

    switch (content.type) {
      case "menu": {
        const mcmArrow = document.createElement("span");
        mcmArrow.className = "fa fa-fw fa-angle-right";
        mcmArrow.setAttribute("aria-hidden", "true");
        item.append(mcmArrow);
        item.dataset.parent = menu;
        item.dataset.type = "menu";
        document.querySelector("#back-button").classList.add(`${content.id}-menu`);
        const menuContent = document.querySelector(".menu-content");
        if (menuContent) {
          menuContent.classList.add(`${content.id}-menu`);
        }
        item.addEventListener("click", () => {
          globalThis.location.hash = `${content.id}-menu`;
        });

        break;
      }
      case "slider": {
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
              ...content.content === undefined ? {} : (typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload),
              value: slide.value
            },
            value: slide.value
          });
        });

        contain.append(slide);
        item.append(contain);

        break;
      }
      case "input": {
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
              ...content.content === undefined ? {} : (typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload),
              value: input.value
            },
            value: input.value
          });
        });

        return input;
      }
      default: if (content.action && content.content) {
        item.dataset.type = "item";
        item.addEventListener("click", () => {
          this.sendSocketNotification("REMOTE_ACTION", {
            action: content.action.toUpperCase(),
            payload: {},
            ...content.content
          });
        });
      }

    }

    if (!globalThis.location.hash && menu !== "main" ||
      globalThis.location.hash && globalThis.location.hash.slice(1) !== `${menu}-menu`) {
      item.classList.add("hidden");
    }

    insertAfter.parentNode.insertBefore(item, insertAfter.nextSibling);

    if ("items" in content) {
      for (const index of content.items) {
        this.createMenuElement(index, content.id, item);
      }
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
      for (const menuElement of menuElements) menuElement.remove();

      if (globalThis.location.hash === `#${content.id}-menu`) {
        globalThis.location.hash = "main-menu";
      }
    }
    this.createMenuElement(content, "main", document.querySelector("#alert-button"));
  }
};

const buttons = {
  // navigation buttons
  "power-button" () {
    globalThis.location.hash = "power-menu";
  },
  "edit-button" () {
    globalThis.location.hash = "edit-menu";
  },
  "settings-button" () {
    globalThis.location.hash = "settings-menu";
  },
  "mirror-link-button" () {
    window.open("/", "_blank");
  },
  "classes-button" () {
    globalThis.location.hash = "classes-menu";
  },
  "back-button" () {
    if (globalThis.location.hash === "#add-module-menu") {
      globalThis.location.hash = "settings-menu";
      return;
    }
    const currentButton = document.querySelector(globalThis.location.hash.replace("-menu", "-button"));
    if (currentButton && currentButton.dataset.parent) {
      globalThis.location.hash = `${currentButton.dataset.parent}-menu`;
      return;
    }
    globalThis.location.hash = "main-menu";
  },
  "update-button" () {
    globalThis.location.hash = "update-menu";
  },
  "alert-button" () {
    globalThis.location.hash = "alert-menu";
  },
  "links-button" () {
    globalThis.location.hash = "links-menu";
  },

  // settings menu buttons
  "brightness-reset" () {
    const element = document.querySelector("#brightness-slider");
    element.value = 100;
    Remote.updateSliderThumbColor(element, "brightness");
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "BRIGHTNESS", value: element.value});
  },

  "temp-reset" () {
    const element = document.querySelector("#temp-slider");
    element.value = 327;
    Remote.updateSliderThumbColor(element, "temp");
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "TEMP", value: element.value});
  },

  // edit menu buttons
  "show-all-button" () {
    const parent = document.querySelector("#visible-modules-results");
    const buttons = [...parent.children];
    for (const button of buttons) {
      if (Remote.hasClass(button, "external-locked")) {
        continue;
      }
      button.classList.remove("toggled-off");
      button.classList.add("toggled-on");
      Remote.showModule(button.id);
    }
  },
  "hide-all-button" () {
    const parent = document.querySelector("#visible-modules-results");
    const buttons = [...parent.children];
    for (const button of buttons) {
      button.classList.remove("toggled-on");
      button.classList.add("toggled-off");
      Remote.hideModule(button.id);
    }
  },

  // power menu buttons
  "shut-down-button" () {
    const self = Remote;

    const wrapper = document.createElement("div");
    const text = document.createElement("span");
    text.innerHTML = self.translate("CONFIRM_SHUTDOWN");
    wrapper.append(text);

    const ok = self.createSymbolText("fa fa-power-off", self.translate("SHUTDOWN"), () => {
      Remote.sendSocketNotification("REMOTE_ACTION", {action: "SHUTDOWN"});
    });
    wrapper.append(ok);

    const cancel = self.createSymbolText("fa fa-times", self.translate("CANCEL"), () => {
      self.setStatus("none");
    });
    wrapper.append(cancel);

    self.setStatus(false, false, wrapper);
  },
  "restart-button" () {
    const self = Remote;

    const wrapper = document.createElement("div");
    const text = document.createElement("span");
    text.innerHTML = self.translate("CONFIRM_RESTART");
    wrapper.append(text);

    const ok = self.createSymbolText("fa fa-refresh", self.translate("RESTART"), () => {
      Remote.sendSocketNotification("REMOTE_ACTION", {action: "REBOOT"});
    });
    wrapper.append(ok);

    const cancel = self.createSymbolText("fa fa-times", self.translate("CANCEL"), () => {
      self.setStatus("none");
    });
    wrapper.append(cancel);

    self.setStatus(false, false, wrapper);
  },
  "restart-mm-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "RESTART"});
    setTimeout(() => {
      document.location.reload();
    }, 60_000);
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
    globalThis.location.hash = "add-module-menu";
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
    const form = document.querySelector("#alert");
    for (const e of form.elements) {
      kvpairs[e.name] = e.value;
    }
    Remote.sendSocketNotification("REMOTE_ACTION", kvpairs);
  },
  "hide-alert-button" () {
    Remote.sendSocketNotification("REMOTE_ACTION", {action: "HIDE_ALERT"});
  }
};

// Export Remote to window for testability
if (globalThis.window !== undefined) {
  globalThis.Remote = Remote;
}

// Initialize the Remote UI when DOM is ready
Remote.init = function () {
  // Initialize socket connection
  Remote.sendSocketNotification("REMOTE_CLIENT_CONNECTED");
  Remote.sendSocketNotification("REMOTE_ACTION", {data: "translations"});
  Remote.loadButtons(buttons);
  Remote.loadOtherElements();

  Remote.setStatus("none");

  if (globalThis.location.hash) {
    Remote.showMenu(globalThis.location.hash.slice(1));
  } else {
    Remote.showMenu("main-menu");
  }

  globalThis.addEventListener("hashchange", () => {
    if (Remote.skipHashChange) {
      Remote.skipHashChange = false;
      return;
    }
    if (globalThis.location.hash) {
      Remote.showMenu(globalThis.location.hash.slice(1));
    } else {
      Remote.showMenu("main-menu");
    }
  });

  // loading successful, remove error message
  const loadError = document.querySelector("#load-error");
  if (loadError) {
    loadError.remove();
  }
};

// Auto-initialize when loaded in browser
if (globalThis.window !== undefined && document.querySelector("#load-error")) {
  Remote.init();
}
