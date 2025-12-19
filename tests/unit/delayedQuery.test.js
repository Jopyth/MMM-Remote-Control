const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const group = typeof describe === "function" ? describe : (_n, function_) => function_();

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

// Capture originals to restore after tests
const ORIGINAL_TIMERS = {setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout};

// Builds a minimal helper instance with overridden timer functions for determinism
function makeHelperWithFakeTimers () {
  // Create a fresh instance of the helper
  const helper = Object.assign({}, nodeHelperFactory);

  // Capture scheduled timeouts by id
  const timeouts = new Map();
  let nextId = 1;

  // Fake setTimeout: call the handler immediately but record it so we can assert
  function fakeSetTimeout (function_, _ms) {
    void _ms; // mark as used for linting
    const id = nextId++;
    timeouts.set(id, function_);
    // Do not call immediately here; we want to inspect map changes first
    return id;
  }
  function fakeClearTimeout (id) {
    timeouts.delete(id);
  }

  // Replace timer methods on instance scope
  helper.delayedQueryTimers = {};
  helper.executeQuery = (q) => { helper.__executed = [...helper.__executed || [], q]; };
  helper.sendResponse = (_res, _error, data) => data || {};

  // Monkey patch global timer functions used by helper.delayedQuery via closure scoping
  globalThis.setTimeout = (function_, ms) => fakeSetTimeout(function_, ms);
  globalThis.clearTimeout = (id) => fakeClearTimeout(id);

  return {helper, timeouts};
}

group("node_helper delayedQuery timers", () => {
  test("schedules and executes action once timeout fires", () => {
    const {helper, timeouts} = makeHelperWithFakeTimers();
    const res = {};
    const q = {did: "A", timeout: 1, query: {action: "TEST"}};

    helper.delayedQuery(q, res);
    // One timer should be recorded
    assert.equal(Object.keys(helper.delayedQueryTimers).length, 1);

    // Simulate timeout firing
    const ids = Object.values(helper.delayedQueryTimers);
    for (const id of ids) {
      const function_ = timeouts.get(id);
      if (function_) function_();
    }

    assert.equal((helper.__executed || []).length, 1);
    assert.equal(helper.__executed[0].action, "TEST");
  });

  test("reset with same did replaces prior timer", () => {
    const {helper, timeouts} = makeHelperWithFakeTimers();
    const res = {};

    helper.delayedQuery({did: "X", timeout: 1, query: {action: "ONE"}}, res);
    const firstId = Object.values(helper.delayedQueryTimers)[0];
    helper.delayedQuery({did: "X", timeout: 1, query: {action: "TWO"}}, res);
    const secondId = Object.values(helper.delayedQueryTimers)[0];

    assert.notEqual(firstId, secondId);
    // Firing first should do nothing (cleared)
    const function1 = timeouts.get(firstId);
    if (function1) function1();
    assert.equal((helper.__executed || []).length || 0, 0);

    // Fire second
    const function2 = timeouts.get(secondId);
    if (function2) function2();
    assert.equal(helper.__executed.length, 1);
    assert.equal(helper.__executed[0].action, "TWO");
  });

  test("abort cancels scheduled timer", () => {
    const {helper, timeouts} = makeHelperWithFakeTimers();
    const res = {};

    helper.delayedQuery({did: "Y", timeout: 1, query: {action: "NEVER"}}, res);
    const id = Object.values(helper.delayedQueryTimers)[0];
    helper.delayedQuery({did: "Y", abort: true, query: {action: "NEVER"}}, res);

    // No timer should remain
    assert.equal(Object.keys(helper.delayedQueryTimers).length, 0);
    const function_ = timeouts.get(id);
    if (function_) function_();
    assert.equal((helper.__executed || []).length || 0, 0);
  });
});

// Restore global timers for other tests
test("restore timers", () => {
  globalThis.setTimeout = ORIGINAL_TIMERS.setTimeout;
  globalThis.clearTimeout = ORIGINAL_TIMERS.clearTimeout;
});
