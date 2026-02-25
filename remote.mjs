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
  "mirror-link-button" () {

    window.open(
      "/",
      "_blank"
    );

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

  // Edit menu buttons
  "show-all-button" () {

    const parent = document.querySelector("#visible-modules-results"),
      buttons = [...parent.children];
    for (const button of buttons) {

      if (button.classList.contains("external-locked")) {

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

  // Config menu buttons
  "save-config" () {

    Remote.saveConfig();

  },

  "restore-config" () {

    Remote.restoreConfigMenu();

  },
  // Main menu
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
    Remote.action(
      "NOTIFICATION",
      {
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

    Remote.action("HIDE_ALERT");

  }
};

// Make buttons accessible to methods in topic files via this.buttons
Remote.buttons = buttons;

/**
 * Shows a confirmation dialog for destructive actions.
 * @param {string} confirmKey - Translation key for the confirmation message.
 * @param {string} icon - FA icon class for the confirm button.
 * @param {string} labelKey - Translation key for the confirm button label.
 * @param {string} action - REMOTE_ACTION name to send on confirm.
 */
function showConfirmation (confirmKey, icon, labelKey, action) {

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<span>${Remote.translate(confirmKey)}</span>`;
  wrapper.append(Remote.createSymbolText(
    icon,
    Remote.translate(labelKey),
    () => { Remote.action(action); }
  ));
  wrapper.append(Remote.createSymbolText(
    "fa fa-times",
    Remote.translate("CANCEL"),
    () => { Remote.setStatus("none"); }
  ));
  Remote.setStatus(
    false,
    false,
    wrapper
  );

}

for (const [id, {selector, defaultValue, type, action}] of Object.entries({
  "brightness-reset": {"selector": "#brightness-slider", "defaultValue": 100, "type": "brightness", "action": "BRIGHTNESS"},
  "temp-reset": {"selector": "#temp-slider", "defaultValue": 327, "type": "temp", "action": "TEMP"},
  "zoom-reset": {"selector": "#zoom-slider", "defaultValue": 100, "type": "zoom", "action": "ZOOM"}
})) {

  buttons[id] = () => {

    const element = document.querySelector(selector);
    element.value = defaultValue;
    Remote.updateSliderThumbColor(
      element,
      type
    );
    Remote.action(
      action,
      {"value": element.value}
    );

  };

}

for (const [id, {selector, defaultValue, action}] of Object.entries({
  "background-color-reset": {"selector": "#background-color-picker", "defaultValue": "#000000", "action": "BACKGROUND_COLOR"},
  "font-color-reset": {"selector": "#font-color-picker", "defaultValue": "#ffffff", "action": "FONT_COLOR"}
})) {

  buttons[id] = () => {

    document.querySelector(selector).value = defaultValue;
    Remote.action(
      action,
      {"value": ""}
    );

  };

}

for (const [id, {confirmKey, icon, labelKey, action}] of Object.entries({
  "shut-down-button": {"confirmKey": "CONFIRM_SHUTDOWN", "icon": "fa fa-power-off", "labelKey": "SHUTDOWN", "action": "SHUTDOWN"},
  "restart-button": {"confirmKey": "CONFIRM_REBOOT", "icon": "fa fa-refresh", "labelKey": "REBOOT", "action": "REBOOT"},
  "restart-mm-button": {"confirmKey": "CONFIRM_RESTARTMM", "icon": "fa fa-recycle", "labelKey": "RESTARTMM", "action": "RESTART"}
})) {

  buttons[id] = () => showConfirmation(
    confirmKey,
    icon,
    labelKey,
    action
  );

}

for (const [id, action] of Object.entries({
  "monitor-on-button": "MONITORON",
  "monitor-off-button": "MONITOROFF",
  "refresh-mm-button": "REFRESH",
  "fullscreen-button": "TOGGLEFULLSCREEN",
  "minimize-button": "MINIMIZE",
  "devtools-button": "DEVTOOLS",
  "save-button": "SAVE"
})) {

  buttons[id] = () => Remote.action(action);

}

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
  Remote.getData("translations");
  // Menu rendering + setup deferred to onTranslationsLoaded()

  globalThis.addEventListener(
    "hashchange",
    () => {

      if (Remote.skipHashChange) {

        Remote.skipHashChange = false;
        return;

      }
      Remote.showMenu(globalThis.location.hash ? globalThis.location.hash.slice(1) : "main-menu");

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

  // Loading successful, remove error element
  document.querySelector("#load-error")?.remove();

};
