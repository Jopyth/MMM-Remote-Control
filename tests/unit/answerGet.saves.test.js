const assert = require("node:assert/strict");
const {describe, test, beforeEach, afterEach} = require("node:test");
const path = require("node:path");
const ModuleLib = require("node:module");

// Ensure shims resolve like other tests
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const helper = Object.assign({}, helperFactory);
  helper.__responses = [];
  helper.sendResponse = function (_res, error, payload) {
    this.__responses.push({error, payload});
    return !error;
  };
  helper.handleGetSaves = helperFactory.handleGetSaves.bind(helper);
  return helper;
}

describe("/api/saves contract", () => {
  const originalFs = {};
  const fs = require("node:fs");

  beforeEach(() => {
    originalFs.statSync = fs.statSync;
  });

  afterEach(() => {
    fs.statSync = originalFs.statSync;
  });

  test("returns backup timestamps in descending order (newest first)", () => {
    const helper = freshHelper();

    // Mock 3 backups with different timestamps
    const oldTime = new Date("2025-01-01T10:00:00Z");
    const middleTime = new Date("2025-01-02T15:00:00Z");
    const newestTime = new Date("2025-01-03T20:00:00Z");

    fs.statSync = (filePath) => {
      if (filePath.includes("backup4")) {
        return {mtime: oldTime};
      }
      if (filePath.includes("backup3")) {
        return {mtime: newestTime};
      }
      if (filePath.includes("backup2")) {
        return {mtime: middleTime};
      }
      if (filePath.includes("backup1")) {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }
      throw new Error("Unexpected file path");
    };

    helper.handleGetSaves({data: "saves"}, {});

    assert.equal(helper.__responses.length, 1);
    const {payload} = helper.__responses[0];
    assert.equal(payload.query.data, "saves");
    assert.ok(Array.isArray(payload.data));
    assert.equal(payload.data.length, 3);

    // Verify descending order (newest first)
    assert.deepEqual(payload.data, [newestTime, middleTime, oldTime]);
  });

  test("skips missing backup files (ENOENT)", () => {
    const helper = freshHelper();

    const time1 = new Date("2025-01-01T10:00:00Z");

    fs.statSync = (filePath) => {
      if (filePath.includes("backup4")) {
        return {mtime: time1};
      }
      // All others missing
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    };

    helper.handleGetSaves({data: "saves"}, {});

    const {payload} = helper.__responses[0];
    assert.equal(payload.data.length, 1);
    assert.deepEqual(payload.data, [time1]);
  });

  test("returns empty array when no backups exist", () => {
    const helper = freshHelper();

    fs.statSync = () => {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    };

    helper.handleGetSaves({data: "saves"}, {});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.data, []);
  });

  test("checks backup files 1-4 (not backup0)", () => {
    const helper = freshHelper();
    const checkedFiles = [];

    fs.statSync = (filePath) => {
      checkedFiles.push(path.basename(filePath));
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    };

    helper.handleGetSaves({data: "saves"}, {});

    // Should check backup4, backup3, backup2, backup1 (not backup0)
    assert.deepEqual(checkedFiles, [
      "config.js.backup4",
      "config.js.backup3",
      "config.js.backup2",
      "config.js.backup1"
    ]);
  });
});
