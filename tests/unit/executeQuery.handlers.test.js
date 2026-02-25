const assert = require("node:assert/strict");
const {test, describe} = require("node:test");

// Add tests/shims to module resolution
const path = require("node:path");
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const h = Object.create(helperFactory);
  h.__socketNotifications = [];
  h.__responses = [];
  h.sendSocketNotification = (action, payload) => {
    h.__socketNotifications.push({action, payload});
  };
  h.sendResponse = (_res, error, data) => { h.__responses.push({err: error, data}); };
  h.waiting = [];
  return h;
}

describe("callAfterUpdate", () => {
  test("schedules callback and sends UPDATE notification", () => {
    const helper = freshHelper();
    helper.callAfterUpdate = helperFactory.callAfterUpdate.bind(helper);
    let callbackExecuted = false;

    helper.callAfterUpdate(() => {
      callbackExecuted = true;
    }, 50);

    // Should add to waiting array
    assert.equal(helper.waiting.length, 1);
    assert.equal(typeof helper.waiting[0].run, "function");

    // Should send UPDATE notification
    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "UPDATE");

    // Wait for timeout and trigger callback
    return new Promise((resolve) => {
      setTimeout(() => {
        helper.waiting[0].run();
        assert.ok(callbackExecuted, "Callback should be executed");
        resolve();
      }, 60);
    });
  });

  test("waitObject.run() marks as finished and executes callback once", () => {
    const helper = freshHelper();
    helper.callAfterUpdate = helperFactory.callAfterUpdate.bind(helper);
    let callCount = 0;

    helper.callAfterUpdate(() => {
      callCount++;
    });

    const waitObject = helper.waiting[0];
    waitObject.run();
    assert.equal(callCount, 1);

    // Second run should not execute callback
    waitObject.run();
    assert.equal(callCount, 1, "Callback should only execute once");
  });

  test("uses default timeout of 3000ms when not specified", () => {
    const helper = freshHelper();
    helper.callAfterUpdate = helperFactory.callAfterUpdate.bind(helper);

    helper.callAfterUpdate(() => {});

    // Just verify it doesn't throw and creates wait object with a run method
    assert.equal(helper.waiting.length, 1);
    assert.equal(typeof helper.waiting[0].run, "function");
  });
});

describe("getActionHandlers", () => {
  test("returns object with all action handlers", () => {
    const helper = freshHelper();
    helper.thisConfig = {};
    helper.getActionHandlers = helperFactory.getActionHandlers.bind(helper);

    const handlers = helper.getActionHandlers();

    // Verify some key handlers exist
    assert.ok(typeof handlers.SHOW === "function");
    assert.ok(typeof handlers.HIDE === "function");
    assert.ok(typeof handlers.TOGGLE === "function");
    assert.ok(typeof handlers.BRIGHTNESS === "function");
    assert.ok(typeof handlers.REFRESH === "function");
    assert.ok(typeof handlers.SHOW_ALERT === "function");
    assert.ok(typeof handlers.NOTIFICATION === "function");
    assert.ok(typeof handlers.DELAYED === "function");
  });

  test("handler functions are bound with correct context", () => {
    const helper = freshHelper();
    helper.thisConfig = {};
    helper.getActionHandlers = helperFactory.getActionHandlers.bind(helper);
    helper.handleSimpleNotification = helperFactory.handleSimpleNotification.bind(helper);

    const handlers = helper.getActionHandlers();

    // Call REFRESH handler
    handlers.REFRESH({action: "REFRESH"});

    // Should send notification via helper's method
    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "REFRESH");
  });
});

describe("getDataHandlers", () => {
  test("returns object with all data handlers", () => {
    const helper = freshHelper();
    helper.translation = {};
    helper.userPresence = true;
    helper.getConfig = () => ({});
    helper.getDataHandlers = helperFactory.getDataHandlers.bind(helper);

    const handlers = helper.getDataHandlers();

    // Verify key handlers exist
    assert.ok(typeof handlers.translations === "function");
    assert.ok(typeof handlers.config === "function");
    assert.ok(typeof handlers.brightness === "function");
    assert.ok(typeof handlers.temp === "function");
    assert.ok(typeof handlers.userPresence === "function");
    assert.ok(typeof handlers.classes === "function");
  });

  test("translations handler returns translation data", () => {
    const helper = freshHelper();
    helper.translation = {HELLO: "Hello", WORLD: "World"};
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    helper.getDataHandlers = helperFactory.getDataHandlers.bind(helper);
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    const handlers = helper.getDataHandlers();
    handlers.translations({data: "translations"}, mockRes);

    assert.equal(mockRes.jsonData.success, true);
    assert.deepEqual(mockRes.jsonData.data, {HELLO: "Hello", WORLD: "World"});
  });

  test("userPresence handler returns presence status", () => {
    const helper = freshHelper();
    helper.userPresence = false;
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    helper.getDataHandlers = helperFactory.getDataHandlers.bind(helper);
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    const handlers = helper.getDataHandlers();
    handlers.userPresence({data: "userPresence"}, mockRes);

    assert.equal(mockRes.jsonData.success, true);
    assert.equal(mockRes.jsonData.result, false);
  });
});
