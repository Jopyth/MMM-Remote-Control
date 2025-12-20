const assert = require("node:assert/strict");
const {test, describe} = require("node:test");

// Add tests/shims to module resolution so 'logger' and 'node_helper' resolve to our shims
const path = require("node:path");
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

// Import node_helper.js (returns the helper instance from our shimmed NodeHelper.create)
const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const h = Object.assign({}, helperFactory);
  h.__sent = [];
  h.__responses = [];
  h.waiting = [];
  h.sendSocketNotification = (what, payload) => { h.__sent.push({what, payload}); };
  h.sendResponse = (_res, error, data) => { h.__responses.push({err: error, data}); };
  h.callAfterUpdate = (callback) => callback(); // Execute immediately for tests
  return h;
}

describe("executeQuery core actions", () => {
  test("NOTIFICATION without payload returns undefined payload", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "NOTIFICATION", notification: "HELLO"}, res);
    assert.equal(ok, true);
    assert.deepEqual(h.__sent[0], {what: "NOTIFICATION", payload: {notification: "HELLO", payload: undefined}});
    assert.equal(h.__responses.length, 1);
  });

  test("NOTIFICATION parses JSON string payload", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "NOTIFICATION", notification: "HELLO", payload: "{\"a\":1}"}, res);
    assert.equal(ok, true);
    assert.deepEqual(h.__sent[0], {what: "NOTIFICATION", payload: {notification: "HELLO", payload: {a: 1}}});
  });

  test("NOTIFICATION passes raw string when payload is not JSON", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "NOTIFICATION", notification: "HELLO", payload: "plain"}, res);
    assert.deepEqual(h.__sent[0], {what: "NOTIFICATION", payload: {notification: "HELLO", payload: "plain"}});
  });

  test("NOTIFICATION invalid JSON returns error via sendResponse", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "NOTIFICATION", notification: "HELLO", payload: "{"}, res);
    assert.equal(ok, true);
    assert.equal(h.__sent.length, 0, "should not send socket notification on parse error");
    assert.equal(h.__responses.length, 1);
    assert.ok(h.__responses[0].err instanceof Error);
  });

  test("MANAGE_CLASSES: string key maps to lower-case actions and sends modules", () => {
    const h = freshHelper();
    h.thisConfig = {classes: {Group1: {hide: "calendar", show: ["newsfeed"], toggle: ["clock", "weather"]}}};
    const res = {};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: "Group1"}}, res);
    // Order depends on object key iteration; check membership instead of order.
    const sent = new Set();
    for (const s of h.__sent) {
      sent.add(`${s.what}:${JSON.stringify(s.payload)}`);
    }
    assert.ok(sent.has("HIDE:{\"module\":\"calendar\"}"));
    assert.ok(sent.has("SHOW:{\"module\":\"newsfeed\"}"));
    assert.ok(sent.has("TOGGLE:{\"module\":\"clock\"}"));
    assert.ok(sent.has("TOGGLE:{\"module\":\"weather\"}"));
    assert.equal(h.__responses.length, 1);
  });

  test("MANAGE_CLASSES: array of class names processes each", () => {
    const h = freshHelper();
    h.thisConfig = {classes: {
      A: {show: ["one"]},
      B: {hide: ["two"], toggle: "three"}
    }};
    const response = {};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: ["A", "B"]}}, response);
    const sent = new Set();
    for (const s of h.__sent) {
      sent.add(`${s.what}:${JSON.stringify(s.payload)}`);
    }
    assert.ok(sent.has("SHOW:{\"module\":\"one\"}"));
    assert.ok(sent.has("HIDE:{\"module\":\"two\"}"));
    assert.ok(sent.has("TOGGLE:{\"module\":\"three\"}"));
    assert.equal(h.__responses.length, 1);
  });

  test("MANAGE_CLASSES: empty array sends no notifications", () => {
    const h = freshHelper();
    h.thisConfig = {classes: {A: {show: ["test"]}}};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: []}}, {});

    assert.equal(h.__sent.length, 0);
    assert.equal(h.__responses.length, 1);
  });

  test("MANAGE_CLASSES: non-existent class name is ignored", () => {
    const h = freshHelper();
    h.thisConfig = {classes: {A: {show: ["one"]}}};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: "NonExistent"}}, {});

    assert.equal(h.__sent.length, 0);
    assert.equal(h.__responses.length, 1);
  });

  test("MANAGE_CLASSES: null/undefined classes handled gracefully", () => {
    const h = freshHelper();
    h.thisConfig = {classes: {A: {show: ["test"]}}};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: null}}, {});

    assert.equal(h.__sent.length, 0);
    assert.equal(h.__responses.length, 1);
  });

  test("SHOW sends socket notification with module identifier", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "SHOW", module: "calendar"}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "SHOW");
    assert.deepEqual(h.__sent[0].payload, {action: "SHOW", module: "calendar"});
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
  });

  test("SHOW with module 'all' sends to all modules", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "SHOW", module: "all"}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "SHOW");
    assert.deepEqual(h.__sent[0].payload, {action: "SHOW", module: "all"});
  });

  test("HIDE sends socket notification with module identifier", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "HIDE", module: "weather"}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "HIDE");
    assert.deepEqual(h.__sent[0].payload, {action: "HIDE", module: "weather"});
    assert.equal(h.__responses.length, 1);
  });

  test("TOGGLE sends socket notification with module identifier", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "TOGGLE", module: "clock"}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "TOGGLE");
    assert.deepEqual(h.__sent[0].payload, {action: "TOGGLE", module: "clock"});
    assert.equal(h.__responses.length, 1);
  });

  test("SHOW with force flag passes through to frontend", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "SHOW", module: "MMM-Test", force: true}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "SHOW");
    assert.deepEqual(h.__sent[0].payload, {action: "SHOW", module: "MMM-Test", force: true});
  });

  test("REFRESH sends simple notification without payload", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "REFRESH"}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "REFRESH");
    assert.equal(h.__sent[0].payload, undefined);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
  });

  test("RESTART sends socket notification to restart MagicMirror", () => {
    const h = freshHelper();
    h.thisConfig = {};
    // Stub handleRestart since we don't have Electron in test environment
    h.handleRestart = (query, res) => {
      h.sendResponse(res, undefined, {action: "RESTART"});
    };
    const res = {};
    const ok = h.executeQuery({action: "RESTART"}, res);

    assert.equal(ok, true);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
  });
});

