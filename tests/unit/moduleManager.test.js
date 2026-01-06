/**
 * @file Tests for moduleManager.js
 */

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const moduleManager = require("../../lib/moduleManager.js");

describe("lib/moduleManager exports", () => {
  it("should export updateModuleList function", () => {
    assert.strictEqual(typeof moduleManager.updateModuleList, "function");
  });

  it("should export readModuleData function", () => {
    assert.strictEqual(typeof moduleManager.readModuleData, "function");
  });

  it("should export addModule function", () => {
    assert.strictEqual(typeof moduleManager.addModule, "function");
  });

  it("should export checkModuleUpdate function", () => {
    assert.strictEqual(typeof moduleManager.checkModuleUpdate, "function");
  });

  it("should export loadModuleDefaultConfig function", () => {
    assert.strictEqual(typeof moduleManager.loadModuleDefaultConfig, "function");
  });

  it("should export installModule function", () => {
    assert.strictEqual(typeof moduleManager.installModule, "function");
  });

  it("should export updateModule function", () => {
    assert.strictEqual(typeof moduleManager.updateModule, "function");
  });
});

describe("lib/moduleManager basic functionality", () => {
  it("readModuleData should handle missing modules.json", async () => {
    try {
      await moduleManager.readModuleData("/nonexistent", "modules", null);
      assert.fail("Should have thrown error");
    } catch (error) {
      assert.ok(error.code === "ENOENT" || error.message.includes("ENOENT"));
    }
  });

  it("loadModuleDefaultConfig should handle missing module file", async () => {
    const module = {name: "nonexistent-module"};
    // Should not throw - errors are caught internally
    await assert.doesNotReject(async () => {
      await moduleManager.loadModuleDefaultConfig(module, "/nonexistent/path");
    });
  });

  it("updateModule should handle unknown module", async () => {
    let errorCalled = false;
    await moduleManager.updateModule({
      moduleName: "NonExistent",
      baseDir: __dirname,
      modulesAvailable: [],
      onSuccess: null,
      onError: () => {
        errorCalled = true;
      }
    });
    assert.strictEqual(errorCalled, true);
  });

  it("addModule should handle non-directory path", async () => {
    const modulesAvailable = [];
    const modulesInstalled = [];

    // Should not throw - errors are caught internally
    await assert.doesNotReject(async () => {
      await moduleManager.addModule({
        directoryName: "test-file.txt",
        modulesDir: __dirname,
        modulesAvailable,
        modulesInstalled,
        onModuleLoaded: null,
        onUpdateCheckQueued: null,
        isLast: true
      });
    });
  });
});
