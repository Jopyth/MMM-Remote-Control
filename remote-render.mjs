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
 * @param {string} menuClass - CSS class controlling visibility (e.g. "edit-menu")
 * @param {string} loadingText - Translated "loading" label
 * @param {string} emptyText - Translated "no modules" label
 * @param {string} [dataParent] - Optional data-parent attribute value
 * @returns {string} HTML string for the result list container
 */
function resultList (id, menuClass, loadingText, emptyText, dataParent = "") {
  const dataAttr = dataParent ? ` data-parent="${dataParent}"` : "";
  return `<div id="${id}-container" class="result-list menu-element hidden ${menuClass}"${dataAttr}>
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
  return `<span id="${id}-reset" class="inline-menu-element hidden button edit-menu" role="button" aria-label="${label}" tabindex="0"><span class="fa fa-fw fa-undo" aria-hidden="true"></span></span>`;
}

Object.assign(Remote, {

  /**
   * Renders all menu navigation elements and menu content section into the DOM.
   * Must be called after translations are available (from onTranslationsLoaded).
   * Updates header title and back-button aria-label as well.
   */
  renderMenus () {
    const main = document.querySelector(".main-content");
    if (!main) {
      return;
    }

    main.innerHTML = `${this.renderNavMenus()}<section class="menu-content">${this.renderMenuContent()}</section>`;

    const headerTitle = document.querySelector(".header-title");
    if (headerTitle) {
      headerTitle.textContent = this.translate("TITLE");
    }

    const backBtn = document.querySelector("#back-button");
    if (backBtn) {
      backBtn.setAttribute("aria-label", this.translate("BACK"));
    }
  },

  /**
   * Returns HTML for all navigation menu `<nav>` elements.
   * @returns {string} Combined HTML string for all nav menus
   */
  renderNavMenus () {
    const t = (key) => this.translate(key);
    return `
      <nav class="menu-nav menu-element hidden main-menu">
        ${navBtn("power-button", "fa-power-off", t("SHUTDOWN_MENU_NAME"), true)}
        ${stackBtn("edit-button", "fa-television", "fa-pencil", t("EDIT_MENU_NAME"), true)}
        ${navBtn("settings-button", "fa-wrench", t("CONFIGURE_MENU_NAME"), true)}
        ${navBtn("classes-button", "fa-object-group", t("CLASSES_MENU_NAME"), true)}
        ${navBtn("update-button", "fa-download", t("UPDATE_MENU_NAME"), true)}
        ${navBtn("alert-button", "fa-envelope-o", t("ALERT_MENU_NAME"), true)}
        ${navBtn("notification-button", "fa-bell-o", t("NOTIFICATION_MENU_NAME"), true)}
        ${navBtn("links-button", "fa-link", t("LINKS"), true)}
        ${navBtn("mirror-link-button", "fa-external-link", t("VIEW_MIRROR"))}
      </nav>
      <nav class="menu-nav menu-element hidden power-menu">
        ${navBtn("shut-down-button", "fa-power-off", t("SHUTDOWN"))}
        ${navBtn("restart-button", "fa-refresh", t("REBOOT"))}
        ${navBtn("restart-mm-button", "fa-recycle", t("RESTARTMM"))}
        ${navBtn("refresh-mm-button", "fa-globe", t("REFRESHMM"))}
        ${stackBtn("monitor-on-button", "fa-television", "fa-check", t("MONITORON"))}
        ${stackBtn("monitor-off-button", "fa-television", "fa-close", t("MONITOROFF"))}
        ${navBtn("fullscreen-button", "fa-arrows-alt", t("FULLSCREEN"))}
        ${navBtn("minimize-button", "fa-window-minimize", t("MINIMIZE"))}
        ${navBtn("devtools-button", "fa-terminal", t("DEVTOOLS"))}
      </nav>
      <nav class="menu-nav menu-element hidden alert-menu">
        ${navBtn("send-alert-button", "fa-send-o", t("SENDALERT"))}
        ${navBtn("hide-alert-button", "fa-eye-slash", t("HIDEALERT"))}
      </nav>
      <nav class="menu-nav menu-element hidden notification-menu">
        ${navBtn("send-notification-button", "fa-send-o", t("SEND_NOTIFICATION"))}
        ${navBtn("restore-notification-button", "fa-history", t("RESTORE"))}
      </nav>
      <nav class="menu-nav menu-element hidden links-menu">
        <div id="links-container-nav">
          <!-- Links will be dynamically inserted here -->
        </div>
      </nav>
      <nav class="menu-nav menu-element hidden add-module-menu">
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
      </nav>`;
  },

  /**
   * Returns HTML for the `<section class="menu-content">` inner content.
   * Covers notification form, alert form, edit controls, and all result-list containers.
   * @returns {string} Combined HTML string for all menu content blocks
   */
  renderMenuContent () {
    return `
      ${this.renderNotificationForm()}
      ${this.renderAlertForm()}
      ${this.renderEditMenuContent()}
      ${resultList("visible-modules", "edit-menu", this.translate("LOADING"), this.translate("NO_MODULES_LOADED"))}
      ${resultList("classes", "classes-menu", this.translate("LOADING"), this.translate("NO_MODULES_LOADED"))}
      ${this.renderSettingsMenuContent()}
      ${resultList("config-modules", "settings-menu", this.translate("LOADING"), this.translate("NO_MODULES_LOADED"))}
      ${resultList("add-module", "add-module-menu", this.translate("LOADING"), this.translate("NO_MODULES_LOADED"), "settings")}
      ${resultList("update-module", "update-menu", this.translate("LOADING"), this.translate("NO_MODULES_LOADED"))}`;
  },

  /**
   * Returns HTML for the notification form (notification-menu content area).
   * @returns {string} HTML string for the notification form
   */
  renderNotificationForm () {
    const t = (key) => this.translate(key);
    return `<form id="notification-form" action="" method="GET" class="menu-element hidden notification-menu">
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
    return `<form id="alert" action="" method="GET" class="menu-element hidden alert-menu">
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
    const me = "menu-element hidden edit-menu";

    return `<div class="menu-element-container ${me}">
        <div class="action-buttons-row">
          <div id="save-button" class="${me} button" role="button" aria-label="${t("SAVE")}" tabindex="0">
            <span class="fa fa-fw fa-save" aria-hidden="true"></span>
            <span class="text">${t("SAVE")}</span>
          </div>
          <div id="show-all-button" class="${me} button" role="button" aria-label="${t("SHOWALL")}" tabindex="0">
            <span class="fa fa-fw fa-toggle-on" aria-hidden="true"></span>
            <span class="text">${t("SHOWALL")}</span>
          </div>
          <div id="hide-all-button" class="${me} button" role="button" aria-label="${t("HIDEALL")}" tabindex="0">
            <span class="fa fa-fw fa-toggle-off" aria-hidden="true"></span>
            <span class="text">${t("HIDEALL")}</span>
          </div>
        </div>
        <div class="${me} one-line">
          <span class="fa fa-fw fa-sun-o" aria-hidden="true"></span>
          <div id="brightness-container" class="slider-container ${me}" data-label="Brightness">
            <input id="brightness-slider" type="range" min="0" max="100" step="5" value="100" class="slider" aria-label="${t("BRIGHTNESS")}" />
          </div>
          ${resetBtn("brightness", "Reset brightness")}
        </div>
        <div class="${me} one-line">
          <span class="fa fa-fw fa-thermometer-three-quarters" aria-hidden="true"></span>
          <div id="temp-container" class="slider-container ${me}" data-label="Color Temperature">
            <input id="temp-slider" type="range" min="140" max="500" step="20" value="325" class="slider" aria-label="Color temperature" />
          </div>
          ${resetBtn("temp", "Reset color temperature")}
        </div>
        <div class="${me} one-line">
          <span class="fa fa-fw fa-search-plus" aria-hidden="true"></span>
          <div id="zoom-container" class="slider-container ${me}" data-label="Zoom">
            <input id="zoom-slider" type="range" min="0" max="200" step="5" value="100" class="slider" aria-label="${t("ZOOM")}" />
          </div>
          ${resetBtn("zoom", "Reset zoom")}
        </div>
        <div class="${me} one-line">
          <span class="fa fa-fw fa-adjust" aria-hidden="true"></span>
          <label for="background-color-picker" class="color-label">${t("BACKGROUND_COLOR")}</label>
          <input id="background-color-picker" type="color" value="#000000" class="color-picker ${me}" aria-label="${t("BACKGROUND_COLOR")}" />
          ${resetBtn("background-color", "Reset background color")}
        </div>
        <div class="${me} one-line">
          <span class="fa fa-fw fa-font" aria-hidden="true"></span>
          <label for="font-color-picker" class="color-label">${t("FONT_COLOR")}</label>
          <input id="font-color-picker" type="color" value="#ffffff" class="color-picker ${me}" aria-label="${t("FONT_COLOR")}" />
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
    const me = "menu-element hidden settings-menu";
    return `<div id="settings-warning" class="${me} settings-warning">
        <span class="fa fa-fw fa-exclamation-triangle" aria-hidden="true"></span>
        <span>${t("EXPERIMENTAL")}</span>
      </div>
      <div class="action-buttons-row ${me}">
        <div id="save-config" class="${me} button">
          <span class="fa fa-fw fa-save" aria-hidden="true"></span>
          <span class="text">${t("SAVE")}</span>
        </div>
        <div id="restore-config" class="${me} button" aria-label="${t("RESTORE")}">
          <span class="fa fa-fw fa-undo" aria-hidden="true"></span>
          <span class="text">${t("RESTORE")}</span>
        </div>
        <div id="add-module" class="${me} button">
          <span class="fa fa-fw fa-plus" aria-hidden="true"></span>
          <span class="text">${t("ADD_MODULE")}</span>
        </div>
      </div>`;
  }

});
