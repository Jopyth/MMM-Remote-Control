
/**
 * Menu navigation and dynamic menu methods for MMM-Remote-Control.
 * Covers menu switching, header title, element setup, and API-driven menus.
 */
Object.assign(Remote, {

  loadButtons (buttons) {
    for (const key of Object.keys(buttons)) {
      document.getElementById(key).addEventListener("click", buttons[key], false);
    }
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
    this.loadBrightness();

    const slider2 = document.querySelector("#temp-slider");
    slider2.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "TEMP", value: slider2.value});
    }, false);
    slider2.addEventListener("input", () => {
      this.updateSliderThumbColor(slider2, "temp");
    }, false);
    this.updateSliderThumbColor(slider2, "temp");
    this.loadTemp();

    const zoomSlider = document.querySelector("#zoom-slider");
    zoomSlider.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "ZOOM", value: zoomSlider.value});
    }, false);
    zoomSlider.addEventListener("input", () => {
      this.updateSliderThumbColor(zoomSlider, "zoom");
    }, false);
    this.updateSliderThumbColor(zoomSlider, "zoom");
    this.loadZoom();

    const bgColorPicker = document.querySelector("#background-color-picker");
    bgColorPicker.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "BACKGROUND_COLOR", value: bgColorPicker.value});
    }, false);
    this.loadBackgroundColor();

    const fontColorPicker = document.querySelector("#font-color-picker");
    fontColorPicker.addEventListener("change", () => {
      this.sendSocketNotification("REMOTE_ACTION", {action: "FONT_COLOR", value: fontColorPicker.value});
    }, false);
    this.loadFontColor();

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
        wrapper.innerHTML = `<span>${this.translate("UNSAVED_CHANGES")}</span>`;

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

    }

    if (newMenu === "main-menu") {
      try {
        const {data: configData} = await this.loadList("config-modules", "config");
        const alertElement = document.querySelector("#alert-button");
        if (!configData.modules.some((m) => m.module === "alert") && alertElement) { alertElement.remove(); }

        const moduleConfig = configData.modules.find((m) => m.module === "MMM-Remote-Control").config;
        const classesButton = document.querySelector("#classes-button");
        if ((!moduleConfig || !moduleConfig.classes) && classesButton) { classesButton.remove(); }
        const notificationButton = document.querySelector("#notification-button");
        if (moduleConfig && moduleConfig.showNotificationMenu === false && notificationButton) { notificationButton.remove(); }
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

    if (newMenu === "notification-menu") {
      const textarea = document.querySelector("#notification-payload");
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
      Remote.updateNotificationUrl();
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

      // For custom/dynamic menus, use button text
      if (!titleText && key.endsWith("-menu")) {
        const buttonId = key.replace("-menu", "-button");
        const button = document.getElementById(buttonId);
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
      headerTitleElement.classList.remove("icon-power", "icon-edit", "icon-settings", "icon-classes", "icon-update", "icon-alert", "icon-links", "icon-add");

      // Add icon class for current menu
      const iconCssClass = iconClassMap[key];
      if (iconCssClass) {
        headerTitleElement.classList.add(iconCssClass);
      }
    } catch (error) {
      console.warn("Failed to update header title:", error);
    }
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

  createMenuTypeElement (item, content, menu) {
    const mcmArrow = document.createElement("span");
    mcmArrow.className = "fa fa-fw fa-angle-right";
    mcmArrow.setAttribute("aria-hidden", "true");
    item.append(mcmArrow);
    item.dataset.parent = menu;
    item.dataset.type = "menu";
    document.querySelector("#back-button")?.classList.add(`${content.id}-menu`);
    const menuContent = document.querySelector(".menu-content");
    if (menuContent) {
      menuContent.classList.add(`${content.id}-menu`);
    }
    item.addEventListener("click", () => {
      globalThis.location.hash = `${content.id}-menu`;
    });

    return menuContent;
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
  },

  createInputElement (content, menu) {
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
  },

  addItemClickHandler (item, content, menu) {
    item.dataset.type = "item";
    item.addEventListener("click", () => {
      this.sendSocketNotification("REMOTE_ACTION", {
        action: content.action.toUpperCase(),
        payload: {},
        ...content.content
      });

      // Reload classes menu after executing class action to update status badges
      if (content.action === "MANAGE_CLASSES" && menu === "classes") {
        setTimeout(() => {
          this.loadClasses();
        }, 1000);
      }
    });
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

    // Add status badge for Classes menu
    if (menu === "classes" && content.classData) {
      this.addClassStatusBadge(item, content.classData);
    }

    let nestedNav;
    switch (content.type) {
      case "menu":
        nestedNav = this.createMenuTypeElement(item, content, menu);
        break;
      case "slider":
        this.createSliderElement(item, content);
        break;
      case "input":
        return this.createInputElement(content, menu);
      default:
        if (content.action && content.content) {
          this.addItemClickHandler(item, content, menu);
        }
    }

    if (!globalThis.location.hash && menu !== "main" || globalThis.location.hash && globalThis.location.hash.slice(1) !== `${menu}-menu`) {
      item.classList.add("hidden");
    }

    /*
     * Insert element: if insertAfter is a container (nav/section), append to it
     * Otherwise insert after the specified element
     */
    if (insertAfter.tagName === "NAV" || insertAfter.tagName === "SECTION" || insertAfter.classList.contains("menu-element-container")) {
      insertAfter.append(item);
    } else {
      insertAfter.parentNode.insertBefore(item, insertAfter.nextSibling);
    }

    if ("items" in content) {
      for (const index of content.items) {
        this.createMenuElement(index, content.id, nestedNav || item);
      }
    }

    return item;
  },

  createDynamicMenu (content) {
    if (content) {
      const cleanup = (node) => {
        if (!node?.id) { return; }
        document.getElementById(`${node.id}-button`)?.remove();
        for (const element of document.querySelectorAll(`.${node.id}-menu`)) { element.remove(); }
        if (globalThis.location.hash === `#${node.id}-menu`) { globalThis.location.hash = "main-menu"; }
        document.querySelector("#back-button")?.classList.remove(`${node.id}-menu`);
        document.querySelector(".menu-content")?.classList.remove(`${node.id}-menu`);
        for (const item of node.items ?? []) { if (item?.type === "menu") { cleanup(item); } }
      };

      cleanup(this.dynamicMenus?.[content.id]);
      cleanup(content);
      this.dynamicMenus = {...this.dynamicMenus, [content.id]: content};
    }

    // Create button in main menu
    this.createMenuElement(content, "main", document.querySelector("#alert-button"));
  }

});

// Auto-initialize when fully loaded in browser (all topic files merged into Remote)
if (globalThis.window !== undefined && document.querySelector("#load-error")) {
  Remote.init();
}
