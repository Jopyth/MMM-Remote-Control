const assert = require("node:assert/strict");
const {test, describe, mock, afterEach} = require("node:test");

// Add tests/shims to module resolution so 'logger' resolves to our shim
const path = require("node:path");
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
// Re-initialize search paths to include NODE_PATH
if (typeof ModuleLib._initPaths === "function") {
  ModuleLib._initPaths();
}

// Import node_helper.js to get delayedQuery and executeQuery behavior
const nodeHelperFactory = require("../../node_helper.js");

// Builds a minimal helper instance for testing
function makeHelper () {
  const helper = Object.assign({}, nodeHelperFactory);
  helper.delayedQueryTimers = {};
  helper.executeQuery = (q) => { helper.__executed = [...helper.__executed || [], q]; };
  helper.sendResponse = (_res, _error, data) => data || {};
  return helper;
}

describe("node_helper delayedQuery timers", () => {
  afterEach(() => {
    mock.timers.reset();
  });

  test("schedules and executes action once timeout fires", () => {
    mock.timers.enable({apis: ["setTimeout"]});
    const helper = makeHelper();
    const res = {};
    const q = {did: "A", timeout: 1000, query: {action: "TEST"}};

    helper.delayedQuery(q, res);
    // One timer should be recorded
    assert.equal(Object.keys(helper.delayedQueryTimers).length, 1);

    // Run all pending timers
    mock.timers.runAll();

    assert.equal((helper.__executed || []).length, 1);
    assert.equal(helper.__executed[0].action, "TEST");
  });

  test("reset with same did replaces prior timer", () => {
    mock.timers.enable({apis: ["setTimeout"]});
    const helper = makeHelper();
    const res = {};

    helper.delayedQuery({did: "X", timeout: 1000, query: {action: "ONE"}}, res);
    const firstId = Object.values(helper.delayedQueryTimers)[0];
    helper.delayedQuery({did: "X", timeout: 1000, query: {action: "TWO"}}, res);
    const secondId = Object.values(helper.delayedQueryTimers)[0];

    assert.notEqual(firstId, secondId);
    // First timer should be cleared, running all timers should only execute second
    mock.timers.runAll();
    assert.equal(helper.__executed.length, 1);
    assert.equal(helper.__executed[0].action, "TWO");
  });

  test("abort cancels scheduled timer", () => {
    mock.timers.enable({apis: ["setTimeout"]});
    const helper = makeHelper();
    const res = {};

    helper.delayedQuery({did: "Y", timeout: 1000, query: {action: "NEVER"}}, res);
    helper.delayedQuery({did: "Y", abort: true, query: {action: "NEVER"}}, res);

    // No timer should remain
    assert.equal(Object.keys(helper.delayedQueryTimers).length, 0);
    // Running timers should not execute anything
    mock.timers.runAll();
    assert.equal((helper.__executed || []).length || 0, 0);
  });
});
