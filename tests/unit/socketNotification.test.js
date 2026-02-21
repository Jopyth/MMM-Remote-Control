const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const path = require("node:path");
const ModuleLib = require("node:module");

// Add tests/shims to module resolution
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const h = Object.create(helperFactory);
  h.__socketNotifications = [];
  h.sendSocketNotification = (action, payload) => {
    h.__socketNotifications.push({action, payload});
  };
  h.waiting = [];
  h.initialized = false;
  h.configOnHd = {port: 8080};
  h.loadDefaultSettings = () => {};
  h.getIpAddresses = helperFactory.getIpAddresses.bind(h);
  h.executeQuery = (query, res) => {
    h.__executeQueryCalls = h.__executeQueryCalls || [];
    h.__executeQueryCalls.push({query, res});
  };
  return h;
}

describe("socketNotificationReceived", () => {
  test("handles CURRENT_STATUS and sets configData", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = {
      remoteConfig: {apiKey: "test"},
      moduleData: []
    };

    helper.socketNotificationReceived("CURRENT_STATUS", payload);

    assert.equal(helper.configData, payload);
    assert.deepEqual(helper.thisConfig, payload.remoteConfig);
  });

  test("runs waiting callbacks when initialized and CURRENT_STATUS received", () => {
    const helper = freshHelper();
    helper.initialized = true;
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);
    let callbackRun = false;

    helper.waiting.push({
      run: () => {
        callbackRun = true;
      }
    });

    helper.socketNotificationReceived("CURRENT_STATUS", {remoteConfig: {}});

    assert.ok(callbackRun);
    assert.equal(helper.waiting.length, 0);
  });

  test("sets initialized to true when not initialized on CURRENT_STATUS", () => {
    const helper = freshHelper();
    helper.initialized = false;
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("CURRENT_STATUS", {remoteConfig: {}});

    assert.equal(helper.initialized, true);
  });

  test("handles REQUEST_DEFAULT_SETTINGS and sends IP_ADDRESSES", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("REQUEST_DEFAULT_SETTINGS", {});

    const ipNotification = helper.__socketNotifications.find((n) => n.action === "IP_ADDRESSES");
    assert.ok(ipNotification);
    assert.ok(Array.isArray(ipNotification.payload));
  });

  test("sends LOAD_PORT on REQUEST_DEFAULT_SETTINGS", () => {
    const helper = freshHelper();
    helper.configOnHd.port = 9090;
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("REQUEST_DEFAULT_SETTINGS", {});

    const portNotification = helper.__socketNotifications.find((n) => n.action === "LOAD_PORT");
    assert.ok(portNotification);
    assert.equal(portNotification.payload, 9090);
  });

  test("handles REMOTE_ACTION and calls executeQuery", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = {action: "REFRESH"};
    helper.socketNotificationReceived("REMOTE_ACTION", payload);

    assert.equal(helper.__executeQueryCalls.length, 1);
    assert.equal(helper.__executeQueryCalls[0].query, payload);
    assert.ok(helper.__executeQueryCalls[0].res.isSocket);
  });

  test("handles REMOTE_ACTION with data and calls answerGet", () => {
    const helper = freshHelper();
    helper.__answerGetCalls = [];
    helper.answerGet = (query, res) => {
      helper.__answerGetCalls.push({query, res});
    };
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = {data: "translations"};
    helper.socketNotificationReceived("REMOTE_ACTION", payload);

    assert.equal(helper.__answerGetCalls.length, 1);
    assert.equal(helper.__answerGetCalls[0].query, payload);
    assert.ok(helper.__answerGetCalls[0].res.isSocket);
  });

  test("ignores REMOTE_ACTION without action property", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);
    helper.__executeQueryCalls = [];

    helper.socketNotificationReceived("REMOTE_ACTION", {});

    assert.equal(helper.__executeQueryCalls.length, 0);
  });

  test("ignores unknown notifications", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    // Should not throw
    assert.doesNotThrow(() => {
      helper.socketNotificationReceived("UNKNOWN_NOTIFICATION", {});
    });
  });

  test("registers external API routes and updates module API menu", () => {
    const helper = freshHelper();
    helper.externalApiRoutes = {};
    let updateCalls = 0;
    helper.updateModuleApiMenu = () => {
      updateCalls++;
    };
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = {
      module: "MMM-Example",
      actions: {
        TEST_ACTION: {
          payload: {}
        }
      }
    };

    helper.socketNotificationReceived("REGISTER_API", payload);

    assert.deepEqual(helper.externalApiRoutes["MMM-Example"], payload);
    assert.equal(updateCalls, 1);
  });

  test("removes external API routes when blank actions are registered", () => {
    const helper = freshHelper();
    helper.externalApiRoutes = {
      "MMM-Example": {module: "MMM-Example", actions: {TEST_ACTION: {}}}
    };
    let updateCalls = 0;
    helper.updateModuleApiMenu = () => {
      updateCalls++;
    };
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("REGISTER_API", {
      module: "MMM-Example",
      actions: {}
    });

    assert.equal("MMM-Example" in helper.externalApiRoutes, false);
    assert.equal(updateCalls, 1);
  });

  test("updates userPresence state on USER_PRESENCE notification", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("USER_PRESENCE", false);

    assert.equal(helper.userPresence, false);
  });

  test("handles REMOTE_CLIENT_CONNECTED and sends module menu when available", () => {
    const helper = freshHelper();
    helper.moduleApiMenu = {id: "module-control", items: []};
    let loadCustomMenusCalled = 0;
    helper.loadCustomMenus = () => {
      loadCustomMenusCalled++;
    };
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("REMOTE_CLIENT_CONNECTED", {});

    assert.equal(loadCustomMenusCalled, 1);
    const connected = helper.__socketNotifications.find((n) => n.action === "REMOTE_CLIENT_CONNECTED");
    assert.ok(connected);
    const menu = helper.__socketNotifications.find((n) => n.action === "REMOTE_CLIENT_MODULEAPI_MENU");
    assert.ok(menu);
    assert.equal(menu.payload.id, "module-control");
  });

  test("handles REMOTE_NOTIFICATION_ECHO_IN by forwarding payload", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = {notification: "TEST", value: 42};
    helper.socketNotificationReceived("REMOTE_NOTIFICATION_ECHO_IN", payload);

    const echo = helper.__socketNotifications.find((n) => n.action === "REMOTE_NOTIFICATION_ECHO_OUT");
    assert.ok(echo);
    assert.deepEqual(echo.payload, payload);
  });

  test("generateQRCode emits QR_CODE_GENERATED on success", async () => {
    const helper = freshHelper();
    helper.generateQRCode = helperFactory.generateQRCode.bind(helper);

    await helper.generateQRCode({url: "https://example.com", size: 128});

    const qrNotification = helper.__socketNotifications.find((n) => n.action === "QR_CODE_GENERATED");
    assert.ok(qrNotification);
    assert.equal(typeof qrNotification.payload, "string");
    assert.ok(qrNotification.payload.startsWith("data:image/png;base64,"));
  });

  test("generateQRCode emits QR_CODE_ERROR when qrcode module throws", async () => {
    const helper = freshHelper();
    helper.generateQRCode = helperFactory.generateQRCode.bind(helper);

    const originalRequire = ModuleLib.prototype.require;
    ModuleLib.prototype.require = function (id, ...args) {
      if (id === "qrcode") {
        throw new Error("forced qrcode failure");
      }
      return Reflect.apply(originalRequire, this, [id, ...args]);
    };

    try {
      await helper.generateQRCode({url: "https://example.com", size: 128});
    } finally {
      ModuleLib.prototype.require = originalRequire;
    }

    const errorNotification = helper.__socketNotifications.find((n) => n.action === "QR_CODE_ERROR");
    assert.ok(errorNotification);
    assert.ok(errorNotification.payload.includes("forced qrcode failure"));
  });
});
