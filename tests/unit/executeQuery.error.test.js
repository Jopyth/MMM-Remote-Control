const assert = require("node:assert/strict");
const {describe, test} = require("node:test");
const path = require("node:path");
const ModuleLib = require("node:module");

// Ensure shims resolve like other tests
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper (overrides = {}) {
  const helper = Object.assign({}, helperFactory);
  helper.__sent = [];
  helper.__responses = [];
  helper.sendSocketNotification = function (what, payload) {
    this.__sent.push({what, payload});
  };
  helper.sendResponse = function (res, err, data) {
    this.__responses.push({res, err, data});
    return !err;
  };
  helper.thisConfig = {classes: {}};
  helper.configOnHd = {};
  helper.configData = {moduleData: []};
  helper.checkInitialized = () => true;
  helper.executeQuery = helperFactory.executeQuery.bind(helper);
  helper.handleNotification = helperFactory.handleNotification.bind(helper);
  helper.handleSimpleSocketNotification = helperFactory.handleSimpleSocketNotification.bind(helper);
  return Object.assign(helper, overrides);
}

describe("executeQuery error handling", () => {
  test("NOTIFICATION with malformed JSON payload returns error", () => {
    const h = freshHelper();
    const res = {};

    // Already tested in executeQuery.core.test.js but documenting error path here
    const ok = h.executeQuery({action: "NOTIFICATION", notification: "TEST", payload: "{"}, res);

    assert.equal(ok, true, "should handle error gracefully");
    assert.equal(h.__sent.length, 0, "should not send notification on parse error");
    assert.equal(h.__responses.length, 1);
    assert.ok(h.__responses[0].err instanceof Error);
    assert.match(h.__responses[0].err.message, /Expected property name/);
  });

  test("NOTIFICATION with missing notification parameter sends undefined", () => {
    const h = freshHelper();
    const res = {};

    // Missing required param - backend doesn't validate, sends undefined to frontend
    h.executeQuery({action: "NOTIFICATION", payload: {foo: "bar"}}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "NOTIFICATION");
    assert.equal(h.__sent[0].payload.notification, undefined);
    assert.deepEqual(h.__sent[0].payload.payload, {foo: "bar"});
  });

  test("SHOW/HIDE/TOGGLE with missing module parameter still sends notification", () => {
    const h = freshHelper();
    const res = {};

    // Missing module - backend sends anyway, frontend filters out empty results
    h.executeQuery({action: "SHOW"}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "SHOW");
    assert.equal(h.__sent[0].payload.action, "SHOW");
    assert.equal(h.__sent[0].payload.module, undefined);
    assert.equal(h.__responses.length, 1);
    assert.equal(h.__responses[0].err, undefined, "no error thrown");
  });

  test("SHOW with empty module string sends notification", () => {
    const h = freshHelper();
    const res = {};

    h.executeQuery({action: "SHOW", module: ""}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].payload.module, "");
    assert.equal(h.__responses[0].err, undefined);
  });

  test("NOTIFICATION with nested invalid JSON in payload.param", () => {
    const h = freshHelper();
    const res = {};

    // Payload is object, nested value might be invalid JSON string
    h.executeQuery({
      action: "NOTIFICATION",
      notification: "TEST",
      payload: {param: "{invalid", other: "value"}
    }, res);

    // Backend doesn't parse nested values, sends as-is
    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].payload.notification, "TEST");
    assert.equal(h.__sent[0].payload.payload.param, "{invalid");
    assert.equal(h.__sent[0].payload.payload.other, "value");
  });

  test("NOTIFICATION with numeric payload passes number through (regression: module API menu PAGE_SELECT)", () => {
    const h = freshHelper();
    const res = {};

    /*
     * Reproduces the bug where page0 action sent payload:0 but handleNotification
     * dropped it, causing MMM-pages to receive {} instead of 0.
     */
    h.executeQuery({action: "NOTIFICATION", notification: "PAGE_SELECT", payload: 0}, res);

    assert.equal(h.__sent.length, 1);
    assert.equal(h.__sent[0].what, "NOTIFICATION");
    assert.equal(h.__sent[0].payload.notification, "PAGE_SELECT");
    assert.strictEqual(h.__sent[0].payload.payload, 0);
  });

  test("NOTIFICATION with boolean payload passes boolean through", () => {
    const h = freshHelper();
    const res = {};

    h.executeQuery({action: "NOTIFICATION", notification: "TEST_BOOL", payload: true}, res);

    assert.equal(h.__sent.length, 1);
    assert.strictEqual(h.__sent[0].payload.payload, true);
  });
});
