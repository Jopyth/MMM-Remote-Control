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
  h.sendSocketNotification = (what, payload) => { h.__sent.push({what, payload}); };
  h.sendResponse = (_res, error, data) => { h.__responses.push({err: error, data}); };
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
    h.thisConfig = {pm2ProcessName: "mm"};
    // Stub controlPm2 since we don't have PM2 in test environment
    h.controlPm2 = (res) => {
      h.sendResponse(res, undefined, {action: "RESTART"});
    };
    const res = {};
    const ok = h.executeQuery({action: "RESTART"}, res);

    assert.equal(ok, true);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined);
  });
});
