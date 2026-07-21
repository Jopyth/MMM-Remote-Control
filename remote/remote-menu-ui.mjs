import {MENU_SIDE_EFFECTS} from "./remote-menu-routing.mjs";
import {Remote} from "./remote.mjs";

/*
 * ============================================================================
 * Utilities
 * ============================================================================
 */

const MENU_TITLE_MAP = {
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

const ICON_CLASS_MAP = {
  "power-menu": "icon-power",
  "edit-menu": "icon-edit",
  "settings-menu": "icon-settings",
  "classes-menu": "icon-classes",
  "update-menu": "icon-update",
  "alert-menu": "icon-alert",
  "links-menu": "icon-links",
  "add-module-menu": "icon-add"
};

const EDIT_SLIDERS = [
  {"selector": "#brightness-slider", "type": "brightness", "action": "BRIGHTNESS"},
  {"selector": "#temp-slider", "type": "temp", "action": "TEMP"},
  {"selector": "#zoom-slider", "type": "zoom", "action": "ZOOM"}
];

const COLOR_PICKERS = [
  {"selector": "#background-color-picker", "action": "BACKGROUND_COLOR"},
  {"selector": "#font-color-picker", "action": "FONT_COLOR"}
];

/*
 * ============================================================================
 * Form & Input Listeners
 * ============================================================================
 */

/**
 * Registers form and input event listeners for notification, alert, search, and edit menus.
 * @param {object} remote - Remote object to extend
 */
function registerFormAndInputListeners (remote) {

  Object.assign(remote, {

    attachEditMenuListeners () {

      for (const {selector, type, action} of EDIT_SLIDERS) {

        const slider = document.querySelector(selector);
        slider.addEventListener(
          "change",
          () => { this.action(action, {"value": slider.value}); },
          {capture: false}
        );
        slider.addEventListener(
          "input",
          () => { this.updateSliderThumbColor(slider, type); },
          {capture: false}
        );
        this.updateSliderThumbColor(slider, type);

      }

      for (const {selector, action} of COLOR_PICKERS) {

        const picker = document.querySelector(selector);
        picker.addEventListener(
          "change",
          () => { this.action(action, {"value": picker.value}); },
          {capture: false}
        );

      }

    },

    attachSearchListeners () {

      const input = document.querySelector("#add-module-search"),
        deleteButton = document.querySelector("#delete-search-input");

      input.addEventListener(
        "input",
        () => {

          this.filterModules(input.value);
          deleteButton.classList.toggle(
            "hidden",
            input.value === ""
          );

        },
        {capture: false}
      );

      deleteButton.addEventListener(
        "click",
        () => {

          input.value = "";
          this.filterModules(input.value);
          deleteButton.classList.add("hidden");

        },
        {capture: false}
      );

    },

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

    saveFormState () {

      const notificationNameElement = document.querySelector("#notification-name"),
        notificationPayloadElement = document.querySelector("#notification-payload");
      if (notificationNameElement || notificationPayloadElement) {

        Remote.formState ??= {};
        Remote.formState.notificationName = notificationNameElement?.value ?? "";
        Remote.formState.notificationPayload = notificationPayloadElement?.value ?? "";

      }

      const alertForm = document.querySelector("#alert");
      if (alertForm) {

        Remote.formState ??= {};
        Remote.formState.alertType = alertForm.querySelector("[name='type']")?.value;
        Remote.formState.alertTitle = alertForm.querySelector("[name='title']")?.value;
        Remote.formState.alertMessage = alertForm.querySelector("[name='message']")?.value;
        Remote.formState.alertTimer = alertForm.querySelector("[name='timer']")?.value;

      }

    },

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

    }

  });

}

/*
 * ============================================================================
 * Menu Rendering
 * ============================================================================
 */

/**
 * Registers menu rendering methods for displaying static and dynamic menus.
 * @param {object} remote - Remote object to extend
 */
