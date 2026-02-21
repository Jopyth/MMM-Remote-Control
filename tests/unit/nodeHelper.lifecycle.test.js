const assert = require("node:assert/strict");
const {describe, test} = require("node:test");
const path = require("node:path");
const ModuleLib = require("node:module");

const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const fs = require("node:fs");
const configManager = require("../../lib/configManager.js");
const moduleManager = require("../../lib/moduleManager.js");
const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const helper = Object.create(helperFactory);
  helper.name = "MMM-Remote-Control";
  helper.sendSocketNotification = () => {};
  helper.expressApp = {
    get: () => {},
    post: () => {}
  };
  return helper;
}

describe("node_helper lifecycle and queue", () => {
  test("start initializes state and bootstraps setup", () => {
    const helper = freshHelper();

    let loadedLanguage;
    helper.loadTranslation = (lang) => {
      loadedLanguage = lang;
    };

    let updateModuleListCalled = false;
    helper.updateModuleList = () => {
      updateModuleListCalled = true;
    };

    let createRoutesCalled = false;
    helper.createRoutes = () => {
      createRoutesCalled = true;
    };

    let createApiRoutesCalled = false;
    helper.createApiRoutes = () => {
      createApiRoutesCalled = true;
    };

    const originalCombineConfig = configManager.combineConfig;
    configManager.combineConfig = () => ({
      configOnHd: {port: 8080, language: "en"},
      thisConfig: {apiKey: "test"}
    });

    const originalReadFile = fs.readFile;
    fs.readFile = (_path, callback) => {
      callback(undefined, Buffer.from("<html>remote</html>"));
    };

    try {
      helper.start();
    } finally {
      configManager.combineConfig = originalCombineConfig;
      fs.readFile = originalReadFile;
    }

    assert.equal(helper.initialized, false);
    assert.deepEqual(helper.configOnHd, {port: 8080, language: "en"});
    assert.deepEqual(helper.thisConfig, {apiKey: "test"});
    assert.deepEqual(helper.modulesAvailable, []);
    assert.deepEqual(helper.modulesInstalled, []);
    assert.deepEqual(helper.delayedQueryTimers, {});
    assert.equal(helper.maxParallelUpdateChecks, 10);
    assert.equal(loadedLanguage, "en");
    assert.equal(updateModuleListCalled, true);
    assert.equal(createRoutesCalled, true);
    assert.equal(createApiRoutesCalled, true);
    assert.equal(helper.template, "<html>remote</html>");
  });

  test("stop clears all delayed query timers", () => {
    const helper = freshHelper();
    helper.delayedQueryTimers = {
      one: setTimeout(() => {}, 1000),
      two: setTimeout(() => {}, 1000)
    };

    let clearCalls = 0;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.clearTimeout = (timer) => {
      clearCalls++;
      return originalClearTimeout(timer);
    };

    try {
      helper.stop();
    } finally {
      globalThis.clearTimeout = originalClearTimeout;
    }

    assert.equal(clearCalls, 2);
  });

  test("processUpdateCheckQueue starts checks up to configured parallel limit", () => {
    const helper = freshHelper();
    helper.activeUpdateChecks = 0;
    helper.maxParallelUpdateChecks = 2;
    helper.updateCheckQueue = [
      {directoryName: "A"},
      {directoryName: "B"},
      {directoryName: "C"}
    ];

    const processed = [];
    helper.checkModuleUpdate = (check) => {
      processed.push(check.directoryName);
    };

    helper.processUpdateCheckQueue();

    assert.equal(helper.activeUpdateChecks, 2);
    assert.deepEqual(processed, ["A", "B"]);
    assert.equal(helper.updateCheckQueue.length, 1);
    assert.equal(helper.updateCheckQueue[0].directoryName, "C");
  });

  test("checkModuleUpdate decrements counters and continues queue even when check fails", async () => {
    const helper = freshHelper();
    helper.activeUpdateChecks = 1;
    helper.pendingUpdateChecks = 1;
    helper.updateCheckQueue = [];

    let queueProcessed = 0;
    helper.processUpdateCheckQueue = () => {
      queueProcessed++;
    };

    const originalCheckModuleUpdate = moduleManager.checkModuleUpdate;
    moduleManager.checkModuleUpdate = async () => {
      throw new Error("network failure");
    };

    try {
      await assert.rejects(
        helper.checkModuleUpdate({directoryName: "Broken"}),
        /network failure/
      );
    } finally {
      moduleManager.checkModuleUpdate = originalCheckModuleUpdate;
    }

    assert.equal(helper.activeUpdateChecks, 0);
    assert.equal(helper.pendingUpdateChecks, 0);
    assert.equal(queueProcessed, 1);
  });
});
