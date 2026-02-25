import "./remote-utils.mjs";
import "./remote-socket.mjs";
import "./remote-modules.mjs";
import "./remote-config.mjs";
import "./remote-render.mjs";
import {Remote} from "./remote.mjs";

/**
 * Menu navigation and dynamic menu methods for MMM-Remote-Control.
 * Covers menu switching, header title, element setup, and API-driven menus.
 */
Object.assign(
  Remote,
  {

    loadButtons (buttons) {

      for (const key of Object.keys(buttons)) {

        document.getElementById(key)?.addEventListener(
          "click",
          buttons[key],
          false
        );

      }

    },

    /**
     * Attaches event listeners for the edit menu sliders and color pickers.
     * Called by showMenu() when the edit menu is rendered.
     */
    attachEditMenuListeners () {

      const slider = document.querySelector("#brightness-slider");
      slider.addEventListener(
        "change",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {"action": "BRIGHTNESS", "value": slider.value}
          );

        },
        false
      );
      slider.addEventListener(
        "input",
        () => {

          this.updateSliderThumbColor(
            slider,
            "brightness"
          );

        },
        false
      );
      this.updateSliderThumbColor(
        slider,
        "brightness"
      );

      const slider2 = document.querySelector("#temp-slider");
      slider2.addEventListener(
        "change",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {"action": "TEMP", "value": slider2.value}
          );

        },
        false
      );
      slider2.addEventListener(
        "input",
        () => {

          this.updateSliderThumbColor(
            slider2,
            "temp"
          );

        },
        false
      );
      this.updateSliderThumbColor(
        slider2,
        "temp"
      );

      const zoomSlider = document.querySelector("#zoom-slider");
      zoomSlider.addEventListener(
        "change",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {"action": "ZOOM", "value": zoomSlider.value}
          );

        },
        false
      );
      zoomSlider.addEventListener(
        "input",
        () => {

          this.updateSliderThumbColor(
            zoomSlider,
            "zoom"
          );

        },
        false
      );
      this.updateSliderThumbColor(
        zoomSlider,
        "zoom"
      );

      const bgColorPicker = document.querySelector("#background-color-picker");
      bgColorPicker.addEventListener(
        "change",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {"action": "BACKGROUND_COLOR", "value": bgColorPicker.value}
          );

        },
        false
      );

      const fontColorPicker = document.querySelector("#font-color-picker");
      fontColorPicker.addEventListener(
        "change",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {"action": "FONT_COLOR", "value": fontColorPicker.value}
          );

        },
        false
      );

    },

    /**
     * Attaches event listeners for the add-module search input.
     * Called by showMenu() when the add-module menu is rendered.
     */
    attachSearchListeners () {

      const input = document.querySelector("#add-module-search"),
        deleteButton = document.querySelector("#delete-search-input");

      input.addEventListener(
        "input",
        () => {

          this.filter(input.value);
          deleteButton.classList.toggle(
            "hidden",
            input.value === ""
          );

        },
        false
      );

      deleteButton.addEventListener(
        "click",
        () => {

          input.value = "";
          this.filter(input.value);
          deleteButton.classList.add("hidden");

        },
        false
      );

    },

    async showMenu (newMenu) {

      if (this.currentMenu === "settings-menu") {

        // Check for unsaved changes
        const changes = this.deletedModules.length + this.changedModules.length;
        if (changes > 0) {

          const wrapper = document.createElement("div");
          wrapper.innerHTML = `<span>${this.translate("UNSAVED_CHANGES")}</span>`;

          const ok = this.createSymbolText(
            "fa fa-check-circle",
            this.translate("OK"),
            () => {

              this.setStatus("none");

            }
          );
          wrapper.append(ok);

          const discard = this.createSymbolText(
            "fa fa-warning",
            this.translate("DISCARD"),
            () => {

              this.deletedModules = [];
              this.changedModules = [];
              globalThis.location.hash = newMenu;

            }
          );
          wrapper.append(discard);

          this.setStatus(
            false,
            false,
            wrapper
          );

          this.skipHashChange = true;
          globalThis.location.hash = this.currentMenu;

          return;

        }

      }

      // Save any open form data before clearing the DOM
      this.saveFormState();

      const main = document.querySelector(".main-content");
      if (!main) {

        return;

      }

      // Lazy render: only the active menu
      const html = this.renderMenu(newMenu);
      main.innerHTML = html;
      main.scrollTop = 0;

      // For dynamic menus not in the standard renderMenu() map
      if (!html) {

        const dynamicContent = this.findDynamicMenuData(newMenu);
        if (dynamicContent) {

          const nav = document.createElement("nav");
          nav.className = "menu-nav";
          main.append(nav);
          for (const item of dynamicContent.items ?? []) {

            this.createMenuElement(
              item,
              dynamicContent.id,
              nav,
              true
            );

          }

        }

      }

      // Show back button for all sub-menus, hide on root
      document.querySelector("#back-button")?.classList.toggle(
        "hidden",
        newMenu === "main-menu"
      );

      // Attach click handlers for buttons now in DOM
      this.loadButtons(this.buttons);

      // Menu-specific setup and data loading
      if (newMenu === "main-menu") {

        this.injectDynamicMenuButtons();

        try {

          const {"data": configData} = await this.loadList(
              "config-modules",
              "config"
            ),
            alertElement = document.querySelector("#alert-button");
          if (!configData.modules.some((m) => m.module === "alert") && alertElement) {

            alertElement.remove();

          }

          const moduleConfig = configData.modules.find((m) => m.module === "MMM-Remote-Control").config,
            classesButton = document.querySelector("#classes-button");
          if ((!moduleConfig || !moduleConfig.classes) && classesButton) {

            classesButton.remove();

          }
          const notificationButton = document.querySelector("#notification-button");
          if (moduleConfig && moduleConfig.showNotificationMenu === false && notificationButton) {

            notificationButton.remove();

          }

        } catch (error) {

          console.error(
            "Error loading config for main menu:",
            error
          );

        }

      } else {

        switch (newMenu) {

          case "edit-menu":

            this.attachEditMenuListeners();
            this.loadVisibleModules();
            this.loadBrightness();
            this.loadTemp();
            this.loadZoom();
            this.loadBackgroundColor();
            this.loadFontColor();
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


          case "add-module-menu":

            this.attachSearchListeners();
            this.loadModulesToAdd();
            break;


          case "notification-menu":

            this.setupNotificationForm();
            this.restoreFormState("notification-menu");
            break;


          case "alert-menu":

            this.restoreFormState("alert-menu");
            break;


        }

      }

      this.setStatus("none");

      this.currentMenu = newMenu;
      // Update header title based on the active menu
      this.updateHeaderTitle(newMenu);

      // Restore keyboard focus to first interactive element in the new menu
      main.querySelector(".button")?.focus({preventScroll: true});

    },

    /**
     * Saves the current form values to Remote.formState before the DOM is cleared.
     * Called by showMenu() on every menu transition.
     */
    saveFormState () {

      const notificationNameEl = document.querySelector("#notification-name"),
        notificationPayloadEl = document.querySelector("#notification-payload");
      if (notificationNameEl || notificationPayloadEl) {

        Remote.formState = Remote.formState ?? {};
        Remote.formState.notificationName = notificationNameEl?.value ?? "";
        Remote.formState.notificationPayload = notificationPayloadEl?.value ?? "";

      }

      const alertForm = document.querySelector("#alert");
      if (alertForm) {

        Remote.formState = Remote.formState ?? {};
        Remote.formState.alertType = alertForm.querySelector("[name='type']")?.value;
        Remote.formState.alertTitle = alertForm.querySelector("[name='title']")?.value;
        Remote.formState.alertMessage = alertForm.querySelector("[name='message']")?.value;
        Remote.formState.alertTimer = alertForm.querySelector("[name='timer']")?.value;

      }

    },

    /**
     * Restores form values from Remote.formState after a menu is rendered.
     * Overrides any values set by setupNotificationForm() (localStorage restore).
     * @param {string} menuName - The currently active menu name
     */
    restoreFormState (menuName) {

      if (!Remote.formState) {

        return;

      }

      if (menuName === "notification-menu") {

        const nameInput = document.querySelector("#notification-name"),
          payload = document.querySelector("#notification-payload");
        if (nameInput && Remote.formState.notificationName !== undefined) {

          nameInput.value = Remote.formState.notificationName;

        }
        if (payload && Remote.formState.notificationPayload !== undefined) {

          payload.value = Remote.formState.notificationPayload;
          payload.style.height = "auto";
          payload.style.height = `${payload.scrollHeight}px`;

        }
        Remote.updateNotificationUrl();

      } else if (menuName === "alert-menu") {

        const form = document.querySelector("#alert");
        if (form) {

          if (Remote.formState.alertType) {

            form.querySelector("[name='type']").value = Remote.formState.alertType;

          }
          if (Remote.formState.alertTitle !== undefined) {

            form.querySelector("[name='title']").value = Remote.formState.alertTitle;

          }
          if (Remote.formState.alertMessage !== undefined) {

            form.querySelector("[name='message']").value = Remote.formState.alertMessage;

          }
          if (Remote.formState.alertTimer !== undefined) {

            form.querySelector("[name='timer']").value = Remote.formState.alertTimer;

          }

        }

      }

    },

    /**
     * Re-creates buttons for all registered dynamic menus in the freshly rendered main menu.
     * Also drains any pending dynamic menus received before main-menu was first shown.
     * Called by showMenu() when the main-menu is rendered.
     */
    injectDynamicMenuButtons () {

      const alertBtn = document.querySelector("#alert-button");
      if (!alertBtn) {

        return;

      }

      // Re-create buttons for already-registered dynamic menus
      for (const menu of Object.values(this.dynamicMenus ?? {})) {

        this.createMenuElement(
          menu,
          "main",
          alertBtn,
          true
        );

      }

      // Drain pending menus received before main menu was ever shown
      for (const pending of (this.pendingDynamicMenus ?? [])) {

        this.dynamicMenus = {...this.dynamicMenus, [pending.id]: pending};
        this.createMenuElement(
          pending,
          "main",
          alertBtn,
          true
        );

      }
      this.pendingDynamicMenus = [];

    },

    /**
     * Searches dynamicMenus for the menu data matching a given menu name.
     * Traverses nested items to support multi-level dynamic menus.
     * @param {string} menuName - Menu identifier including "-menu" suffix
     * @returns {object|null} The matching menu content or null
     */
    findDynamicMenuData (menuName) {

      const menuId = menuName.replace(/-menu$/u, "");
      if (this.dynamicMenus?.[menuId]) {

        return this.dynamicMenus[menuId];

      }

      const searchItems = (items) => {

        if (!items) {

          return null;

        }
        for (const item of items) {

          if (item.id === menuId) {

            return item;

          }
          const found = searchItems(item.items);
          if (found) {

            return found;

          }

        }
        return null;

      };

      for (const menu of Object.values(this.dynamicMenus ?? {})) {

        const found = searchItems(menu.items);
        if (found) {

          return found;

        }

      }
      return null;

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
        "links-menu": "LINKS",
        "classes-menu": "CLASSES_MENU_NAME"
      };
      return menuTitleMap[menuName];

    },

    getMenuIcon (menuName) {

      const menuIconMap = {
        "main-menu": null,
        "power-menu": "fa-power-off",
        "edit-menu": "fa-television",
        "settings-menu": "fa-wrench",
        "add-module-menu": "fa-plus",
        "update-menu": "fa-toggle-up",
        "alert-menu": "fa-envelope-o",
        "links-menu": "fa-link",
        "classes-menu": "fa-object-group"
      };
      return menuIconMap[menuName];

    },

    updateHeaderTitle (menuName) {

      try {

        const headerTitleElement = document.querySelector(".header .header-title");
        if (!headerTitleElement) {

          return;

        }

        const hasTranslations = this.translations && Object.keys(this.translations).length > 0;
        if (!hasTranslations) {

          return;

        }

        const key = menuName || this.currentMenu || "main-menu",
          titleKey = this.getMenuTitleKey(key);
        let titleText = titleKey
          ? this.translate(titleKey)
          : null;

        // Special case for classes-menu: use button text if available
        if (!titleText && key === "classes-menu") {

          const classesButton = document.querySelector("#classes-button");
          titleText = classesButton?.querySelector(".text")?.textContent || this.translate("TITLE");

        }

        // For custom/dynamic menus, use button text
        if (!titleText && key.endsWith("-menu")) {

          const buttonId = key.replace(
              "-menu",
              "-button"
            ),
            button = document.getElementById(buttonId);
          titleText = button?.querySelector(".text")?.textContent;

        }

        if (titleText) {

          headerTitleElement.textContent = titleText;

        }

        // Update header icon via CSS class
        const iconClassMap = {
          "power-menu": "icon-power",
          "edit-menu": "icon-edit",
          "settings-menu": "icon-settings",
          "classes-menu": "icon-classes",
          "update-menu": "icon-update",
          "alert-menu": "icon-alert",
          "links-menu": "icon-links",
          "add-module-menu": "icon-add"
        };

        // Remove all icon classes
        headerTitleElement.classList.remove(
          "icon-power",
          "icon-edit",
          "icon-settings",
          "icon-classes",
          "icon-update",
          "icon-alert",
          "icon-links",
          "icon-add"
        );

        // Add icon class for current menu
        const iconCssClass = iconClassMap[key];
        if (iconCssClass) {

          headerTitleElement.classList.add(iconCssClass);

        }

      } catch (error) {

        console.warn(
          "Failed to update header title:",
          error
        );

      }

    },

    onTranslationsLoaded () {

      // Set back-button aria-label from translations (button is always in header)
      const backBtn = document.querySelector("#back-button");
      if (backBtn) {

        backBtn.setAttribute(
          "aria-label",
          this.translate("BACK")
        );

      }

      // Lazy render: showMenu handles HTML, listeners, data loading, and header title
      this.showMenu(globalThis.location.hash ? globalThis.location.hash.slice(1) : "main-menu");

    },

    /**
     * Sets up the notification form textarea auto-resize and restores saved values.
     * Called after renderMenus() ensures the form exists in the DOM.
     */
    setupNotificationForm () {

      const payloadTextarea = document.querySelector("#notification-payload");
      if (!payloadTextarea) {

        return;

      }

      const autoResize = () => {

        payloadTextarea.style.height = "auto";
        payloadTextarea.style.height = `${payloadTextarea.scrollHeight}px`;

      };

      payloadTextarea.addEventListener("input", autoResize);
      payloadTextarea.addEventListener("input", () => { this.updateNotificationUrl(); });

      const nameInput = document.querySelector("#notification-name");
      if (nameInput) {

        nameInput.addEventListener("input", () => { this.updateNotificationUrl(); });

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

      autoResize();
      this.updateNotificationUrl();

    },

    createMenuTypeElement (item, content, menu) {

      const mcmArrow = document.createElement("span");
      mcmArrow.className = "fa fa-fw fa-angle-right";
      mcmArrow.setAttribute(
        "aria-hidden",
        "true"
      );
      item.append(mcmArrow);
      item.dataset.parent = menu;
      item.dataset.type = "menu";
      item.addEventListener(
        "click",
        () => {

          globalThis.location.hash = `${content.id}-menu`;

        }
      );

      return null;

    },

    createSliderElement (item, content) {

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

      slide.addEventListener(
        "change",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {
              "action": content.action.toUpperCase(),
              ...content.content,
              "payload": {
                ...content.content === undefined
                  ? {}
                  : (typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload),
                "value": slide.value
              },
              "value": slide.value
            }
          );

        }
      );

      contain.append(slide);
      item.append(contain);

    },

    createInputElement (content, menu) {

      const input = document.createElement("input");
      input.id = `${content.id}-input`;
      input.className = `${menu}-menu medium`;
      input.type = "text";
      input.placeholder = content.text;

      input.addEventListener(
        "focusout",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {
              "action": content.action.toUpperCase(),
              ...content.content,
              "payload": {
                ...content.content === undefined
                  ? {}
                  : (typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload),
                "value": input.value
              },
              "value": input.value
            }
          );

        }
      );

      return input;

    },

    addItemClickHandler (item, content, menu) {

      item.dataset.type = "item";
      item.addEventListener(
        "click",
        () => {

          this.sendSocketNotification(
            "REMOTE_ACTION",
            {
              "action": content.action.toUpperCase(),
              "payload": {},
              ...content.content
            }
          );

          // Reload classes menu after executing class action to update status badges
          if (content.action === "MANAGE_CLASSES" && menu === "classes") {

            setTimeout(
              () => {

                this.loadClasses();

              },
              1000
            );

          }

        }
      );

    },

    createMenuElement (content, menu, insertAfter, visible = true) {

      if (!content) {

        return;

      }
      const item = document.createElement("div");
      item.id = `${content.id}-button`;
      item.className = `button ${menu}-menu`;

      if (content.icon) {

        const mcmIcon = document.createElement("span");
        mcmIcon.className = `fa fa-fw fa-${content.icon}`;
        mcmIcon.setAttribute(
          "aria-hidden",
          "true"
        );
        item.append(mcmIcon);

      }

      if (content.text) {

        const mcmText = document.createElement("span");
        mcmText.className = "text";
        mcmText.textContent = content.text;
        item.append(mcmText);

      }

      // Add status badge for Classes menu
      if (menu === "classes" && content.classData) {

        this.addClassStatusBadge(
          item,
          content.classData
        );

      }

      let nestedNav;
      switch (content.type) {

        case "menu":

          nestedNav = this.createMenuTypeElement(
            item,
            content,
            menu
          );
          break;


        case "slider":

          this.createSliderElement(
            item,
            content
          );
          break;


        case "input":

          return this.createInputElement(
            content,
            menu
          );


        default:

          if (content.action && content.content) {

            this.addItemClickHandler(
              item,
              content,
              menu
            );

          }


      }

      if (!visible) {

        item.classList.add("hidden");

      }

      /*
       * Insert element: if insertAfter is a container (nav/section), append to it
       * Otherwise insert after the specified element
       */
      if (insertAfter.tagName === "NAV" || insertAfter.tagName === "SECTION" || insertAfter.classList.contains("menu-element-container")) {

        insertAfter.append(item);

      } else {

        insertAfter.parentNode.insertBefore(
          item,
          insertAfter.nextSibling
        );

      }

      /*
       * Only render child items inline when this is NOT a sub-menu type.
       * Sub-menu items are loaded lazily via findDynamicMenuData when the menu is navigated to.
       */
      if ("items" in content && content.type !== "menu") {

        for (const index of content.items) {

          this.createMenuElement(
            index,
            content.id,
            nestedNav || item,
            visible
          );

        }

      }

      return item;

    },

    /**
     * Recursively removes DOM buttons created by createMenuElement for a dynamic menu node.
     * @param {object} node - The menu content node
     */
    removeDynamicMenuButtons (node) {

      if (!node?.id) {

        return;

      }
      document.getElementById(`${node.id}-button`)?.remove();
      for (const item of node.items ?? []) {

        this.removeDynamicMenuButtons(item);

      }

    },

    createDynamicMenu (content) {

      if (!content) {

        // Legacy no-arg call — no-op, pending draining now handled by injectDynamicMenuButtons
        return;

      }

      /*
       * If not currently on main-menu, the button can't be injected now.
       * Store for when main-menu is next rendered via showMenu → injectDynamicMenuButtons.
       */
      if (this.currentMenu !== "main-menu" || !document.querySelector("#alert-button")) {

        this.pendingDynamicMenus = [...(this.pendingDynamicMenus ?? []), content];

        /*
         * NOT added to dynamicMenus yet — injectDynamicMenuButtons will do that on next main-menu render.
         * If user is back on main-menu before the socket packet arrived: redirect away from stale hash.
         */
        if (globalThis.location.hash === `#${content.id}-menu`) {

          globalThis.location.hash = "main-menu";

        }
        return;

      }

      /*
       * Remove any previously injected DOM button for the same menu id (and nested children)
       * Must remove both the old registration and the new one's structure via the previously stored menu
       */
      const previousMenu = this.dynamicMenus?.[content.id];
      if (previousMenu) {

        this.removeDynamicMenuButtons(previousMenu);

      }
      this.removeDynamicMenuButtons(content);

      // Register and inject into the currently rendered main menu
      this.dynamicMenus = {...this.dynamicMenus, [content.id]: content};

      const alertBtn = document.querySelector("#alert-button");
      this.createMenuElement(
        content,
        "main",
        alertBtn,
        true
      );

    }

  }
);

// Auto-initialize when fully loaded in browser (all topic files merged into Remote)
if (globalThis.window !== undefined && document.querySelector("#load-error")) {

  Remote.init();

}