function registerMenuRendering (remote) {

  Object.assign(remote, {

    renderRouteState (route) {

      const main = document.querySelector(".main-content");
      if (!main) {

        return;

      }

      const isLoading = route.status === "loading-dynamic",
        iconClass = isLoading ? "fa-spinner fa-pulse" : "fa-exclamation-circle",
        text = isLoading
          ? (this.translate("LOADING") || "Loading...")
          : (this.translate("LOAD_ERROR") || "Menu could not be loaded.");

      main.replaceChildren();
      const section = document.createElement("section"),
        resultList = document.createElement("div"),
        routeState = document.createElement("div"),
        icon = document.createElement("span"),
        textElement = document.createElement("span");
      section.className = "menu-content";
      resultList.className = "result-list";
      routeState.className = "route-state";
      icon.className = `fa fa-fw ${iconClass}`;
      icon.setAttribute(
        "aria-hidden",
        "true"
      );
      textElement.className = "text";
      textElement.textContent = text;
      routeState.append(
        icon,
        textElement
      );
      resultList.append(routeState);
      section.append(resultList);
      main.append(section);
      main.scrollTop = 0;

      document.querySelector("#back-button")?.classList.toggle(
        "hidden",
        route.targetMenu === "main-menu"
      );

      this.currentMenu = route.targetMenu;
      this.currentRoute = route;
      this.updateHeaderTitle(route.resolvedMenu);

    },

    renderDynamicMenuContent (menuName, main) {

      const dynamicContent = this.findDynamicMenuData(menuName);
      if (!dynamicContent) {

        return;

      }
      const nav = document.createElement("nav");
      nav.className = "menu-nav";
      main.append(nav);
      const menuItems = dynamicContent.items ?? [];
      for (const item of menuItems) {

        this.createMenuElement(
          item,
          dynamicContent.id,
          nav,
          true
        );

      }

    },

    async applyMainMenuVisibilityRules () {

      try {

        const {"data": configData} = await this.loadList(
            "config-modules",
            "config"
          ),
          alertElement = document.querySelector("#alert-button");
        if (alertElement && configData.modules.every((m) => m.module !== "alert")) {

          alertElement.remove();

        }

        const moduleConfig = configData.modules.find((m) => m.module === "MMM-Remote-Control").config,
          classesButton = document.querySelector("#classes-button");
        if (classesButton && (!moduleConfig || !moduleConfig.classes)) {

          classesButton.remove();

        }
        const notificationButton = document.querySelector("#notification-button");
        if (notificationButton && moduleConfig && moduleConfig.showNotificationMenu === false) {

          notificationButton.remove();

        }

      } catch (error) {

        console.error(
          "Error loading config for main menu:",
          error
        );

      }

    },

    async showMenu (newMenu) {

      const route = this.resolveRoute(newMenu || "main-menu");

      if (route.status !== "ready") {

        this.saveFormState();
        this.renderRouteState(route);
        return;

      }

      await this.renderResolvedMenu(route.resolvedMenu);

    },

    async renderResolvedMenu (newMenu) {

      if (this.currentMenu === "settings-menu") {

        // Check for unsaved changes
        const changes = this.deletedModules.length + this.changedModules.length;
        if (changes > 0) {

          const wrapper = document.createElement("div");
          const text = document.createElement("span");
          text.textContent = this.translate("UNSAVED_CHANGES");
          wrapper.append(text);

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
              this.navigateToMenu(newMenu);

            }
          );
          wrapper.append(discard);

          this.setStatus(
            false,
            false,
            wrapper
          );

          this.skipHashChange = true;
          location.hash = this.currentMenu;

          this.currentRoute = this.buildCurrentRoute(this.currentMenu);
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

        this.renderDynamicMenuContent(
          newMenu,
          main
        );

      }

      // Show back button for all sub-menus, hide on root
      document.querySelector("#back-button")?.classList.toggle(
        "hidden",
        newMenu === "main-menu"
      );

      // Attach click handlers for buttons now in DOM
      this.loadButtons(this.buttons);

      await MENU_SIDE_EFFECTS[newMenu]?.call(this);

      this.setStatus("none");

      this.currentMenu = newMenu;
      this.currentRoute = this.buildCurrentRoute(newMenu);
      // Update header title based on the active menu
      this.updateHeaderTitle(newMenu);

      // Restore keyboard focus to first interactive element in the new menu
      main.querySelector(".button")?.focus({preventScroll: true});

    }

  });

}

