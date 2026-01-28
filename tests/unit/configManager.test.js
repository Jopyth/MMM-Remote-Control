const assert = require("node:assert/strict");
const { describe, test, beforeEach, afterEach } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

// Setup global Module mock
globalThis.Module = {
  configDefaults: {
    clock: { timeFormat: 24, showPeriod: false },
    calendar: { maximumEntries: 10 }
  }
};

const configManager = require("../../lib/configManager.js");

// Helper functions for tests
const translateCallback = data => data.replace("%%TRANSLATE:HELLO%%", "Hello");
const identityTranslate = data => data;

describe("configManager.getConfigPath", () => {
  test("returns default config path when globalThis.configuration_file undefined", () => {
    const originalConfigFile = globalThis.configuration_file;
    delete globalThis.configuration_file;

    const result = configManager.getConfigPath("/test/modules/test-module");

    assert.equal(result, path.resolve("/test/modules/test-module/../../config/config.js"));

    if (originalConfigFile !== undefined) {
      globalThis.configuration_file = originalConfigFile;
    }
  });

  test("returns custom config path when globalThis.configuration_file set", () => {
    const originalConfigFile = globalThis.configuration_file;
    globalThis.configuration_file = "custom/myconfig.js";

    const result = configManager.getConfigPath("/test/modules/test-module");

    assert.equal(result, path.resolve("/test/modules/test-module/../../custom/myconfig.js"));

    if (originalConfigFile === undefined) {
      delete globalThis.configuration_file;
    } else {
      globalThis.configuration_file = originalConfigFile;
    }
  });
});

describe("configManager.getConfig", () => {
  test("merges module defaults into config", () => {
    const configOnHd = {
      modules: [
        { module: "clock", config: { timeFormat: 12 } },
        { module: "calendar", config: {} }
      ]
    };
    const configData = { moduleData: [] };

    const result = configManager.getConfig(configOnHd, configData);

    // User value preserved
    assert.equal(result.modules[0].config.timeFormat, 12);
    // Default added
    assert.equal(result.modules[0].config.showPeriod, false);
    // All defaults added
    assert.equal(result.modules[1].config.maximumEntries, 10);
  });

  test("handles moduleDataFromBrowser for bundled modules", () => {
    const configOnHd = {
      modules: [{ module: "custom-module", config: {} }]
    };
    const configData = {
      moduleData: [{ name: "custom-module", config: { bundledOption: true } }]
    };

    const result = configManager.getConfig(configOnHd, configData);

    assert.equal(result.modules[0].config.bundledOption, true);
  });

  test("creates config object when missing", () => {
    const configOnHd = {
      modules: [{ module: "test-module" }]
    };
    const configData = { moduleData: [] };

    const result = configManager.getConfig(configOnHd, configData);

    assert.ok(result.modules[0].config);
    assert.deepEqual(result.modules[0].config, {});
  });
});

describe("configManager.findBestBackupSlot", () => {
  const originalFs = {};

  beforeEach(() => {
    originalFs.stat = fs.promises.stat;
  });

  afterEach(() => {
    fs.promises.stat = originalFs.stat;
  });

  test("selects oldest backup when all slots exist", async () => {
    const mtimes = {
      1: new Date("2025-01-03T10:00:00Z"),
      2: new Date("2025-01-01T10:00:00Z"), // oldest
      3: new Date("2025-01-02T15:00:00Z"),
      4: new Date("2025-01-02T10:00:00Z")
    };

    fs.promises.stat = async (filePath) => {
      const match = (/backup(\d)/u).exec(filePath);
      if (match && mtimes[Number(match[1])]) {
        return { mtime: mtimes[Number(match[1])] };
      }
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    };

    const result = await configManager.findBestBackupSlot();

    assert.equal(result.slot, 2);
    assert.deepEqual(result.mtime, mtimes[2]);
  });

  test("selects empty slot over old backups", async () => {
    fs.promises.stat = async (filePath) => {
      const match = (/backup(\d)/u).exec(filePath);
      if (!match) {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }

      const slot = Number(match[1]);
      if (slot === 2) {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }

      return { mtime: new Date("2020-01-01T10:00:00Z") };
    };

    const result = await configManager.findBestBackupSlot();

    assert.equal(result.slot, 2);
    assert.deepEqual(result.mtime, new Date(0));
  });

  test("handles all slots missing", async () => {
    fs.promises.stat = async () => {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    };

    const result = await configManager.findBestBackupSlot();

    assert.equal(result.slot, 1);
    assert.deepEqual(result.mtime, new Date(0));
  });
});

