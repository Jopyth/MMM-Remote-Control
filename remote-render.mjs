import {Remote} from "./remote.mjs";

/**
 * Renders a simple navigation button.
 * @param {string} id - Element ID
 * @param {string} icon - Font Awesome icon class (e.g. "fa-power-off")
 * @param {string} text - Visible button text
 * @param {boolean} [hasArrow] - Whether to append a right-arrow chevron
 * @returns {string} HTML string for the button
 */
function navBtn (id, icon, text, hasArrow = false) {
  const arrow = hasArrow ? "<span class=\"fa fa-fw fa-angle-right\" aria-hidden=\"true\"></span>" : "";
  return `<div id="${id}" class="button" role="button" tabindex="0">
      <span class="fa fa-fw ${icon}" aria-hidden="true"></span>
      <span class="text">${text}</span>
      ${arrow}
    </div>`;
}

/**
 * Renders a stacked-icon navigation button (two overlapping Font Awesome icons).
 * @param {string} id - Element ID
 * @param {string} outerIcon - Font Awesome class for the outer/background icon
 * @param {string} innerIcon - Font Awesome class for the inner/foreground icon
 * @param {string} text - Visible button text
 * @param {boolean} [hasArrow] - Whether to append a right-arrow chevron
 * @returns {string} HTML string for the stacked button
 */
function stackBtn (id, outerIcon, innerIcon, text, hasArrow = false) {
  const arrow = hasArrow ? "<span class=\"fa fa-fw fa-angle-right\" aria-hidden=\"true\"></span>" : "";
  return `<div id="${id}" class="button" role="button" tabindex="0">
      <span class="stack fa-fw">
        <span class="fa fa-fw ${outerIcon} outer-label fa-stack-1x" aria-hidden="true"></span>
        <span class="fa fa-fw ${innerIcon} inner-monitor-label fa-stack-1x" aria-hidden="true"></span>
      </span>
      <span class="text">${text}</span>
      ${arrow}
    </div>`;
}

/**
 * Renders a "result list" container used by edit/classes/settings/update/add menus.
 * Each container has a loading, empty, and results div.
 * @param {string} id - ID prefix (e.g. "visible-modules" → "#visible-modules-container")
 * @param {string} loadingText - Translated "loading" label
 * @param {string} emptyText - Translated "no modules" label
 * @param {string} [dataParent] - Optional data-parent attribute value
 * @returns {string} HTML string for the result list container
 */
function resultList (id, loadingText, emptyText, dataParent = "") {
  const dataAttr = dataParent ? ` data-parent="${dataParent}"` : "";
  return `<div id="${id}-container" class="result-list"${dataAttr}>
        <div id="${id}-loading">
          <span class="fa fa-fw fa-spinner fa-pulse"></span>
          <span class="text">${loadingText}</span>
        </div>
        <div id="${id}-empty" class="hidden">
          <span class="fa fa-fw fa-exclamation-circle"></span>
          <span class="text">${emptyText}</span>
        </div>
        <div id="${id}-results" class="results small">
          <!-- elements are inserted here -->
        </div>
      </div>`;
}

/**
 * Renders an inline reset button for a slider or color picker.
 * @param {string} id - ID prefix (e.g. "brightness" → id="brightness-reset")
 * @param {string} label - aria-label for accessibility
 * @returns {string} HTML string for the reset button
 */
function resetBtn (id, label) {
  return `<span id="${id}-reset" class="inline-menu-element hidden button" role="button" aria-label="${label}" tabindex="0"><span class="fa fa-fw fa-undo" aria-hidden="true"></span></span>`;
}

