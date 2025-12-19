const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const path = require("node:path");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

// Mock Module.configDefaults
globalThis.Module = {
  configDefaults: {
    clock: {
      timeFormat: 24,
      showPeriod: false
    }
  }
};

const helperFactory = require("../../node_helper.js");

describe("getConfig", () => {
  test("merges config defaults from moduleDataFromBrowser", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      modules: [{module: "test-module", config: {userSetting: "value"}}]
    };
    helper.configData = {
      moduleData: [{name: "test-module", config: {defaultSetting: "default", otherSetting: 42}}]
    };
    helper.getConfig = helperFactory.getConfig.bind(helper);

    const config = helper.getConfig();

    // User setting preserved
    assert.equal(config.modules[0].config.userSetting, "value");
    // Defaults from moduleDataFromBrowser merged
    assert.equal(config.modules[0].config.defaultSetting, "default");
    assert.equal(config.modules[0].config.otherSetting, 42);
  });

  test("does not override existing config values", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      modules: [{module: "test-module", config: {setting: "userValue", other: "keep"}}]
    };
    helper.configData = {
      moduleData: [{name: "test-module", config: {setting: "defaultValue", newSetting: "add"}}]
    };
    helper.getConfig = helperFactory.getConfig.bind(helper);

    const config = helper.getConfig();

    // User value not overridden
    assert.equal(config.modules[0].config.setting, "userValue");
    // Other user value kept
    assert.equal(config.modules[0].config.other, "keep");
    // New default added
    assert.equal(config.modules[0].config.newSetting, "add");
  });

  test("creates config object when missing", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      modules: [{module: "no-config-module"}]
    };
    helper.configData = {
      moduleData: [{name: "no-config-module", config: {default: "value"}}]
    };
    helper.getConfig = helperFactory.getConfig.bind(helper);

    const config = helper.getConfig();

    assert.ok(config.modules[0].config);
    assert.equal(config.modules[0].config.default, "value");
  });

  test("falls back to moduleDataFromBrowser config when no require defaults", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      modules: [{module: "custom-module"}]
    };
    helper.configData = {
      moduleData: [{name: "custom-module", config: {customOption: "value"}}]
    };
    helper.getConfig = helperFactory.getConfig.bind(helper);

    const config = helper.getConfig();

    assert.equal(config.modules[0].config.customOption, "value");
  });

  test("handles module with no defaults gracefully", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      modules: [{module: "unknown-module", config: {}}]
    };
    helper.configData = {moduleData: []};
    helper.getConfig = helperFactory.getConfig.bind(helper);

    const config = helper.getConfig();

    assert.deepEqual(config.modules[0].config, {});
  });

  test("returns configOnHd reference", () => {
    const helper = Object.create(helperFactory);
    const originalConfig = {modules: []};
    helper.configOnHd = originalConfig;
    helper.configData = {moduleData: []};
    helper.getConfig = helperFactory.getConfig.bind(helper);

    const config = helper.getConfig();

    assert.equal(config, originalConfig);
  });
});
