const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("MMM-Remote-Control.js module", () => {
  let window, Module;

  before(() => {
    window = new Window({
      url: "http://localhost:8080",
      settings: {
        disableJavaScriptFileLoading: true,
        disableJavaScriptEvaluation: false,
        disableCSSFileLoading: true
      }
    });

    window.Module = {
      register: function (moduleName, moduleDefinition) {
        Module = moduleDefinition;
      }
    };

    window.MM = {
      getModules: () => ({
        enumerate: () => {}
      })
    };

    window.Log = {
      info: () => {},
      log: () => {},
      error: () => {},
      warn: () => {}
    };

    window.location = { hash: "" };
    window.globalThis = window;

    const modulePath = path.join(__dirname, "../../MMM-Remote-Control.js");
    const moduleCode = fs.readFileSync(modulePath, "utf8");
    const context = vm.createContext(window);
    vm.runInContext(moduleCode, context);
  });

  after(() => {
    window.close();
  });

  test("module is registered with Module.register", () => {
    assert.ok(Module, "Module should be defined");
    assert.ok(Module.handleDefaultSettings, "handleDefaultSettings should exist");
  });

  test("handleDefaultSettings handles missing lockStrings gracefully", () => {
    const payload = {
      settingsVersion: 1,
      moduleData: [
        { identifier: "module_1", name: "clock" },
        { identifier: "module_2", name: "calendar", lockStrings: ["lock1"] },
        { identifier: "module_3", name: "weather", lockStrings: undefined }
      ],
      brightness: 100,
      temp: 327
    };

    assert.doesNotThrow(() => {
      Module.handleDefaultSettings.call({
        identifier: "MMM-Remote-Control",
        settingsVersion: 1,
        setBrightness: () => {},
        setTemp: () => {}
      }, payload);
    });
  });

  test("handleDefaultSettings handles non-array lockStrings", () => {
    const payload = {
      settingsVersion: 1,
      moduleData: [{ identifier: "module_1", name: "clock", lockStrings: "not-an-array" }],
      brightness: 100,
      temp: 327
    };

    assert.doesNotThrow(() => {
      Module.handleDefaultSettings.call({
        identifier: "MMM-Remote-Control",
        settingsVersion: 1,
        setBrightness: () => {},
        setTemp: () => {}
      }, payload);
    });
  });
});
