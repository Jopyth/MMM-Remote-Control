import {Remote} from "./remote.mjs";

export const STATIC_MENU_NAMES = new Set([
  "main-menu",
  "power-menu",
  "edit-menu",
  "settings-menu",
  "classes-menu",
  "update-menu",
  "alert-menu",
  "notification-menu",
  "links-menu",
  "add-module-menu"
]);

export const MENU_SIDE_EFFECTS = {
  async "main-menu" () {

    this.injectDynamicMenuButtons();
    await this.applyMainMenuVisibilityRules();

  },
  "edit-menu" () {

    this.attachEditMenuListeners();
    this.loadVisibleModules();
    this.loadSettings();

  },
  "settings-menu" () {

    this.loadConfigModules();

  },
  "classes-menu" () {

    this.loadClasses();

  },
  "update-menu" () {

    this.attachUpdateFilterListener();
    this.loadModulesToUpdate();

  },
  "links-menu" () {

    this.loadLinks();

  },
  "add-module-menu" () {

    this.attachSearchListeners();
    this.loadModulesToAdd();

  },
  "notification-menu" () {

    this.setupNotificationForm();
    this.restoreFormState("notification-menu");

  },
  "alert-menu" () {

    this.restoreFormState("alert-menu");

  }
};

/**
 * Registers routing helpers and menu side effects on the Remote object.
 * @param {object} remote - Remote object to extend
 */
export function registerRemoteMenuRouting (remote = Remote) {

  Object.assign(remote, {
    normalizeMenuName (menuName = "main-menu") {

      return menuName.startsWith("#")
        ? menuName.slice(1)
        : menuName;

    },

    buildCurrentRoute (menuName) {

      return {
        "targetMenu": menuName,
        "resolvedMenu": menuName,
        "status": "ready"
      };

    },

    getCurrentHashMenu () {

      return this.normalizeMenuName(location.hash || "main-menu");

    },

    navigateToMenu (menuName, options = {}) {

      const normalizedMenu = this.normalizeMenuName(menuName),
        currentHashMenu = this.getCurrentHashMenu(),
        shouldUpdateHash = options.updateHash !== false;
      if (!shouldUpdateHash || currentHashMenu === normalizedMenu) {

        return this.showMenu(normalizedMenu);

      }

      if (options.suppressHashChangeHandler === true) {

        this.skipHashChange = true;

      }
      location.hash = normalizedMenu;

    },

    handleHashChange () {

      if (this.skipHashChange) {

        this.skipHashChange = false;
        return;

      }
      this.showMenu(this.getCurrentHashMenu());

    },

    resolveRoute (menuName = "main-menu") {

      const targetMenu = menuName,
        isKnownMenu = STATIC_MENU_NAMES.has(targetMenu) || Boolean(this.findDynamicMenuData(targetMenu));
      if (isKnownMenu) {

        return {
          "targetMenu": targetMenu,
          "resolvedMenu": targetMenu,
          "status": "ready"
        };

      }
      if (targetMenu.endsWith("-menu")) {

        return {
          "targetMenu": targetMenu,
          "resolvedMenu": "main-menu",
          "status": "loading-dynamic"
        };

      }

      return {
        "targetMenu": targetMenu,
        "resolvedMenu": "main-menu",
        "status": "not-found"
      };

    }
  });

}
