// Main javascript file for the remote control page

export const Remote = {
  "name": "MMM-Remote-Control",
  "currentMenu": "main-menu",
  "types": ["string", "number", "boolean", "array", "object", "null", "undefined"],
  "values": ["", 0, true, [], {}, null, undefined],
  "validPositions": [
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
  "savedData": {},
  "translations": {},
  "currentConfig": {},
  "addModule": "",
  "changedModules": [],
  "deletedModules": [],
  "autoHideTimer": undefined, // Internal: Reference to the active auto-hide timeout (do not modify manually)
  "autoHideDelay": 2000, // Ms - Time after which success messages are auto hidden
  "autoHideDelayError": 30 * 1000, // Ms - Time for error messages (0 = no auto-hide, must be clicked away)
  "autoHideDelayInfo": 30 * 1000 // Ms - Time for info messages like restart/stop

};

const buttons = {
  // Navigation buttons
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

    window.open(
      "/",
      "_blank"
    );

  },
  "classes-button" () {

    globalThis.location.hash = "classes-menu";

  },
  "back-button" () {

    if (globalThis.location.hash === "#add-module-menu") {

      globalThis.location.hash = "settings-menu";
      return;

    }
    const currentButton = document.querySelector(globalThis.location.hash.replace(
      "-menu",
      "-button"
    ));
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
  "notification-button" () {

    globalThis.location.hash = "notification-menu";

  },
  "links-button" () {

    globalThis.location.hash = "links-menu";

  },

  // Settings menu buttons
  "brightness-reset" () {

    const element = document.querySelector("#brightness-slider");
    element.value = 100;
    Remote.updateSliderThumbColor(
      element,
      "brightness"
    );
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "BRIGHTNESS", "value": element.value}
    );

  },

  "temp-reset" () {

    const element = document.querySelector("#temp-slider");
    element.value = 327;
    Remote.updateSliderThumbColor(
      element,
      "temp"
    );
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "TEMP", "value": element.value}
    );

  },

  "zoom-reset" () {

    const element = document.querySelector("#zoom-slider");
    element.value = 100;
    Remote.updateSliderThumbColor(
      element,
      "zoom"
    );
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "ZOOM", "value": element.value}
    );

  },

  "background-color-reset" () {

    document.querySelector("#background-color-picker").value = "#000000";
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "BACKGROUND_COLOR", "value": ""}
    );

  },

  "font-color-reset" () {

    document.querySelector("#font-color-picker").value = "#ffffff";
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "FONT_COLOR", "value": ""}
    );

  },

  // Edit menu buttons
  "show-all-button" () {

    const parent = document.querySelector("#visible-modules-results"),
      buttons = [...parent.children];
    for (const button of buttons) {

      if (Remote.hasClass(
        button,
        "external-locked"
      )) {

        continue;

      }
      button.classList.remove("toggled-off");
      button.classList.add("toggled-on");
      Remote.showModule(button.id);

    }

  },
  "hide-all-button" () {

    const parent = document.querySelector("#visible-modules-results"),
      buttons = [...parent.children];
    for (const button of buttons) {

      button.classList.remove("toggled-on");
      button.classList.add("toggled-off");
      Remote.hideModule(button.id);

    }

  },

  // Power menu buttons
  "shut-down-button" () {

    const self = Remote,
      wrapper = document.createElement("div");
    wrapper.innerHTML = `<span>${self.translate("CONFIRM_SHUTDOWN")}</span>`;
    const ok = self.createSymbolText(
      "fa fa-power-off",
      self.translate("SHUTDOWN"),
      () => {

        Remote.sendSocketNotification(
          "REMOTE_ACTION",
          {"action": "SHUTDOWN"}
        );

      }
    );
    wrapper.append(ok);

    const cancel = self.createSymbolText(
      "fa fa-times",
      self.translate("CANCEL"),
      () => {

        self.setStatus("none");

      }
    );
    wrapper.append(cancel);

    self.setStatus(
      false,
      false,
      wrapper
    );

  },
  "restart-button" () {

    const self = Remote,
      wrapper = document.createElement("div");
    wrapper.innerHTML = `<span>${self.translate("CONFIRM_REBOOT")}</span>`;
    const ok = self.createSymbolText(
      "fa fa-refresh",
      self.translate("REBOOT"),
      () => {

        Remote.sendSocketNotification(
          "REMOTE_ACTION",
          {"action": "REBOOT"}
        );

      }
    );
    wrapper.append(ok);

    const cancel = self.createSymbolText(
      "fa fa-times",
      self.translate("CANCEL"),
      () => {

        self.setStatus("none");

      }
    );
    wrapper.append(cancel);

    self.setStatus(
      false,
      false,
      wrapper
    );

  },
  "restart-mm-button" () {

    const self = Remote,
      wrapper = document.createElement("div");
    wrapper.innerHTML = `<span>${self.translate("CONFIRM_RESTARTMM")}</span>`;
    const ok = self.createSymbolText(
      "fa fa-recycle",
      self.translate("RESTARTMM"),
      () => {

        Remote.sendSocketNotification(
          "REMOTE_ACTION",
          {"action": "RESTART"}
        );

      }
    );
    wrapper.append(ok);

    const cancel = self.createSymbolText(
      "fa fa-times",
      self.translate("CANCEL"),
      () => {

        self.setStatus("none");

      }
    );
    wrapper.append(cancel);

    self.setStatus(
      false,
      false,
      wrapper
    );

  },
  "monitor-on-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "MONITORON"}
    );

  },
  "monitor-off-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "MONITOROFF"}
    );

  },
  "refresh-mm-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "REFRESH"}
    );

  },
  "fullscreen-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "TOGGLEFULLSCREEN"}
    );

  },
  "minimize-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "MINIMIZE"}
    );

  },
  "devtools-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "DEVTOOLS"}
    );

  },

  // Config menu buttons
  "add-module" () {

    globalThis.location.hash = "add-module-menu";

  },
  "save-config" () {

    Remote.saveConfig();

  },

  "restore-config" () {

    Remote.restoreConfigMenu();

  },
  // Main menu
  "save-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "SAVE"}
    );

  },
  "close-popup" () {

    Remote.closePopup();

  },
  "close-result" () {

    Remote.setStatus("none");

  },

  // Notification menu
  "send-notification-button" () {

    const name = document.querySelector("#notification-name").value.trim().toUpperCase(),
      rawPayload = document.querySelector("#notification-payload").value.trim();
    if (!name) {

      Remote.setStatus(
        "error",
        Remote.translate("FORM_NOTIFICATION_NAME_MISSING")
      );
      return;

    }
    let payload;
    if (rawPayload) {

      try {

        payload = JSON.parse(rawPayload);

      } catch {

        // Not valid JSON — treat as plain string
        payload = rawPayload;

      }

    }
    localStorage.setItem(
      "mmrc_notification_name",
      name
    );
    localStorage.setItem(
      "mmrc_notification_payload",
      rawPayload
    );
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {
        "action": "NOTIFICATION",
        "notification": name,
        payload
      }
    );

  },
  "restore-notification-button" () {

    const savedName = localStorage.getItem("mmrc_notification_name"),
      savedPayload = localStorage.getItem("mmrc_notification_payload");
    if (savedName) {

      document.querySelector("#notification-name").value = savedName;

    }
    if (savedPayload !== null) {

      const textarea = document.querySelector("#notification-payload");
      textarea.value = savedPayload;
      textarea.dispatchEvent(new Event("input"));

    }
    Remote.updateNotificationUrl();

  },
  "notification-url-copy" () {

    const url = document.querySelector("#notification-url")?.textContent;
    if (url) {

      navigator.clipboard.writeText(url);

    }

  },
  // Alert menu
  "send-alert-button" () {

    const kvpairs = {},
      form = document.querySelector("#alert");
    for (const e of form.elements) {

      kvpairs[e.name] = e.value;

    }
    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      kvpairs
    );

  },
  "hide-alert-button" () {

    Remote.sendSocketNotification(
      "REMOTE_ACTION",
      {"action": "HIDE_ALERT"}
    );

  }
};

