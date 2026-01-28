const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const path = require("node:path");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper() {
  const h = Object.create(helperFactory);
  h.__socketNotifications = [];
  h.sendSocketNotification = (action, payload) => {
    h.__socketNotifications.push({ action, payload });
  };
  h.waiting = [];
  h.initialized = false;
  h.configOnHd = { port: 8080 };
  h.loadDefaultSettings = () => {};
  h.getIpAddresses = helperFactory.getIpAddresses.bind(h);
  h.executeQuery = (query, res) => {
    h.__executeQueryCalls = h.__executeQueryCalls || [];
    h.__executeQueryCalls.push({ query, res });
  };
  return h;
}

describe("socketNotificationReceived", () => {
  test("handles CURRENT_STATUS and sets configData", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = {
      remoteConfig: { apiKey: "test" },
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

    helper.socketNotificationReceived("CURRENT_STATUS", { remoteConfig: {} });

    assert.ok(callbackRun);
    assert.equal(helper.waiting.length, 0);
  });

  test("sets initialized to true when not initialized on CURRENT_STATUS", () => {
    const helper = freshHelper();
    helper.initialized = false;
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("CURRENT_STATUS", { remoteConfig: {} });

    assert.equal(helper.initialized, true);
  });

  test("handles REQUEST_DEFAULT_SETTINGS and sends IP_ADDRESSES", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("REQUEST_DEFAULT_SETTINGS", {});

    const ipNotification = helper.__socketNotifications.find(n => n.action === "IP_ADDRESSES");
    assert.ok(ipNotification);
    assert.ok(Array.isArray(ipNotification.payload));
  });

  test("sends LOAD_PORT on REQUEST_DEFAULT_SETTINGS", () => {
    const helper = freshHelper();
    helper.configOnHd.port = 9090;
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    helper.socketNotificationReceived("REQUEST_DEFAULT_SETTINGS", {});

    const portNotification = helper.__socketNotifications.find(n => n.action === "LOAD_PORT");
    assert.ok(portNotification);
    assert.equal(portNotification.payload, 9090);
  });

  test("handles REMOTE_ACTION and calls executeQuery", () => {
    const helper = freshHelper();
    helper.socketNotificationReceived = helperFactory.socketNotificationReceived.bind(helper);

    const payload = { action: "REFRESH" };
    helper.socketNotificationReceived("REMOTE_ACTION", payload);

    assert.equal(helper.__executeQueryCalls.length, 1);
    assert.equal(helper.__executeQueryCalls[0].query, payload);
    assert.ok(helper.__executeQueryCalls[0].res.isSocket);
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
});
