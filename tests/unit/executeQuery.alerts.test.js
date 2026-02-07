const assert = require("node:assert/strict");
const {test, describe, mock, afterEach} = require("node:test");

// Add tests/shims to module resolution so 'logger' and 'node_helper' resolve to our shims
const path = require("node:path");
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const helper = Object.create(helperFactory);
  helper.__socketNotifications = [];
  helper.__responses = [];
  helper.sendSocketNotification = (action, payload) => {
    helper.__socketNotifications.push({action, payload});
  };
  helper.sendResponse = (res, error, payload) => {
    helper.__responses.push({res, error, payload});
  };
  helper.expressApp = {post: () => {}};
  helper.expressRouter = {post: () => {}, get: () => {}};
  helper.io = {emit: () => {}};
  return helper;
}

describe("executeQuery - Alert handling", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test("SHOW_ALERT uses all provided parameters", () => {
    const helper = freshHelper();
    helper.handleShowAlert = helperFactory.handleShowAlert.bind(helper);

    helper.executeQuery({
      action: "SHOW_ALERT",
      type: "notification",
      title: "Test Title",
      message: "Test Message",
      timer: 10
    });

    assert.equal(helper.__responses.length, 1);
    assert.equal(helper.__socketNotifications.length, 1);
    const notification = helper.__socketNotifications[0];
    assert.equal(notification.action, "SHOW_ALERT");
    assert.deepEqual(notification.payload, {
      type: "notification",
      title: "Test Title",
      message: "Test Message",
      timer: 10_000
    });
  });

  test("SHOW_ALERT uses defaults when parameters missing", () => {
    const helper = freshHelper();
    helper.handleShowAlert = helperFactory.handleShowAlert.bind(helper);

    helper.executeQuery({action: "SHOW_ALERT"});

    const notification = helper.__socketNotifications[0];
    assert.deepEqual(notification.payload, {
      type: "alert",
      title: "Note",
      message: "Attention!",
      timer: 4000
    });
  });

  test("SHOW_ALERT converts timer from seconds to milliseconds", () => {
    const helper = freshHelper();
    helper.handleShowAlert = helperFactory.handleShowAlert.bind(helper);

    helper.executeQuery({action: "SHOW_ALERT", timer: 5});

    const notification = helper.__socketNotifications[0];
    assert.equal(notification.payload.timer, 5000);
  });

  test("HIDE_ALERT sends response and notification", () => {
    const helper = freshHelper();
    helper.handleSimpleNotification = helperFactory.handleSimpleNotification.bind(helper);

    helper.executeQuery({action: "HIDE_ALERT"});

    assert.equal(helper.__responses.length, 1);
    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "HIDE_ALERT");
    assert.equal(helper.__socketNotifications[0].payload, undefined);
  });
});
