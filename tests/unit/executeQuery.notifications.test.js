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
  h.checkInitialized = () => true;
  h.thisConfig = {};
  return h;
}

describe("executeQuery - Simple notification wrappers", () => {
  test("handleSimpleSocketNotification sends action and query as payload", () => {
    const helper = freshHelper();
    helper.handleSimpleSocketNotification = helperFactory.handleSimpleSocketNotification.bind(helper);

    helper.handleSimpleSocketNotification({action: "HIDE", module: "clock"});

    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "HIDE");
    assert.deepEqual(helper.__socketNotifications[0].payload, {action: "HIDE", module: "clock"});
    assert.equal(helper.__responses.length, 1);
  });

  test("handleSimpleValueNotification sends value from query", () => {
    const helper = freshHelper();
    helper.handleSimpleValueNotification = helperFactory.handleSimpleValueNotification.bind(helper);

    helper.handleSimpleValueNotification({action: "BRIGHTNESS", value: 150});

    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "BRIGHTNESS");
    assert.equal(helper.__socketNotifications[0].payload, 150);
    assert.equal(helper.__responses.length, 1);
  });

  test("handleSimpleNotification sends action without payload", () => {
    const helper = freshHelper();
    helper.handleSimpleNotification = helperFactory.handleSimpleNotification.bind(helper);

    helper.handleSimpleNotification({action: "REFRESH"});

    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "REFRESH");
    assert.equal(helper.__socketNotifications[0].payload, undefined);
    assert.equal(helper.__responses.length, 1);
  });

  test("handleDelayed calls delayedQuery with query and res", () => {
    const helper = freshHelper();
    let delayedQueryCalled = false;
    helper.delayedQuery = (query, res) => {
      delayedQueryCalled = true;
      assert.deepEqual(query, {action: "DELAYED", did: "test123"});
      assert.equal(res, "mock-res");
    };
    helper.handleDelayed = helperFactory.handleDelayed.bind(helper);

    helper.handleDelayed({action: "DELAYED", did: "test123"}, "mock-res");

    assert.ok(delayedQueryCalled, "Should call delayedQuery");
  });

  test("executeQuery returns false and sends error for invalid action", () => {
    const helper = freshHelper();
    helper.getActionHandlers = helperFactory.getActionHandlers.bind(helper);
    helper.executeQuery = helperFactory.executeQuery.bind(helper);

    const result = helper.executeQuery({action: "INVALID_ACTION"});

    assert.equal(result, false);
    assert.equal(helper.__responses.length, 1);
    assert.ok(helper.__responses[0].err);
    assert.ok(helper.__responses[0].err.message.includes("Invalid Option"));
  });

  test("executeQuery returns true and calls handler for valid action", () => {
    const helper = freshHelper();
    helper.getActionHandlers = helperFactory.getActionHandlers.bind(helper);
    helper.executeQuery = helperFactory.executeQuery.bind(helper);
    helper.handleSimpleNotification = helperFactory.handleSimpleNotification.bind(helper);

    const result = helper.executeQuery({action: "REFRESH"});

    assert.equal(result, true);
    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "REFRESH");
  });
});
