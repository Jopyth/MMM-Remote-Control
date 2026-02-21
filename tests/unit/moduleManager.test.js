/**
 * @file Tests for moduleManager.js
 */

const {describe, it, before, after, beforeEach, afterEach} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const simpleGit = require("simple-git");
const moduleManager = require("../../lib/moduleManager.js");
const Log = require("../../tests/shims/logger.js");

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
  // Suppress expected error logs for these error-handling tests
  before(() => {
    Log.suppressExpectedErrors(true);
  });

  after(() => {
    Log.suppressExpectedErrors(false);
  });

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

describe("lib/moduleManager additional coverage", () => {
  let tempRoot;

  before(() => {
    Log.suppressExpectedErrors(true);
  });

  after(() => {
    Log.suppressExpectedErrors(false);
  });

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mmm-rc-module-manager-"));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, {recursive: true, force: true});
  });

  it("readModuleData should load custom and default modules using new defaultmodules path", async () => {
    const baseDir = path.join(tempRoot, "runtime", "server");
    const parentDir = path.resolve(`${baseDir}/..`);

    await fs.mkdir(baseDir, {recursive: true});
    await fs.mkdir(path.join(tempRoot, "defaultmodules"), {recursive: true});

    await fs.mkdir(path.join(parentDir, "MMM-Installed"), {recursive: true});
    await fs.mkdir(path.join(parentDir, "node_modules"), {recursive: true});
    await fs.mkdir(path.join(parentDir, "default"), {recursive: true});
    await fs.writeFile(path.join(parentDir, "README.md"), "readme", "utf8");

    await fs.writeFile(path.join(baseDir, "modules.json"), JSON.stringify([{name: "MMM-Custom"}]), "utf8");

    const loadedDefaults = [];

    const result = await moduleManager.readModuleData(baseDir, "modules", (module, modulePath) => {
      loadedDefaults.push({module, modulePath});
    });

    assert.equal(result.modulesAvailable.length, 9);
    assert.equal(result.modulesAvailable[0].name, "MMM-Custom");
    assert.equal(result.modulesAvailable[0].isDefaultModule, false);
    assert.equal(loadedDefaults.length, 8);
    assert.equal(loadedDefaults.every((item) => item.modulePath.startsWith("defaultmodules/")), true);
    assert.equal(result.installedModules.includes("MMM-Installed"), true);
    assert.equal(result.installedModules.includes("node_modules"), false);
    assert.equal(result.installedModules.includes("default"), false);
    assert.equal(result.installedModules.includes("README.md"), false);
  });

  it("readModuleData should fall back to old modules/default path", async () => {
    const baseDir = path.join(tempRoot, "runtime", "server");
    await fs.mkdir(baseDir, {recursive: true});
    await fs.writeFile(path.join(baseDir, "modules.json"), JSON.stringify([]), "utf8");

    const loadedDefaults = [];

    await moduleManager.readModuleData(baseDir, "modules", (module, modulePath) => {
      loadedDefaults.push({module, modulePath});
    });

    assert.equal(loadedDefaults.length, 8);
    assert.equal(loadedDefaults.every((item) => item.modulePath.startsWith("modules/default/")), true);
  });

  it("addModule should mark existing module installed and queue update checks for git modules", async () => {
    const modulesDir = path.join(tempRoot, "modules");
    const directoryName = "MMM-Example";
    const modulePath = path.join(modulesDir, directoryName);

    await fs.mkdir(modulePath, {recursive: true});
    await fs.writeFile(path.join(modulePath, "CHANGELOG.md"), "# Changelog", "utf8");

    const git = simpleGit(modulePath);
    await git.init();
    await git.addRemote("origin", "git@github.com:foo/bar.git");

    const modulesAvailable = [{name: directoryName, installed: false, url: ""}];
    const modulesInstalled = [];
    const loaded = [];
    const queued = [];

    await moduleManager.addModule({
      directoryName,
      modulesDir,
      modulesAvailable,
      modulesInstalled,
      onModuleLoaded: (module, loadedPath, isLast) => {
        loaded.push({module, loadedPath, isLast});
      },
      onUpdateCheckQueued: (entry) => {
        queued.push(entry);
      },
      isLast: true
    });

    assert.deepEqual(modulesInstalled, [directoryName]);
    assert.equal(modulesAvailable[0].installed, true);
    assert.equal(modulesAvailable[0].hasChangelog, true);
    assert.equal(modulesAvailable[0].url, "https://github.com/foo/bar");
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].loadedPath, modulePath);
    assert.equal(loaded[0].isLast, true);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].directoryName, directoryName);
  });

  it("addModule should create local module metadata for non-git modules", async () => {
    const modulesDir = path.join(tempRoot, "modules");
    const directoryName = "MMM-LocalOnly";
    const modulePath = path.join(modulesDir, directoryName);

    await fs.mkdir(modulePath, {recursive: true});

    const modulesAvailable = [];
    const modulesInstalled = [];
    const queued = [];

    await moduleManager.addModule({
      directoryName,
      modulesDir,
      modulesAvailable,
      modulesInstalled,
      onModuleLoaded: null,
      onUpdateCheckQueued: (entry) => {
        queued.push(entry);
      },
      isLast: false
    });

    assert.deepEqual(modulesInstalled, [directoryName]);
    assert.equal(modulesAvailable.length, 1);
    assert.equal(modulesAvailable[0].name, directoryName);
    assert.equal(modulesAvailable[0].id, `local/${directoryName}`);
    assert.equal(modulesAvailable[0].hasChangelog, false);
    assert.equal(queued.length, 0);
  });

  it("updateModule should report up-to-date when no updates are available", async () => {
    const remoteParent = path.join(tempRoot, "git");
    const sourcePath = path.join(tempRoot, "source");
    const modulesParent = path.join(tempRoot, "modules");
    const baseDir = path.join(modulesParent, "server");
    const moduleName = "MMM-UpToDate";
    const remoteName = "origin.git";

    await fs.mkdir(remoteParent, {recursive: true});
    await fs.mkdir(sourcePath, {recursive: true});
    await fs.mkdir(modulesParent, {recursive: true});
    await fs.mkdir(baseDir, {recursive: true});

    const sourceGit = simpleGit(sourcePath);
    await sourceGit.init();
    await sourceGit.addConfig("user.name", "Test User");
    await sourceGit.addConfig("user.email", "test@example.com");
    await fs.writeFile(path.join(sourcePath, "README.md"), "hello", "utf8");
    await sourceGit.add("README.md");
    await sourceGit.commit("initial commit");

    await simpleGit(remoteParent).raw(["init", "--bare", remoteName]);
    await sourceGit.addRemote("origin", path.join(remoteParent, remoteName));
    await sourceGit.raw(["push", "-u", "origin", "HEAD"]);

    await simpleGit(modulesParent).clone(path.join(remoteParent, remoteName), moduleName);

    const responses = [];

    await moduleManager.updateModule({
      moduleName,
      baseDir,
      modulesAvailable: [{name: moduleName}],
      onSuccess: (response) => {
        responses.push(response);
      },
      onError: () => {
        assert.fail("onError should not be called for up-to-date module");
      }
    });

    assert.equal(responses.length, 1);
    assert.equal(responses[0].code, "up-to-date");
    assert.equal(responses[0].info, `${moduleName} already up to date.`);
  });
});
