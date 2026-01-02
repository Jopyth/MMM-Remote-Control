const assert = require("node:assert/strict");
const {test, describe, before, after} = require("node:test");
const path = require("node:path");
const fs = require("node:fs");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const h = Object.create(helperFactory);
  h.__responses = [];
  h.sendResponse = (res, error, data) => {
    h.__responses.push({err: error, data});
    if (res && res.json) {
      res.json(data || {success: !error});
    }
  };
  h.getModuleDir = () => "test_modules";
  return h;
}

describe("answerGetChangelog", () => {
  const testModulesDir = path.join(__dirname, "../..", "test_modules");
  const testModuleDir = path.join(testModulesDir, "test-module");
  const changelogPath = path.join(testModuleDir, "CHANGELOG.md");

  before(() => {
    // Create test module directory and CHANGELOG
    fs.mkdirSync(testModuleDir, {recursive: true});
    fs.writeFileSync(changelogPath, "# Changelog\n\n## v1.0.0\n- Initial release\n");
  });

  after(() => {
    // Clean up test files
    try {
      fs.rmSync(testModulesDir, {recursive: true, force: true});
    } catch {
      // Ignore cleanup errors
    }
  });

  test("returns changelog content when file exists", async () => {
    const helper = freshHelper();
    helper.answerGetChangelog = helperFactory.answerGetChangelog.bind(helper);
    const mockRes = {
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    await helper.answerGetChangelog({module: "test-module"}, mockRes);

    assert.equal(helper.__responses.length, 1);
    assert.equal(helper.__responses[0].err, undefined);
    assert.equal(helper.__responses[0].data.action, "GET_CHANGELOG");
    assert.equal(helper.__responses[0].data.module, "test-module");
    assert.ok(helper.__responses[0].data.changelog.includes("# Changelog"));
    assert.ok(helper.__responses[0].data.changelog.includes("Initial release"));
  });

  test("returns error when changelog not found", async () => {
    const helper = freshHelper();
    helper.answerGetChangelog = helperFactory.answerGetChangelog.bind(helper);
    const mockRes = {
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    await helper.answerGetChangelog({module: "nonexistent-module"}, mockRes);

    assert.equal(helper.__responses.length, 1);
    assert.ok(helper.__responses[0].err instanceof Error);
    assert.equal(helper.__responses[0].err.message, "Changelog not found");
    assert.equal(helper.__responses[0].data.action, "GET_CHANGELOG");
  });

  test("includes query in error response", async () => {
    const helper = freshHelper();
    helper.answerGetChangelog = helperFactory.answerGetChangelog.bind(helper);
    const mockRes = {};
    const query = {module: "missing-module", other: "data"};

    await helper.answerGetChangelog(query, mockRes);

    assert.equal(helper.__responses[0].data.query, query);
  });
});