describe("configManager.loadTranslation", () => {
  const originalFs = {};

  beforeEach(() => {
    originalFs.readFile = fs.promises.readFile;
  });

  afterEach(() => {
    fs.promises.readFile = originalFs.readFile;
  });

  test("merges translation from file into existing translations", async () => {
    fs.promises.readFile = async (filePath, encoding) => {
      assert.equal(encoding, "utf8");
      if (filePath.includes("de.json")) {
        return JSON.stringify({ HELLO: "Hallo", WORLD: "Welt" });
      }
      throw new Error("File not found");
    };

    const currentTranslation = { GREETING: "Hi" };
    const result = await configManager.loadTranslation("/test/module", "de", currentTranslation);

    assert.equal(result.GREETING, "Hi");
    assert.equal(result.HELLO, "Hallo");
    assert.equal(result.WORLD, "Welt");
  });

  test("returns unchanged translation when file missing", async () => {
    fs.promises.readFile = async () => {
      const error = new Error("File not found");
      error.code = "ENOENT";
      throw error;
    };

    const currentTranslation = { GREETING: "Hi" };
    const result = await configManager.loadTranslation("/test/module", "de", currentTranslation);

    assert.deepEqual(result, currentTranslation);
  });

  test("returns empty object when no current translation provided", async () => {
    fs.promises.readFile = async () => JSON.stringify({ HELLO: "Hello" });

    const result = await configManager.loadTranslation("/test/module", "en");

    assert.equal(result.HELLO, "Hello");
  });
});

describe("configManager.loadDefaultSettings", () => {
  const originalFs = {};

  beforeEach(() => {
    originalFs.readFile = fs.promises.readFile;
  });

  afterEach(() => {
    fs.promises.readFile = originalFs.readFile;
  });

  test("returns parsed settings when file exists", async () => {
    const settingsData = {
      moduleData: [{ identifier: "test", hidden: false }],
      brightness: 100,
      temp: 20
    };

    fs.promises.readFile = async (filePath, encoding) => {
      assert.equal(encoding, "utf8");
      assert.ok(filePath.includes("settings.json"));
      return JSON.stringify(settingsData);
    };

    const result = await configManager.loadDefaultSettings("/test/module");

    assert.deepEqual(result, settingsData);
  });

  test("returns null when file does not exist", async () => {
    fs.promises.readFile = async () => {
      const error = new Error("File not found");
      error.code = "ENOENT";
      throw error;
    };

    const result = await configManager.loadDefaultSettings("/test/module");

    assert.equal(result, null);
  });
});

describe("configManager.saveDefaultSettings", () => {
  const originalFs = {};

  beforeEach(() => {
    originalFs.writeFile = fs.promises.writeFile;
  });

  afterEach(() => {
    fs.promises.writeFile = originalFs.writeFile;
  });

  test("saves minimal module data to settings.json", async () => {
    let savedPath;
    let savedContent;

    fs.promises.writeFile = async (filePath, content, encoding) => {
      savedPath = filePath;
      savedContent = content;
      assert.equal(encoding, "utf8");
    };

    const configData = {
      moduleData: [
        {
          identifier: "module_1_clock",
          hidden: false,
          lockStrings: [],
          urlPath: "clock",
          extraField: "should be removed"
        }
      ],
      brightness: 75,
      temp: 22,
      settingsVersion: "1.0"
    };

    await configManager.saveDefaultSettings("/test/module", configData);

    assert.ok(savedPath.includes("settings.json"));
    const parsed = JSON.parse(savedContent);
    assert.equal(parsed.brightness, 75);
    assert.equal(parsed.temp, 22);
    assert.equal(parsed.settingsVersion, "1.0");
    assert.equal(parsed.moduleData.length, 1);
    assert.equal(parsed.moduleData[0].identifier, "module_1_clock");
    assert.equal(parsed.moduleData[0].hidden, false);
    // Extra field should not be saved
    assert.equal(parsed.moduleData[0].extraField, undefined);
  });
});

describe("configManager.loadCustomMenus", () => {
  const originalFs = {};

  beforeEach(() => {
    originalFs.readFile = fs.promises.readFile;
  });

  afterEach(() => {
    fs.promises.readFile = originalFs.readFile;
  });

  test("loads and translates custom menu when configured", async () => {
    fs.promises.readFile = async (filePath) => {
      assert.ok(filePath.includes("custom.json"));
      return JSON.stringify({
        menu: { items: [{ text: "%%TRANSLATE:HELLO%%" }] }
      });
    };

    const thisConfig = { customMenu: "custom.json" };

    const result = await configManager.loadCustomMenus("/test/module", thisConfig, translateCallback);

    assert.ok(result);
    assert.equal(result.menu.items[0].text, "Hello");
  });

  test("returns null when customMenu not configured", async () => {
    const thisConfig = {};

    const result = await configManager.loadCustomMenus("/test/module", thisConfig, identityTranslate);

    assert.equal(result, null);
  });

  test("returns null when file not found", async () => {
    fs.promises.readFile = async () => {
      const error = new Error("File not found");
      error.code = "ENOENT";
      throw error;
    };

    const thisConfig = { customMenu: "missing.json" };

    const result = await configManager.loadCustomMenus("/test/module", thisConfig, identityTranslate);

    assert.equal(result, null);
  });
});
