const {test, describe, before} = require("node:test");
const assert = require("node:assert/strict");

describe("remote.js DOM smoke tests", () => {
  let Remote;

  before(async () => {
    const {setupRemote} = await import("./setup.mjs");
    Remote = await setupRemote();
  });

  test("Remote object is defined with expected structure", () => {
    assert.ok(Remote, "Remote object should exist");
    assert.equal(Remote.name, "MMM-Remote-Control");
    assert.ok(Array.isArray(Remote.types));
    assert.ok(Array.isArray(Remote.validPositions));
  });

  test("Remote has expected configuration properties", () => {
    assert.equal(typeof Remote.currentMenu, "string");
    assert.equal(Remote.currentMenu, "main-menu");
    assert.equal(Remote.autoHideDelay, 2000);
    assert.equal(Remote.autoHideDelayError, 30 * 1000);
    assert.equal(Remote.autoHideDelayInfo, 30 * 1000);
  });

  test("validPositions contains expected MagicMirror positions", () => {
    const expectedPositions = [
      "top_left",
      "top_center",
      "top_right",
      "middle_center",
      "bottom_left",
      "bottom_center",
      "bottom_right"
    ];

    for (const pos of expectedPositions) {
      assert.ok(
        Remote.validPositions.includes(pos),
        `validPositions should include ${pos}`
      );
    }
  });

  test("types array contains JavaScript type names", () => {
    const expected = ["string", "number", "boolean", "array", "object", "null", "undefined"];
    assert.deepStrictEqual([...Remote.types], expected);
  });

  test("values array matches types array structure", () => {
    assert.equal(Remote.values.length, Remote.types.length);
    assert.equal(typeof Remote.values[0], "string"); // string default
    assert.equal(typeof Remote.values[1], "number"); // number default
    assert.equal(typeof Remote.values[2], "boolean"); // boolean default
  });

  test("socket() creates and returns MMSocket instance", () => {
    const socket = Remote.socket();
    assert.ok(socket, "socket() should return an instance");
    assert.equal(socket.name, "MMM-Remote-Control");
    assert.equal(typeof socket.setNotificationCallback, "function");
  });

  test("socket() returns same instance on subsequent calls (singleton)", () => {
    const socket1 = Remote.socket();
    const socket2 = Remote.socket();
    assert.strictEqual(socket1, socket2, "Should return same socket instance");
  });

  test("sendSocketNotification calls socket.sendNotification", () => {
    let capturedNotification = null;
    let capturedPayload = null;

    Remote._socket = {
      sendNotification: (notification, payload) => {
        capturedNotification = notification;
        capturedPayload = payload;
      },
      setNotificationCallback: () => {}
    };

    Remote.sendSocketNotification("TEST_ACTION", {data: "test"});

    assert.equal(capturedNotification, "TEST_ACTION");
    assert.deepEqual(capturedPayload, {data: "test"});
  });

  test("socketNotificationReceived handles REMOTE_ACTION_RESULT", () => {
    // Just verify it doesn't throw with valid payload structure
    assert.doesNotThrow(() => {
      Remote.socketNotificationReceived("REMOTE_ACTION_RESULT", {
        action: "UNKNOWN",
        query: {data: "test"},
        data: {}
      });
    });
  });

  test("createDynamicMenu replaces old nested menu entries", () => {
    document.body.innerHTML = `
      <div id="back-button"></div>
      <section class="menu-content"></section>
      <div id="alert-button"></div>
    `;

    const guessedMenu = {
      id: "module-control",
      type: "menu",
      text: "Module Controls",
      icon: "window-restore",
      items: [
        {
          id: "mc-pages",
          type: "menu",
          text: "MMM-pages",
          icon: "bars",
          items: [{id: "mc-pages-pagechanged", type: "item", action: "NOTIFICATION", content: {notification: "PAGE_CHANGED"}}]
        }
      ]
    };

    const explicitMenu = {
      id: "module-control",
      type: "menu",
      text: "Module Controls",
      icon: "window-restore",
      items: [
        {
          id: "mc-pages",
          type: "menu",
          text: "MMM-pages",
          icon: "bars",
          items: [{id: "mc-pages-next", type: "item", action: "NOTIFICATION", content: {notification: "PAGE_INCREMENT"}}]
        }
      ]
    };

    Remote.createDynamicMenu(guessedMenu);
    Remote.createDynamicMenu(explicitMenu);

    // Top-level menu button is present in DOM
    assert.ok(document.querySelector("#module-control-button"));
    // Nested items are NOT pre-rendered (lazy rendering: loaded on navigation)
    assert.equal(document.querySelector("#mc-pages-button"), null);
    assert.equal(document.querySelector("#mc-pages-pagechanged-button"), null);
    assert.equal(document.querySelector("#mc-pages-next-button"), null);
    // Data structure holds the latest (explicit) menu content
    assert.equal(Remote.dynamicMenus["module-control"].items[0].items[0].id, "mc-pages-next");
  });

  test("createDynamicMenu re-renders active dynamic submenu hash", () => {
    document.body.replaceChildren();

    const originalCurrentMenu = Remote.currentMenu,
      originalPendingMenus = Remote.pendingDynamicMenus,
      originalDynamicMenus = Remote.dynamicMenus,
      originalShowMenu = Remote.showMenu,
      originalHash = location.hash;

    let renderedMenu;
    Remote.currentMenu = "mc-pages-menu";
    Remote.pendingDynamicMenus = [];
    Remote.dynamicMenus = {};
    Remote.showMenu = (menuName) => {
      renderedMenu = menuName;
    };
    location.hash = "#mc-pages-menu";

    const moduleControlMenu = {
      id: "module-control",
      type: "menu",
      text: "Module Controls",
      icon: "window-restore",
      items: [
        {
          id: "mc-pages",
          type: "menu",
          text: "MMM-pages",
          icon: "bars",
          items: [{id: "mc-pages-next", type: "item", action: "NOTIFICATION", content: {notification: "PAGE_INCREMENT"}}]
        }
      ]
    };

    try {
      Remote.createDynamicMenu(moduleControlMenu);

      assert.equal(renderedMenu, "mc-pages-menu");
      assert.equal(Remote.dynamicMenus["module-control"].id, "module-control");
      assert.equal(Remote.pendingDynamicMenus.length, 1);
      assert.equal(location.hash, "#mc-pages-menu");
    } finally {
      Remote.currentMenu = originalCurrentMenu;
      Remote.pendingDynamicMenus = originalPendingMenus;
      Remote.dynamicMenus = originalDynamicMenus;
      Remote.showMenu = originalShowMenu;
      location.hash = originalHash;
    }
  });

  test("showMenu renders loading state for unresolved dynamic route", async () => {
    document.body.innerHTML = `
      <header class="header"><span class="header-title"></span></header>
      <div id="back-button" class="hidden"></div>
      <main class="main-content"></main>
    `;

    const originalDynamicMenus = Remote.dynamicMenus,
      originalPendingMenus = Remote.pendingDynamicMenus,
      originalTranslations = Remote.translations,
      originalCurrentMenu = Remote.currentMenu;

    Remote.dynamicMenus = {};
    Remote.pendingDynamicMenus = [];
    Remote.translations = {"LOADING": "Loading"};
    Remote.currentMenu = "main-menu";

    try {
      await Remote.showMenu("mc-pages-menu");

      assert.equal(Remote.currentRoute.status, "loading-dynamic");
      assert.equal(Remote.currentRoute.targetMenu, "mc-pages-menu");
      assert.equal(Remote.currentMenu, "mc-pages-menu");
      assert.ok(document.querySelector(".main-content .route-state"));
      assert.equal(document.querySelector("#back-button").classList.contains("hidden"), false);
    } finally {
      Remote.dynamicMenus = originalDynamicMenus;
      Remote.pendingDynamicMenus = originalPendingMenus;
      Remote.translations = originalTranslations;
      Remote.currentMenu = originalCurrentMenu;
    }
  });

  test("showMenu renders not-found state for invalid route", async () => {
    document.body.innerHTML = `
      <header class="header"><span class="header-title"></span></header>
      <div id="back-button" class="hidden"></div>
      <main class="main-content"></main>
    `;

    const originalTranslations = Remote.translations;
    Remote.translations = {"LOAD_ERROR": "Load error"};

    try {
      await Remote.showMenu("invalid-route");

      assert.equal(Remote.currentRoute.status, "not-found");
      assert.ok(document.querySelector(".main-content .route-state"));
    } finally {
      Remote.translations = originalTranslations;
    }
  });

  test("navigateToMenu renders immediately when target hash is already active", async () => {
    const originalShowMenu = Remote.showMenu,
      originalHash = location.hash;

    let renderedMenu;
    Remote.showMenu = async (menuName) => {
      renderedMenu = menuName;
    };
    location.hash = "#main-menu";

    try {
      await Remote.navigateToMenu("main-menu");

      assert.equal(renderedMenu, "main-menu");
      assert.equal(location.hash, "#main-menu");
    } finally {
      Remote.showMenu = originalShowMenu;
      location.hash = originalHash;
    }
  });

  test("navigateToMenu can suppress hashchange handling", () => {
    const originalSkipHashChange = Remote.skipHashChange,
      originalHash = location.hash;

    Remote.skipHashChange = false;

    try {
      Remote.navigateToMenu(
        "power-menu",
        {"suppressHashChangeHandler": true}
      );

      assert.equal(Remote.skipHashChange, true);
      assert.equal(Remote.getCurrentHashMenu(), "power-menu");
    } finally {
      Remote.skipHashChange = originalSkipHashChange;
      location.hash = originalHash;
    }
  });

  test("handleHashChange ignores one suppressed hashchange event", () => {
    const originalSkipHashChange = Remote.skipHashChange,
      originalShowMenu = Remote.showMenu;

    let isShowMenuCalled = false;
    Remote.skipHashChange = true;
    Remote.showMenu = () => {
      isShowMenuCalled = true;
    };

    try {
      Remote.handleHashChange();

      assert.equal(isShowMenuCalled, false);
      assert.equal(Remote.skipHashChange, false);
    } finally {
      Remote.skipHashChange = originalSkipHashChange;
      Remote.showMenu = originalShowMenu;
    }
  });

  test("handleHashChange routes to current hash menu", () => {
    const originalShowMenu = Remote.showMenu,
      originalHash = location.hash,
      originalSkipHashChange = Remote.skipHashChange;

    let routedMenu;
    Remote.skipHashChange = false;
    Remote.showMenu = (menuName) => {
      routedMenu = menuName;
    };
    location.hash = "#update-menu";

    try {
      Remote.handleHashChange();

      assert.equal(routedMenu, "update-menu");
    } finally {
      Remote.showMenu = originalShowMenu;
      location.hash = originalHash;
      Remote.skipHashChange = originalSkipHashChange;
    }
  });

  test("onTranslationsLoaded binds delegated navigation handlers only once", () => {
    document.body.innerHTML = `
      <div id="back-button"></div>
      <main class="main-content">
        <div id="dynamic-button" data-hash="power-menu"><span>Open</span></div>
      </main>
    `;

    const originalNavigateToMenu = Remote.navigateToMenu,
      originalShowMenu = Remote.showMenu,
      originalBoundFlag = Remote.areNavigationEventHandlersBound,
      originalTranslations = Remote.translations;

    let navigateCalls = 0;
    Remote.translations = {"BACK": "Back"};
    Remote.areNavigationEventHandlersBound = false;
    Remote.navigateToMenu = () => {
      navigateCalls += 1;
    };
    Remote.showMenu = () => {};

    try {
      Remote.onTranslationsLoaded();
      Remote.onTranslationsLoaded();

      const clickEvent = document.createEvent("Event");
      clickEvent.initEvent(
        "click",
        true,
        true
      );
      document.querySelector("#dynamic-button").dispatchEvent(clickEvent);

      assert.equal(navigateCalls, 1);
      assert.equal(Remote.areNavigationEventHandlersBound, true);
    } finally {
      Remote.navigateToMenu = originalNavigateToMenu;
      Remote.showMenu = originalShowMenu;
      Remote.areNavigationEventHandlersBound = originalBoundFlag;
      Remote.translations = originalTranslations;
    }
  });

  test("data structures are initialized correctly", () => {
    assert.ok(typeof Remote.savedData === "object");
    assert.ok(typeof Remote.translations === "object");
    assert.ok(typeof Remote.currentConfig === "object");
    assert.ok(Array.isArray(Remote.changedModules));
    assert.ok(Array.isArray(Remote.deletedModules));
    assert.equal(Remote.addModule, "");
  });
});
