const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const group = typeof describe === "function" ? describe : (_n, fn) => fn();

const apiModule = require("../../API/api.js");

function makeCtx (overrides = {}) {
  return {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    externalApiRoutes: {},
    moduleApiMenu: {},
    translation: {},
    configData: {moduleData: []},
    mergeData: function () { return {success: true, data: this.configData.moduleData}; },
    sendSocketNotification: () => {},
    sendResponse: () => {},
    checkInitialized: () => true,
    translate: (s) => s,
    formatName: (s) => s,
    thisConfig: {},
    ...overrides
  };
}

group("Module API", () => {
  test("DEFAULTS action requests defaultConfig via answerGet", () => {
    const captured = {};
    const ctx = makeCtx({
      mergeData: () => ({success: true, data: [{identifier: "module_1_weather", name: "weather", urlPath: "weather", actions: {}}]}),
      answerGet: (query, res) => {
        captured.query = query;
        if (res && res.json) res.json({ok: true});
      }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(ctx);

    const req = {params: {moduleName: "weather", action: "defaults"}};
    const res = {status: () => ({json: () => {}}), json: () => {}};
    answerModuleApi(req, res);

    assert.deepEqual(captured.query, {data: "defaultConfig", module: "weather"});
  });

  test("SHOW action on 'all' triggers executeQuery with module all", () => {
    const captured = {};
    const ctx = makeCtx({
      // Minimal module data so filtering passes when moduleName === 'all'
      configData: {moduleData: [{identifier: "module_1_test", name: "test", urlPath: "test"}]},
      executeQuery: (query) => { captured.query = query; },
      sendSocketNotification: () => {},
      // No delay in this test
      checkDelay: (q) => q
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(ctx);

    const req = {params: {moduleName: "all", action: "show"}};
    const res = {json: () => {}};
    answerModuleApi(req, res);

    assert.equal(captured.query.action, "SHOW");
    assert.equal(captured.query.module, "all");
  });
});