Object.assign(Remote, {

  /**
   * Returns HTML for only the requested menu.
   * Used by showMenu() to lazy-render the active menu into <main>.
   * @param {string} menuName - The menu identifier (e.g. "main-menu")
   * @returns {string} HTML string for the menu
   */
  renderMenu (menuName) {
    const renderers = {
      "main-menu": () => this.renderMainMenu(),
      "power-menu": () => this.renderPowerMenu(),
      "edit-menu": () => this.renderEditMenu(),
      "settings-menu": () => this.renderSettingsMenu(),
      "classes-menu": () => this.renderClassesMenu(),
      "update-menu": () => this.renderUpdateMenu(),
      "alert-menu": () => this.renderAlertMenu(),
      "notification-menu": () => this.renderNotificationMenu(),
      "links-menu": () => this.renderLinksMenu(),
      "add-module-menu": () => this.renderAddModuleMenu()
    };
    const renderer = renderers[menuName];
    return renderer ? renderer() : "";
  },

  /**
   * Returns HTML for the main menu (navigation buttons only).
   * @returns {string} HTML string for the main menu nav
   */
  renderMainMenu () {
    const t = (key) => this.translate(key);
    return `<nav class="menu-nav">
        ${navBtn("power-button", "fa-power-off", t("SHUTDOWN_MENU_NAME"), true)}
        ${stackBtn("edit-button", "fa-television", "fa-pencil", t("EDIT_MENU_NAME"), true)}
        ${navBtn("settings-button", "fa-wrench", t("CONFIGURE_MENU_NAME"), true)}
        ${navBtn("classes-button", "fa-object-group", t("CLASSES_MENU_NAME"), true)}
        ${navBtn("update-button", "fa-download", t("UPDATE_MENU_NAME"), true)}
        ${navBtn("alert-button", "fa-envelope-o", t("ALERT_MENU_NAME"), true)}
        ${navBtn("notification-button", "fa-bell-o", t("NOTIFICATION_MENU_NAME"), true)}
        ${navBtn("links-button", "fa-link", t("LINKS"), true)}
        ${navBtn("mirror-link-button", "fa-external-link", t("VIEW_MIRROR"))}
      </nav>`;
  },

  /**
   * Returns HTML for the power menu (navigation buttons only).
   * @returns {string} HTML string for the power menu nav
   */
  renderPowerMenu () {
    const t = (key) => this.translate(key);
    return `<nav class="menu-nav">
        ${navBtn("shut-down-button", "fa-power-off", t("SHUTDOWN"))}
        ${navBtn("restart-button", "fa-refresh", t("REBOOT"))}
        ${navBtn("restart-mm-button", "fa-recycle", t("RESTARTMM"))}
        ${navBtn("refresh-mm-button", "fa-globe", t("REFRESHMM"))}
        ${stackBtn("monitor-on-button", "fa-television", "fa-check", t("MONITORON"))}
        ${stackBtn("monitor-off-button", "fa-television", "fa-close", t("MONITOROFF"))}
        ${navBtn("fullscreen-button", "fa-arrows-alt", t("FULLSCREEN"))}
        ${navBtn("minimize-button", "fa-window-minimize", t("MINIMIZE"))}
        ${navBtn("devtools-button", "fa-terminal", t("DEVTOOLS"))}
      </nav>`;
  },

  /**
   * Returns HTML for the edit menu (sliders, color pickers, action buttons, module list).
   * @returns {string} HTML string for the edit menu section
   */
  renderEditMenu () {
    const t = (key) => this.translate(key);
    return `<section class="menu-content edit-menu">
        ${this.renderEditMenuContent()}
        ${resultList("visible-modules", t("LOADING"), t("NO_MODULES_LOADED"))}
      </section>`;
  },

  /**
   * Returns HTML for the settings menu (warning, buttons, config module list).
   * @returns {string} HTML string for the settings menu section
   */
  renderSettingsMenu () {
    const t = (key) => this.translate(key);
    return `<section class="menu-content">
        ${this.renderSettingsMenuContent()}
        ${resultList("config-modules", t("LOADING"), t("NO_MODULES_LOADED"))}
      </section>`;
  },

  /**
   * Returns HTML for the classes menu (classes result list only).
   * @returns {string} HTML string for the classes menu section
   */
  renderClassesMenu () {
    const t = (key) => this.translate(key);
    return `<section class="menu-content">
        ${resultList("classes", t("LOADING"), t("NO_MODULES_LOADED"))}
      </section>`;
  },

  /**
   * Returns HTML for the update menu (update-module result list only).
   * @returns {string} HTML string for the update menu section
   */
  renderUpdateMenu () {
    const t = (key) => this.translate(key);
    return `<section class="menu-content">
        ${resultList("update-module", t("LOADING"), t("NO_MODULES_LOADED"))}
      </section>`;
  },

  /**
   * Returns HTML for the alert menu (nav buttons + alert form).
   * @returns {string} HTML string for the alert menu
   */
  renderAlertMenu () {
    const t = (key) => this.translate(key);
    return `<nav class="menu-nav">
        ${navBtn("send-alert-button", "fa-send-o", t("SENDALERT"))}
        ${navBtn("hide-alert-button", "fa-eye-slash", t("HIDEALERT"))}
      </nav>
      <section class="menu-content">
        ${this.renderAlertForm()}
      </section>`;
  },

  /**
   * Returns HTML for the notification menu (nav buttons + notification form).
   * @returns {string} HTML string for the notification menu
   */
  renderNotificationMenu () {
    const t = (key) => this.translate(key);
    return `<nav class="menu-nav">
        ${navBtn("send-notification-button", "fa-send-o", t("SEND_NOTIFICATION"))}
        ${navBtn("restore-notification-button", "fa-history", t("RESTORE"))}
      </nav>
      <section class="menu-content">
        ${this.renderNotificationForm()}
      </section>`;
  },

  /**
   * Returns HTML for the links menu (nav with links container only).
   * @returns {string} HTML string for the links menu nav
   */
  renderLinksMenu () {
    return `<nav class="menu-nav">
        <div id="links-container-nav">
          <!-- Links will be dynamically inserted here -->
        </div>
      </nav>`;
  },

  /**
   * Returns HTML for the add-module menu (search nav + result list).
   * @returns {string} HTML string for the add-module menu
   */
  renderAddModuleMenu () {
    const t = (key) => this.translate(key);
    return `<nav class="menu-nav">
        <div id="search-container" class="search-container">
          <span class="fa fa-fw fa-search" aria-hidden="true"></span>
          <input
            class="input-with-symbol search-input"
            id="add-module-search"
            type="text"
            placeholder="${t("SEARCH")}"
            aria-label="${t("SEARCH")}"
          />
          <span id="delete-search-input" class="fa fa-times-circle delete-button hidden"></span>
        </div>
      </nav>
      <section class="menu-content">
        ${resultList("add-module", t("LOADING"), t("NO_MODULES_LOADED"), "settings")}
      </section>`;
  },

  /**
   * Returns HTML for the notification form (notification-menu content area).
   * @returns {string} HTML string for the notification form
   */
  renderNotificationForm () {
    const t = (key) => this.translate(key);
    return `<form id="notification-form" action="" method="GET">
        <div class="xsmall">${t("FORM_NOTIFICATION_NAME")}</div>
        <input
          id="notification-name"
          type="text"
          class="medium"
          placeholder="${t("FORM_NOTIFICATION_NAME_PLACEHOLDER")}"
          autocomplete="off"
          autocapitalize="characters"
        />
        <div class="xsmall">${t("FORM_NOTIFICATION_PAYLOAD")}</div>
        <div>
          <textarea id="notification-payload" class="medium" placeholder="${t("FORM_NOTIFICATION_PAYLOAD_PLACEHOLDER")}">{



}</textarea>
        </div>
        <div class="xsmall">${t("FORM_NOTIFICATION_URL")}</div>
        <div class="notification-url-row">
          <span id="notification-url-method" class="notification-url-method"></span>
          <div id="notification-url" class="medium notification-url-display"></div>
          <div id="notification-url-copy" class="button" role="button" tabindex="0">
            <span class="fa fa-fw fa-copy" aria-hidden="true"></span>
          </div>
        </div>
      </form>`;
  },

  /**
   * Returns HTML for the alert form (alert-menu content area).
   * @returns {string} HTML string for the alert form
   */
  renderAlertForm () {
    const t = (key) => this.translate(key);
    return `<form id="alert" action="" method="GET">
        <input type="hidden" name="action" value="SHOW_ALERT" />
        <div class="xsmall">${t("FORM_TYPE")}</div>
        <select name="type">
          <option value="alert">${t("FORM_ALERT")}</option>
          <option value="notification">${t("FORM_NOTIFICATION")}</option>
        </select>
        <div class="xsmall">${t("FORM_TITLE")}</div>
        <input type="text" class="medium" placeholder="${t("FORM_TITLE_PLACEHOLDER")}" name="title" />
        <div class="xsmall">${t("FORM_MESSAGE")}</div>
        <div>
          <textarea class="medium" placeholder="${t("FORM_MESSAGE_PLACEHOLDER")}" name="message"></textarea>
        </div>
        <div class="xsmall">${t("FORM_SECONDS")}</div>
        <input type="number" name="timer" value="4" />
      </form>`;
  },

  /**
   * Returns HTML for the edit menu content area (sliders, color pickers, action buttons).
   * @returns {string} HTML string for edit menu controls
   */
  renderEditMenuContent () {
    const t = (key) => this.translate(key);

    return `<div class="menu-element-container">
        <div class="action-buttons-row">
          <div id="save-button" class="button" role="button" aria-label="${t("SAVE")}" tabindex="0">
            <span class="fa fa-fw fa-save" aria-hidden="true"></span>
            <span class="text">${t("SAVE")}</span>
          </div>
          <div id="show-all-button" class="button" role="button" aria-label="${t("SHOWALL")}" tabindex="0">
            <span class="fa fa-fw fa-toggle-on" aria-hidden="true"></span>
            <span class="text">${t("SHOWALL")}</span>
          </div>
          <div id="hide-all-button" class="button" role="button" aria-label="${t("HIDEALL")}" tabindex="0">
            <span class="fa fa-fw fa-toggle-off" aria-hidden="true"></span>
            <span class="text">${t("HIDEALL")}</span>
          </div>
        </div>
        <div class="one-line">
          <span class="fa fa-fw fa-sun-o" aria-hidden="true"></span>
          <div id="brightness-container" class="slider-container" data-label="Brightness">
            <input id="brightness-slider" type="range" min="0" max="100" step="5" value="100" class="slider" aria-label="${t("BRIGHTNESS")}" />
          </div>
          ${resetBtn("brightness", "Reset brightness")}
        </div>
        <div class="one-line">
          <span class="fa fa-fw fa-thermometer-three-quarters" aria-hidden="true"></span>
          <div id="temp-container" class="slider-container" data-label="Color Temperature">
            <input id="temp-slider" type="range" min="140" max="500" step="20" value="325" class="slider" aria-label="Color temperature" />
          </div>
          ${resetBtn("temp", "Reset color temperature")}
        </div>
        <div class="one-line">
          <span class="fa fa-fw fa-search-plus" aria-hidden="true"></span>
          <div id="zoom-container" class="slider-container" data-label="Zoom">
            <input id="zoom-slider" type="range" min="0" max="200" step="5" value="100" class="slider" aria-label="${t("ZOOM")}" />
          </div>
          ${resetBtn("zoom", "Reset zoom")}
        </div>
        <div class="one-line">
          <span class="fa fa-fw fa-adjust" aria-hidden="true"></span>
          <label for="background-color-picker" class="color-label">${t("BACKGROUND_COLOR")}</label>
          <input id="background-color-picker" type="color" value="#000000" class="color-picker" aria-label="${t("BACKGROUND_COLOR")}" />
          ${resetBtn("background-color", "Reset background color")}
        </div>
        <div class="one-line">
          <span class="fa fa-fw fa-font" aria-hidden="true"></span>
          <label for="font-color-picker" class="color-label">${t("FONT_COLOR")}</label>
          <input id="font-color-picker" type="color" value="#ffffff" class="color-picker" aria-label="${t("FONT_COLOR")}" />
          ${resetBtn("font-color", "Reset font color")}
        </div>
      </div>`;
  },

  /**
   * Returns HTML for the settings menu content area (warning, action buttons).
   * @returns {string} HTML string for settings menu header controls
   */
  renderSettingsMenuContent () {
    const t = (key) => this.translate(key);
    return `<div id="settings-warning" class="settings-warning">
        <span class="fa fa-fw fa-exclamation-triangle" aria-hidden="true"></span>
        <span>${t("EXPERIMENTAL")}</span>
      </div>
      <div class="action-buttons-row">
        <div id="save-config" class="button">
          <span class="fa fa-fw fa-save" aria-hidden="true"></span>
          <span class="text">${t("SAVE")}</span>
        </div>
        <div id="restore-config" class="button" aria-label="${t("RESTORE")}">
          <span class="fa fa-fw fa-undo" aria-hidden="true"></span>
          <span class="text">${t("RESTORE")}</span>
        </div>
        <div id="add-module" class="button">
          <span class="fa fa-fw fa-plus" aria-hidden="true"></span>
          <span class="text">${t("ADD_MODULE")}</span>
        </div>
      </div>`;
  }

});
