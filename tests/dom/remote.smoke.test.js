const {test, describe, before, after} = require("node:test");
const assert = require("node:assert/strict");
const {Window} = require("happy-dom");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("remote.js DOM smoke tests", () => {
  let window, Remote;

  before(() => {
    // Create browser-like environment
    window = new Window({
      url: "http://localhost:8080",
      settings: {
        disableJavaScriptFileLoading: true,
        disableJavaScriptEvaluation: false,
        disableCSSFileLoading: true
      }
    });

    // Mock required globals that remote.js depends on
    window.MMSocket = class {
      constructor (name) {
        this.name = name;
        this._callback = null;
      }

      setNotificationCallback (callback) {
        this._callback = callback;
      }

      sendNotification () {
        // Mock - do nothing
      }
    };

    window.marked = {
      parse: (text) => `<p>${text}</p>` // Simple mock
    };

    window.location = {hash: ""};
    window.globalThis = window;

    // Load remote.js
    const remoteJsPath = path.join(__dirname, "../../remote.js");
    const remoteJsCode = fs.readFileSync(remoteJsPath, "utf8");

    // Create context with window as global
    const context = vm.createContext(window);

    // Execute remote.js in the window context
    vm.runInContext(remoteJsCode, context);

    // Load topic files that extend Remote via Object.assign
    for (const topicFile of ["remote-utils.js", "remote-socket.js", "remote-modules.js", "remote-config.js", "remote-menu.js"]) {
      const topicPath = path.join(__dirname, "../../", topicFile);
      const topicCode = fs.readFileSync(topicPath, "utf8");
      vm.runInContext(topicCode, context);
    }

    // Remote is now available via window.Remote (exported by remote.js)
    Remote = window.Remote;
  });

  after(() => {
    window.close();
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
    window.document.body.innerHTML = `
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

    assert.equal(window.document.querySelectorAll("#mc-pages-pagechanged-button").length, 0);
    assert.equal(window.document.querySelectorAll("#mc-pages-next-button").length, 1);
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