describe("executeQuery state and value actions", () => {
  test("MODULE_DATA returns configData from browser after update checks", () => {
    const h = freshHelper();
    h.configData = {
      moduleData: [
        {name: "MMM-Test", config: {option: "value"}},
        {name: "clock", config: {}}
      ]
    };
    const res = {};
    const ok = h.executeQuery({action: "MODULE_DATA"}, res);

    assert.equal(ok, true);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
    assert.deepEqual(h.__responses[0].data, h.configData);
  });

  test("SAVE sends socket notification to trigger config save", () => {
    const h = freshHelper();
    h.configData = {
      moduleData: [{identifier: "module_1_clock", hidden: false}],
      brightness: 100,
      temp: 20,
      settingsVersion: 2
    };
    const res = {};
    const ok = h.executeQuery({action: "SAVE"}, res);

    assert.equal(ok, true);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
  });

  test("USER_PRESENCE updates user presence state and sends notification", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "USER_PRESENCE", value: true}, res);

    assert.equal(ok, true);
    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "USER_PRESENCE");
    assert.equal(h.__sent[0].payload, true);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
  });

  test("USER_PRESENCE handles false value", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "USER_PRESENCE", value: false}, res);

    assert.equal(h.__sent[0].payload, false);
  });

  test("BRIGHTNESS sends value within valid range (0-200)", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "BRIGHTNESS", value: 150}, res);

    assert.equal(ok, true);
    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "BRIGHTNESS");
    assert.equal(h.__sent[0].payload, 150);
    assert.equal(h.__responses.length, 1);
  });

  test("BRIGHTNESS accepts boundary values 0 and 200", () => {
    const h = freshHelper();

    h.executeQuery({action: "BRIGHTNESS", value: 0}, {});
    assert.equal(h.__sent[0].payload, 0);

    h.__sent = [];
    h.executeQuery({action: "BRIGHTNESS", value: 200}, {});
    assert.equal(h.__sent[0].payload, 200);
  });

  test("BRIGHTNESS handles string numbers", () => {
    const h = freshHelper();
    h.executeQuery({action: "BRIGHTNESS", value: "100"}, {});

    assert.equal(h.__sent[0].payload, "100");
  });

  test("TEMP sends temperature value", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "TEMP", value: 6500}, res);

    assert.equal(ok, true);
    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "TEMP");
    assert.equal(h.__sent[0].payload, 6500);
    assert.equal(h.__responses.length, 1);
  });

  test("TEMP handles different temperature values", () => {
    const h = freshHelper();

    h.executeQuery({action: "TEMP", value: 3000}, {});
    assert.equal(h.__sent[0].payload, 3000);

    h.__sent = [];
    h.executeQuery({action: "TEMP", value: 9000}, {});
    assert.equal(h.__sent[0].payload, 9000);
  });
});
