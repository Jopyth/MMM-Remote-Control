const assert = require("node:assert/strict");
const {describe, test} = require("node:test");
const path = require("node:path");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

describe("getModuleDir", () => {
  test("returns foreignModulesDir when defined", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {foreignModulesDir: "custom_modules"};

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "custom_modules");
  });

  test("returns paths.modules when defined and foreignModulesDir missing", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {paths: {modules: "alternative/modules"}};

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "alternative/modules");
  });

  test("returns 'modules' as default fallback", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {};

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "modules");
  });

  test("foreignModulesDir takes precedence over paths.modules", () => {
    const helper = Object.create(helperFactory);
    helper.configOnHd = {
      foreignModulesDir: "foreign_modules",
      paths: {modules: "regular/modules"}
    };

    const moduleDir = helper.getModuleDir();

    assert.equal(moduleDir, "foreign_modules");
  });
});
