const assert = require("node:assert/strict");
const {describe, test} = require("node:test");
const path = require("node:path");
const ModuleLib = require("module");

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
  helper.callAfterUpdate = (fn) => fn();
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

    const defaultsMap = global.Module?.configDefaults || {};
    const prevDefaults = defaultsMap["MMM-Test"];
    defaultsMap["MMM-Test"] = {foo: "default"};

    try {
      helper.answerGet({data: "config"});
    } finally {
      if (prevDefaults === undefined) {
        delete defaultsMap["MMM-Test"];
      } else {
        defaultsMap["MMM-Test"] = prevDefaults;
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
});
