const assert = require("node:assert/strict");
const {test, describe, before, after} = require("node:test");
const path = require("node:path");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

describe("getConfigPath", () => {
  let originalConfigFile;

  before(() => {
    originalConfigFile = globalThis.configuration_file;
  });

  after(() => {
    if (originalConfigFile === undefined) {
      delete globalThis.configuration_file;
    } else {
      globalThis.configuration_file = originalConfigFile;
    }
  });

  test("returns default config path when globalThis.configuration_file undefined", () => {
    delete globalThis.configuration_file;
    const helper = Object.create(helperFactory);
    helper.getConfigPath = helperFactory.getConfigPath.bind(helper);

    const configPath = helper.getConfigPath();

    assert.ok(configPath.endsWith("/config/config.js"));
    assert.match(configPath, /\/config\/config\.js$/);
  });

  test("returns custom config path when globalThis.configuration_file set", () => {
    globalThis.configuration_file = "custom/config.js";
    const helper = Object.create(helperFactory);
    helper.getConfigPath = helperFactory.getConfigPath.bind(helper);

    const configPath = helper.getConfigPath();

    assert.ok(configPath.endsWith("/custom/config.js"));
    assert.match(configPath, /\/custom\/config\.js$/);
  });

  test("returns absolute path resolved from module directory", () => {
    const helper = Object.create(helperFactory);
    helper.getConfigPath = helperFactory.getConfigPath.bind(helper);

    const configPath = helper.getConfigPath();

    assert.ok(path.isAbsolute(configPath), "Should return absolute path");
  });
});

describe("getModuleDir", () => {
  test("returns foreignModulesDir when defined", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {foreignModulesDir: "custom_modules"};
    helper.getModuleDir = helperFactory.getModuleDir.bind(helper);

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "custom_modules");
  });

  test("returns paths.modules when defined and foreignModulesDir missing", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {paths: {modules: "alternative/modules"}};
    helper.getModuleDir = helperFactory.getModuleDir.bind(helper);

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "alternative/modules");
  });

  test("returns 'modules' as default fallback", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {};
    helper.getModuleDir = helperFactory.getModuleDir.bind(helper);

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "modules");
  });

  test("foreignModulesDir takes precedence over paths.modules", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      foreignModulesDir: "foreign_modules",
      paths: {modules: "regular/modules"}
    };
    helper.getModuleDir = helperFactory.getModuleDir.bind(helper);

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "foreign_modules");
  });
});