/*
 * ============================================================================
 * Header & Navigation
 * ============================================================================
 */

/**
 * Registers header title and navigation event handling methods.
 * @param {object} remote - Remote object to extend
 */
function registerHeaderAndNavigation (remote) {

  Object.assign(remote, {

    getMenuTitleKey (menuName) {

      return MENU_TITLE_MAP[menuName];

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
        const iconCssClass = ICON_CLASS_MAP[key];
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

    setupNavigationEventHandlers () {

      if (this.areNavigationEventHandlersBound) {

        return;

      }

      const mainContent = document.querySelector(".main-content");
      if (!mainContent) {

        return;

      }

      mainContent.addEventListener("click", (event) => {

        const hash = event.target.closest("[data-hash]")?.dataset.hash;
        if (hash) {

          this.navigateToMenu(hash);

        }

      });
      mainContent.addEventListener("keydown", (event) => {

        if (!(event.key === "Enter" || event.key === " ")) {
          return;
        }


        const hash = event.target.closest("[data-hash]")?.dataset.hash;
        if (hash) {

          event.preventDefault();
          this.navigateToMenu(hash);

        }


      });

      this.areNavigationEventHandlersBound = true;

    },

    onTranslationsLoaded () {

      // Set back-button aria-label from translations (button is always in header)
      const backButton = document.querySelector("#back-button");
      if (backButton) {

        backButton.setAttribute(
          "aria-label",
          this.translate("BACK")
        );

      }

      // Delegated data-hash listeners are attached once to survive main.innerHTML replacements.
      this.setupNavigationEventHandlers();

      // Lazy render: showMenu handles HTML, listeners, data loading, and header title
      this.showMenu(this.getCurrentHashMenu());

    }

  });

}

/*
 * ============================================================================
 * Dynamic Menus
 * ============================================================================
 */

/**
 * Registers methods for managing dynamic menu creation, lookup, and removal.
 * @param {object} remote - Remote object to extend
 */
function registerDynamicMenus (remote) {

  Object.assign(remote, {

    findDynamicMenuData (menuName) {

      const menuId = menuName.replace(/-menu$/u, "");
      if (Object.hasOwn(this.dynamicMenus ?? {}, menuId)) {

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

      const dynamicMenus = Object.values(this.dynamicMenus ?? {});
      for (const menu of dynamicMenus) {

        const found = searchItems(menu.items);
        if (found) {

          return found;

        }

      }
      return null;

    },

    injectDynamicMenuButtons () {

      const alertButton = document.querySelector("#alert-button");
      if (!alertButton) {

        return;

      }

      // Re-create buttons for already-registered dynamic menus
      const dynamicMenus = Object.values(this.dynamicMenus ?? {});
      for (const menu of dynamicMenus) {

        this.createMenuElement(
          menu,
          "main",
          alertButton,
          true
        );

      }

      // Drain pending menus received before main menu was ever shown
      const pendingMenus = this.pendingDynamicMenus ?? [];
      for (const pending of pendingMenus) {

        this.dynamicMenus = {...this.dynamicMenus, [pending.id]: pending};
        this.createMenuElement(
          pending,
          "main",
          alertButton,
          true
        );

      }
      this.pendingDynamicMenus = [];

    },

    removeDynamicMenuButtons (node) {

      if (!node?.id) {

        return;

      }
      document.getElementById(`${node.id}-button`)?.remove();
      const nodeItems = node.items ?? [];
      for (const item of nodeItems) {

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

        const pendingMenus = this.pendingDynamicMenus ?? [],
          pendingMenusWithoutCurrent = pendingMenus.filter((menu) => menu.id !== content.id);
        this.pendingDynamicMenus = [...pendingMenusWithoutCurrent, content];
        this.dynamicMenus = {...this.dynamicMenus, [content.id]: content};

        const activeMenu = this.getCurrentHashMenu();
        if (activeMenu !== "main-menu" && this.findDynamicMenuData(activeMenu)) {

          this.showMenu(activeMenu);

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

      const alertButton = document.querySelector("#alert-button");
      this.createMenuElement(
        content,
        "main",
        alertButton,
        true
      );

    }

  });

}

/*
 * ============================================================================
 * Menu Element Builders
 * ============================================================================
 */

/**
 * Registers primitive element builder methods for creating individual menu component parts.
 * @param {object} remote - Remote object to extend
 */
function registerMenuElementBuilders (remote) {

  Object.assign(remote, {

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

          this.navigateToMenu(`${content.id}-menu`);

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

          this.action(content.action.toUpperCase(), {
            ...content.content,
            "payload": {
              ...content.content !== undefined && (typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload),
              "value": slide.value
            },
            "value": slide.value
          });

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

          this.action(content.action.toUpperCase(), {
            ...content.content,
            "payload": {
              ...content.content !== undefined && (typeof content.content.payload === "string" ? {string: content.content.payload} : content.content.payload),
              "value": input.value
            },
            "value": input.value
          });

        }
      );

      return input;

    },

    addItemClickHandler (item, content, menu) {

      item.dataset.type = "item";
      item.addEventListener(
        "click",
        () => {

          this.action(content.action.toUpperCase(), {
            "payload": {},
            ...content.content
          });

          if (menu === "classes" && content.action === "MANAGE_CLASSES") {

            setTimeout(
              () => {

                this.loadClasses();

              },
              1000
            );

          }

        }
      );

    }

  });

}

/*
 * ============================================================================
 * Menu Element Assembly
 * ============================================================================
 */

/**
 * Registers menu element assembly and DOM manipulation methods.
 * @param {object} remote - Remote object to extend
 */
function registerMenuElementAssembly (remote) {

  Object.assign(remote, {

    removeDynamicMenuButtons (node) {

      if (!node?.id) {

        return;

      }
      document.getElementById(`${node.id}-button`)?.remove();
      const nodeItems = node.items ?? [];
      for (const item of nodeItems) {

        this.removeDynamicMenuButtons(item);

      }

    },

    createMenuElement (content, menu, insertAfter, isVisible = true) {

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

      if (!isVisible) {

        item.classList.add("hidden");

      }

      if (insertAfter.tagName === "NAV" || insertAfter.tagName === "SECTION" || insertAfter.classList.contains("menu-element-container")) {

        insertAfter.append(item);

      } else {

        insertAfter.parentNode.insertBefore(
          item,
          insertAfter.nextSibling
        );

      }

      if ("items" in content && content.type !== "menu") {

        for (const index of content.items) {

          this.createMenuElement(
            index,
            content.id,
            nestedNav || item,
            isVisible
          );

        }

      }

      return item;

    }

  });

}

/*
 * ============================================================================
 * Main Registration Function
 * ============================================================================
 */

/**
 * Menu navigation and dynamic menu methods for MMM-Remote-Control.
 * Registers organized UI methods into Remote object.
 * @param {object} remote - Remote object to extend
 */
export function registerRemoteMenuUI (remote = Remote) {

  Object.assign(remote, {

    loadButtons (buttons) {

      for (const [key, button] of Object.entries(buttons)) {

        document.getElementById(key)?.addEventListener(
          "click",
          button,
          false
        );

      }

    }

  });

  registerFormAndInputListeners(remote);
  registerMenuRendering(remote);
  registerHeaderAndNavigation(remote);
  registerDynamicMenus(remote);
  registerMenuElementBuilders(remote);
  registerMenuElementAssembly(remote);

}