// Make buttons accessible to methods in topic files via this.buttons
Remote.buttons = buttons;

Remote.updateNotificationUrl = function () {

  const nameElement = document.querySelector("#notification-name"),
    urlElement = document.querySelector("#notification-url"),
    methodElement = document.querySelector("#notification-url-method");
  if (!nameElement || !urlElement) {

    return;

  }

  const name = nameElement.value.trim().toUpperCase();
  if (!name) {

    urlElement.textContent = "";
    if (methodElement) {

      methodElement.textContent = "";

    }
    return;

  }

  const {origin} = globalThis.location,
    base = `${origin}/api/notification/${encodeURIComponent(name)}`,

    setMethod = (method) => {

      if (!methodElement) {

        return;

      }
      methodElement.textContent = method;
      methodElement.classList.toggle(
        "method-post",
        method === "POST"
      );

    },

    rawPayload = document.querySelector("#notification-payload")?.value.trim() ?? "";
  if (!rawPayload) {

    urlElement.textContent = base;
    setMethod("GET");
    return;

  }

  let parsed;
  try {

    parsed = JSON.parse(rawPayload);

  } catch {

    // Not valid JSON — treat as plain string path segment
    urlElement.textContent = `${base}/${encodeURIComponent(rawPayload)}`;
    setMethod("GET");
    return;

  }

  if (typeof parsed === "object" && parsed !== null) {

    const keys = Object.keys(parsed);
    if (keys.length === 0) {

      urlElement.textContent = base;
      setMethod("GET");

    } else if (Object.values(parsed).every((v) => typeof v !== "object" || v === null)) {

      urlElement.textContent = `${base}?${new URLSearchParams(parsed).toString()}`;
      setMethod("GET");

    } else {

      urlElement.textContent = base;
      setMethod("POST");

    }

  } else {

    urlElement.textContent = `${base}/${encodeURIComponent(String(parsed))}`;
    setMethod("GET");

  }

};

