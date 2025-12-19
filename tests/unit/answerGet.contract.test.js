const assert = require("node:assert/strict");
const {describe, test} = require("node:test");
const path = require("node:path");
const ModuleLib = require("node:module");

// Ensure shims resolve like other tests
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper (overrides = {}) {
  const helper = Object.assign({}, helperFactory);
  helper.__responses = [];
  helper.sendResponse = function (_res, error, payload) {
    this.__responses.push({error, payload});
    return !error;
  };
  helper.modulesAvailable = [];
  helper.translation = {};
  helper.configOnHd = {language: "en", modules: []};
  helper.configData = {moduleData: []};
  helper.sendSocketNotification = () => {};
  helper.checkInitialized = () => true;
  helper.callAfterUpdate = (function_) => function_();
  helper.removeDefaultValues = (config) => config;
  helper.answerGet = helperFactory.answerGet.bind(helper);
  helper.getConfig = helperFactory.getConfig.bind(helper);
  return Object.assign(helper, overrides);
}

describe("answerGet contract coverage", () => {
  test("moduleInstalled returns array of metadata objects", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {name: "MMM-News", longname: "News Feed", installed: true, isDefaultModule: false, repo: "news"},
      {name: "clock", longname: "Clock", installed: true, isDefaultModule: true},
      {name: "MMM-Weather", longname: "Weather", installed: false, isDefaultModule: false}
    ];

    helper.answerGet({data: "moduleInstalled"});

    assert.equal(helper.__responses.length, 1);
    const response = helper.__responses[0].payload;
    assert.ok(Array.isArray(response.data));
    assert.equal(response.data.length, 1, "filters defaults and non-installed modules");
    const [entry] = response.data;
    assert.equal(typeof entry.name, "string");
    assert.equal(typeof entry.longname, "string");
  });

  test("config returns config object with modules array", () => {
    const helper = freshHelper();
    helper.configOnHd = {
      language: "en",
      modules: [
        {module: "MMM-Test", config: {custom: "value"}},
        {module: "clock", config: {}}
      ]
    };
    helper.configData = {moduleData: [{name: "MMM-Test", config: {fizz: "buzz"}}]};

    const defaultsMap = globalThis.Module?.configDefaults || {};
    const previousDefaults = defaultsMap["MMM-Test"];
    defaultsMap["MMM-Test"] = {foo: "default"};

    try {
      helper.answerGet({data: "config"});
    } finally {
      if (previousDefaults === undefined) {
        delete defaultsMap["MMM-Test"];
      } else {
        defaultsMap["MMM-Test"] = previousDefaults;
      }
    }

    assert.equal(helper.__responses.length, 1);
    const {payload} = helper.__responses[0];
    assert.equal(payload.query.data, "config");
    assert.equal(typeof payload.data, "object");
    assert.ok(Array.isArray(payload.data.modules));
    const moduleEntry = payload.data.modules.find((m) => m.module === "MMM-Test");
    assert.ok(moduleEntry, "returns requested module");
    assert.equal(moduleEntry.config.custom, "value");
    assert.equal(moduleEntry.config.foo, "default", "merges module defaults");
  });

  test("translations returns locale dictionary", () => {
    const helper = freshHelper({translation: {en: {HELLO: "hi"}, de: {HELLO: "hallo"}}});

    helper.answerGet({data: "translations"});

    assert.equal(helper.__responses.length, 1);
    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.query, {data: "translations"});
    assert.equal(typeof payload.data, "object");
    assert.equal(typeof payload.data.en, "object");
    assert.equal(payload.data.en.HELLO, "hi");
  });

  test("classes returns MMM-Remote-Control classes config", () => {
    const helper = freshHelper();
    helper.configOnHd = {
      modules: [
        {
          module: "MMM-Remote-Control",
          config: {
            classes: {
              Group1: {show: ["clock"], hide: ["calendar"]},
              Group2: {toggle: ["weather"]}
            }
          }
        }
      ]
    };
    helper.handleGetClasses = helperFactory.handleGetClasses.bind(helper);

    helper.answerGet({data: "classes"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.query, {data: "classes"});
    assert.equal(typeof payload.data, "object");
    assert.ok(payload.data.Group1);
    assert.ok(payload.data.Group2);
    assert.deepEqual(payload.data.Group1, {show: ["clock"], hide: ["calendar"]});
  });

  test("classes returns empty object when no classes configured", () => {
    const helper = freshHelper();
    helper.configOnHd = {
      modules: [{module: "MMM-Remote-Control", config: {}}]
    };
    helper.handleGetClasses = helperFactory.handleGetClasses.bind(helper);

    helper.answerGet({data: "classes"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.data, {});
  });

  test("classes returns empty object when MMM-Remote-Control not in config", () => {
    const helper = freshHelper();
    helper.configOnHd = {modules: [{module: "clock", config: {}}]};
    helper.handleGetClasses = helperFactory.handleGetClasses.bind(helper);

    helper.answerGet({data: "classes"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.data, {});
  });

  test("modules returns moduleData from config", () => {
    const helper = freshHelper();
    helper.configData = {
      moduleData: [
        {identifier: "module_1_clock", name: "clock", hidden: false},
        {identifier: "module_2_calendar", name: "calendar", hidden: true}
      ]
    };
    helper.handleGetModules = helperFactory.handleGetModules.bind(helper);

    helper.answerGet({data: "modules"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.query, {data: "modules"});
    assert.ok(Array.isArray(payload.data));
    assert.equal(payload.data.length, 2);
    assert.equal(payload.data[0].name, "clock");
    assert.equal(payload.data[1].name, "calendar");
  });

  test("brightness returns current brightness value", () => {
    const helper = freshHelper();
    helper.configData = {brightness: 150};
    helper.handleGetBrightness = helperFactory.handleGetBrightness.bind(helper);

    helper.answerGet({data: "brightness"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.query, {data: "brightness"});
    assert.equal(payload.result, 150);
  });

  test("temp returns current temperature value", () => {
    const helper = freshHelper();
    helper.configData = {temp: 6500};
    helper.handleGetTemp = helperFactory.handleGetTemp.bind(helper);

    helper.answerGet({data: "temp"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.query, {data: "temp"});
    assert.equal(payload.result, 6500);
  });

  test("defaultConfig returns module config defaults when module exists", () => {
    const helper = freshHelper();
    helper.handleGetDefaultConfig = helperFactory.handleGetDefaultConfig.bind(helper);

    const defaultsMap = globalThis.Module.configDefaults;
    const previousDefaults = defaultsMap.clock;
    defaultsMap.clock = {timeFormat: 24, showDate: true};

    try {
      helper.answerGet({data: "defaultConfig", module: "clock"});

      const {payload} = helper.__responses[0];
      assert.deepEqual(payload.query, {data: "defaultConfig", module: "clock"});
      assert.deepEqual(payload.data, {timeFormat: 24, showDate: true});
    } finally {
      if (previousDefaults === undefined) {
        delete defaultsMap.clock;
      } else {
        defaultsMap.clock = previousDefaults;
      }
    }
  });

  test("defaultConfig returns empty object when module not found", () => {
    const helper = freshHelper();
    helper.handleGetDefaultConfig = helperFactory.handleGetDefaultConfig.bind(helper);

    helper.answerGet({data: "defaultConfig", module: "unknown"});

    const {payload} = helper.__responses[0];
    assert.deepEqual(payload.query, {data: "defaultConfig", module: "unknown"});
    assert.deepEqual(payload.data, {});
  });
});

describe("answerGet data assembly logic", () => {

  /*
   * These tests verify intentional filtering behavior:
   * - moduleInstalled is used by update/install UI (remote.js:1643)
   * - Default modules (clock, alert) should not appear - they have no repos
   * - Only custom installed modules should be updatable/uninstallable
   */

  test("moduleAvailable sorts all modules by name", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {name: "zebra", installed: true, isDefaultModule: false},
      {name: "alpha", installed: false, isDefaultModule: false},
      {name: "beta", installed: true, isDefaultModule: true}
    ];
    helper.handleGetModuleAvailable = helperFactory.handleGetModuleAvailable.bind(helper);

    helper.answerGet({data: "moduleAvailable"});

    assert.equal(helper.__responses.length, 1);
    const {data} = helper.__responses[0].payload;
    assert.deepEqual(data.map((m) => m.name), ["alpha", "beta", "zebra"]);
  });

  test("moduleAvailable returns all required fields for each module", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {
        longname: "MMM-Example",
        name: "Example",
        isDefaultModule: false,
        installed: true,
        author: "test-author",
        desc: "Test description",
        id: "test/MMM-Example",
        url: "https://example.com"
      },
      {
        longname: "clock",
        name: "Clock",
        isDefaultModule: true,
        installed: true,
        author: "MagicMirrorOrg",
        desc: "",
        id: "MagicMirrorOrg/MagicMirror",
        url: "https://docs.magicmirror.builders"
      }
    ];
    helper.handleGetModuleAvailable = helperFactory.handleGetModuleAvailable.bind(helper);

    helper.answerGet({data: "moduleAvailable"});

    const {data} = helper.__responses[0].payload;
    assert.equal(data.length, 2);

    // Verify all required fields are present and have correct types
    for (const module of data) {
      assert.equal(typeof module.longname, "string", "longname should be string");
      assert.equal(typeof module.name, "string", "name should be string");
      assert.equal(typeof module.isDefaultModule, "boolean", "isDefaultModule should be boolean");
      assert.equal(typeof module.installed, "boolean", "installed should be boolean");
      assert.equal(typeof module.author, "string", "author should be string");
      assert.equal(typeof module.desc, "string", "desc should be string");
      assert.equal(typeof module.id, "string", "id should be string");
      assert.equal(typeof module.url, "string", "url should be string");
    }
  });

  test("moduleAvailable handles optional fields (hasChangelog, defaultConfig)", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {
        longname: "MMM-WithChangelog",
        name: "WithChangelog",
        isDefaultModule: false,
        installed: true,
        author: "test",
        desc: "",
        id: "test/MMM-WithChangelog",
        url: "",
        hasChangelog: true,
        defaultConfig: {option1: "value1"}
      },
      {
        longname: "MMM-WithoutChangelog",
        name: "WithoutChangelog",
        isDefaultModule: false,
        installed: true,
        author: "test",
        desc: "",
        id: "test/MMM-WithoutChangelog",
        url: "",
        hasChangelog: false
      }
    ];
    helper.handleGetModuleAvailable = helperFactory.handleGetModuleAvailable.bind(helper);

    helper.answerGet({data: "moduleAvailable"});

    const {data} = helper.__responses[0].payload;

    // First module should have hasChangelog and defaultConfig
    assert.equal(data[0].hasChangelog, true);
    assert.deepEqual(data[0].defaultConfig, {option1: "value1"});

    // Second module should have hasChangelog but no defaultConfig
    assert.equal(data[1].hasChangelog, false);
    assert.equal(data[1].defaultConfig, undefined);
  });

  test("moduleInstalled filters out default modules", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {name: "MMM-Custom", installed: true, isDefaultModule: false},
      {name: "clock", installed: true, isDefaultModule: true}
    ];
    helper.handleGetModuleInstalled = helperFactory.handleGetModuleInstalled.bind(helper);

    helper.answerGet({data: "moduleInstalled"});

    const {data} = helper.__responses[0].payload;
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "MMM-Custom");
  });

  test("moduleInstalled filters out uninstalled modules", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {name: "MMM-Installed", installed: true, isDefaultModule: false},
      {name: "MMM-NotInstalled", installed: false, isDefaultModule: false}
    ];
    helper.handleGetModuleInstalled = helperFactory.handleGetModuleInstalled.bind(helper);

    helper.answerGet({data: "moduleInstalled"});

    const {data} = helper.__responses[0].payload;
    assert.equal(data.length, 1);
    assert.equal(data[0].name, "MMM-Installed");
  });

  test("moduleInstalled sorts filtered modules by name", () => {
    const helper = freshHelper();
    helper.modulesAvailable = [
      {name: "MMM-Zulu", installed: true, isDefaultModule: false},
      {name: "MMM-Alpha", installed: true, isDefaultModule: false},
      {name: "MMM-Bravo", installed: true, isDefaultModule: false},
      {name: "clock", installed: true, isDefaultModule: true},
      {name: "MMM-NotInstalled", installed: false, isDefaultModule: false}
    ];
    helper.handleGetModuleInstalled = helperFactory.handleGetModuleInstalled.bind(helper);

    helper.answerGet({data: "moduleInstalled"});

    const {data} = helper.__responses[0].payload;
    assert.equal(data.length, 3);
    assert.deepEqual(data.map((m) => m.name), ["MMM-Alpha", "MMM-Bravo", "MMM-Zulu"]);
  });
});
