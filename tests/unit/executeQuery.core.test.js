const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const group = typeof describe === "function" ? describe : (_n, fn) => fn();

// Add tests/shims to module resolution so 'logger' and 'node_helper' resolve to our shims
const path = require("node:path");
const ModuleLib = require("module");
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
  h.sendResponse = (_res, err, data) => { h.__responses.push({err, data}); };
  return h;
}

group("executeQuery core actions", () => {
  test("HIDE forwards query unchanged to socket", () => {
    const h = freshHelper();
    const q = {action: "HIDE", module: "clock"};
    const res = {};
    const result = h.executeQuery(q, res);
    assert.equal(result, true);
    assert.deepEqual(h.__sent[0], {what: "HIDE", payload: q});
    assert.equal(h.__responses.length, 1);
  });

  test("SHOW and TOGGLE also forward query", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "SHOW", module: "all"}, res);
    h.executeQuery({action: "TOGGLE", module: "module_1_clock"}, res);
    assert.deepEqual(h.__sent[0], {what: "SHOW", payload: {action: "SHOW", module: "all"}});
    assert.deepEqual(h.__sent[1], {what: "TOGGLE", payload: {action: "TOGGLE", module: "module_1_clock"}});
    assert.equal(h.__responses.length, 2);
  });

  test("BRIGHTNESS forwards numeric value", () => {
    const h = freshHelper();
    const res = {};
    const q = {action: "BRIGHTNESS", value: 90};
    const ok = h.executeQuery(q, res);
    assert.equal(ok, true);
    assert.deepEqual(h.__sent[0], {what: "BRIGHTNESS", payload: 90});
    assert.equal(h.__responses.length, 1);
  });

  test("TEMP forwards value and responds", () => {
    const h = freshHelper();
    const res = {};
    const q = {action: "TEMP", value: 22};
    const ok = h.executeQuery(q, res);
    assert.equal(ok, true);
    assert.deepEqual(h.__sent[0], {what: "TEMP", payload: 22});
    assert.equal(h.__responses.length, 1);
  });

  test("SHOW_ALERT builds default payload when fields missing", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "SHOW_ALERT"}, res);
    assert.equal(ok, true);
    assert.equal(h.__sent[0].what, "SHOW_ALERT");
    assert.deepEqual(h.__sent[0].payload, {type: "alert", title: "Note", message: "Attention!", timer: 4000});
    assert.equal(h.__responses.length, 1);
  });

  test("SHOW_ALERT respects provided fields and multiplies timer by 1000", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "SHOW_ALERT", type: "warning", title: "T", message: "M", timer: 2}, res);
    assert.deepEqual(h.__sent[0], {what: "SHOW_ALERT", payload: {type: "warning", title: "T", message: "M", timer: 2000}});
  });

  test("HIDE_ALERT and REFRESH emit simple notifications", () => {
    const h = freshHelper();
    const res = {};
    h.executeQuery({action: "HIDE_ALERT"}, res);
    h.executeQuery({action: "REFRESH"}, res);
    assert.deepEqual(h.__sent[0], {what: "HIDE_ALERT", payload: undefined});
    assert.deepEqual(h.__sent[1], {what: "REFRESH", payload: undefined});
    assert.equal(h.__responses.length, 2);
  });

  test("NOTIFICATION without payload sends undefined payload", () => {
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

  test("USER_PRESENCE forwards boolean and updates state", () => {
    const h = freshHelper();
    const res = {};
    const ok = h.executeQuery({action: "USER_PRESENCE", value: true}, res);
    assert.equal(ok, true);
    assert.deepEqual(h.__sent[0], {what: "USER_PRESENCE", payload: true});
    assert.equal(h.userPresence, true);
    assert.equal(h.__responses.length, 1);
  });

  test("MANAGE_CLASSES: string key maps to lower-case actions and sends modules", () => {
    const h = freshHelper();
    h.thisConfig = {classes: {Group1: {hide: "calendar", show: ["newsfeed"], toggle: ["clock", "weather"]}}};
    const res = {};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: "Group1"}}, res);
    // Order depends on object key iteration; check membership instead of order.
    const sent = h.__sent.reduce((acc, s) => acc.add(`${s.what}:${JSON.stringify(s.payload)}`), new Set());
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
    const res = {};
    h.executeQuery({action: "MANAGE_CLASSES", payload: {classes: ["A", "B"]}}, res);
    const sent = h.__sent.reduce((acc, s) => acc.add(`${s.what}:${JSON.stringify(s.payload)}`), new Set());
    assert.ok(sent.has("SHOW:{\"module\":\"one\"}"));
    assert.ok(sent.has("HIDE:{\"module\":\"two\"}"));
    assert.ok(sent.has("TOGGLE:{\"module\":\"three\"}"));
    assert.equal(h.__responses.length, 1);
  });
});