// Initialize the Remote UI when DOM is ready
Remote.init = function () {

  // Initialize socket connection
  Remote.sendSocketNotification("REMOTE_CLIENT_CONNECTED");
  Remote.sendSocketNotification(
    "REMOTE_ACTION",
    {"data": "translations"}
  );
  Remote.loadButtons(buttons);
  Remote.loadOtherElements();

  Remote.setStatus("none");

  if (globalThis.location.hash) {

    Remote.showMenu(globalThis.location.hash.slice(1));

  } else {

    Remote.showMenu("main-menu");

  }

  globalThis.addEventListener(
    "hashchange",
    () => {

      if (Remote.skipHashChange) {

        Remote.skipHashChange = false;
        return;

      }
      if (globalThis.location.hash) {

        Remote.showMenu(globalThis.location.hash.slice(1));

      } else {

        Remote.showMenu("main-menu");

      }

    }
  );

  // Register service worker for PWA support
  if ("serviceWorker" in navigator) {

    navigator.serviceWorker.register("modules/MMM-Remote-Control/service-worker.js").
      then((registration) => {

        console.log(
          "Service Worker registered:",
          registration
        );

      }).
      catch((error) => {

        console.log(
          "Service Worker registration failed:",
          error
        );

      });

  }

  // Loading successful, remove error message
  const loadError = document.querySelector("#load-error");
  if (loadError) {

    loadError.remove();

  }

  // Auto-resize notification payload textarea to fit content
  const payloadTextarea = document.querySelector("#notification-payload");
  if (payloadTextarea) {

    const autoResize = () => {

      payloadTextarea.style.height = "auto";
      payloadTextarea.style.height = `${payloadTextarea.scrollHeight}px`;

    };
    payloadTextarea.addEventListener(
      "input",
      autoResize
    );
    payloadTextarea.addEventListener(
      "input",
      () => {

        Remote.updateNotificationUrl();

      }
    );

    const nameInput = document.querySelector("#notification-name");
    if (nameInput) {

      nameInput.addEventListener(
        "input",
        () => {

          Remote.updateNotificationUrl();

        }
      );

    }

    // Restore last used notification from localStorage
    const savedName = localStorage.getItem("mmrc_notification_name"),
      savedPayload = localStorage.getItem("mmrc_notification_payload");
    if (savedName) {

      document.querySelector("#notification-name").value = savedName;

    }
    if (savedPayload !== null) {

      payloadTextarea.value = savedPayload;

    }
    autoResize(); // Apply after potential restore (height will be corrected by showMenu when visible)
    Remote.updateNotificationUrl();

  }

};
