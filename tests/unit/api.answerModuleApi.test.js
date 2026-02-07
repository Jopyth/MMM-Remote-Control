const assert = require("node:assert/strict");
const {test, describe} = require("node:test");

const apiModule = require("../../API/api.js");

function makeContext (overrides = {}) {
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
    thisConfig: {},
    ...overrides
  };
}

describe("Module API", () => {
  test("DEFAULTS action requests defaultConfig via answerGet", () => {
    const captured = {};
    const context = makeContext({
      mergeData: () => ({success: true, data: [{identifier: "module_1_weather", name: "weather", urlPath: "weather", actions: {}}]}),
      answerGet: (query, res) => {
        captured.query = query;
        if (res && res.json) res.json({ok: true});
      }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "weather", action: "defaults"}};
    const res = {status: () => ({json: () => {}}), json: () => {}};
    answerModuleApi(request, res);

    assert.deepEqual(captured.query, {data: "defaultConfig", module: "weather"});
  });

  test("SHOW action on 'all' triggers executeQuery with module all", () => {
    const captured = {};
    const context = makeContext({
      // Minimal module data so filtering passes when moduleName === 'all'
      configData: {moduleData: [{identifier: "module_1_test", name: "test", urlPath: "test"}]},
      executeQuery: (query) => { captured.query = query; },
      sendSocketNotification: () => {},
      // No delay in this test
      checkDelay: (q) => q
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "all", action: "show"}};
    const res = {json: () => {}};
    answerModuleApi(request, res);

    assert.equal(captured.query.action, "SHOW");
    assert.equal(captured.query.module, "all");
  });

  test("module not found returns 400 with error message", () => {
    const captured = {};
    const context = makeContext({
      configData: {moduleData: [{identifier: "module_1_clock", name: "clock", urlPath: "clock"}]},
      mergeData: function () { return {success: true, data: this.configData.moduleData}; }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "NonExistentModule", action: "show"}};
    const res = {
      status: (code) => {
        captured.status = code;
        return {json: (data) => { captured.response = data; }};
      },
      json: () => {}
    };
    answerModuleApi(request, res);

    assert.equal(captured.status, 400);
    assert.equal(captured.response.success, false);
    assert.ok(captured.response.message.includes("Not Found"));
  });

  test("module without actions property returns 400", () => {
    const captured = {};
    const context = makeContext({
      configData: {moduleData: [{identifier: "module_1_custommod", name: "custommod"}]},
      mergeData: function () { return {success: true, data: this.configData.moduleData}; }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "custommod", action: "someaction"}};
    const res = {
      status: (code) => {
        captured.status = code;
        return {json: (data) => { captured.response = data; }};
      },
      json: () => {}
    };

    answerModuleApi(request, res);

    // Should return 400 error when module has no actions property
    assert.equal(captured.status, 400);
    assert.equal(captured.response.success, false);
    assert.ok(captured.response.message.includes("does not have any actions defined"));
  });

  test("alert/showalert works as special case for default alert module", () => {
    const captured = {};
    const context = makeContext({
      configData: {moduleData: [{identifier: "module_0_alert", name: "alert"}]},
      mergeData: function () { return {success: true, data: this.configData.moduleData}; },
      answerNotifyApi: (request, res, action) => {
        captured.action = action;
        captured.called = true;
      }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "alert", action: "showalert"}, query: {message: "Test", timer: 3000}, method: "GET"};
    const res = {json: () => {}};

    answerModuleApi(request, res);

    // Should call answerNotifyApi with SHOW_ALERT notification
    assert.equal(captured.called, true);
    assert.equal(captured.action.notification, "SHOW_ALERT");
  });

  test("invalid action on custom module returns undefined (no action object)", () => {
    const captured = {};
    const context = makeContext({
      configData: {moduleData: [{identifier: "module_1_custom", name: "CustomModule", urlPath: "custom", actions: {}}]},
      mergeData: function () { return {success: true, data: this.configData.moduleData}; }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "CustomModule", action: "invalidAction"}};
    const res = {
      status: (code) => {
        captured.status = code;
        return {json: (data) => { captured.response = data; }};
      },
      json: () => {}
    };

    answerModuleApi(request, res);

    // Should return 400 error when action doesn't exist
    assert.equal(captured.status, 400);
    assert.equal(captured.response.success, false);
    assert.ok(captured.response.message.includes("Action invalidAction not found"));
  });

  test("custom module API with valid action calls answerNotifyApi", () => {
    const captured = {};
    const context = makeContext({
      configData: {
        moduleData: [
          {
            identifier: "module_1_custom",
            name: "CustomModule",
            urlPath: "custom",
            actions: {customAction: {notification: "CUSTOM_NOTIFICATION"}}
          }
        ]
      },
      mergeData: function () { return {success: true, data: this.configData.moduleData}; },
      answerNotifyApi: (request, res, action) => {
        captured.action = action;
        captured.called = true;
      }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "CustomModule", action: "customAction"}, query: {}};
    const res = {json: () => {}};
    answerModuleApi(request, res);

    assert.equal(captured.called, true);
    assert.equal(captured.action.notification, "CUSTOM_NOTIFICATION");
  });

  test("custom action with wrong HTTP method returns 400", () => {
    const captured = {};
    const context = makeContext({
      configData: {
        moduleData: [
          {
            identifier: "module_1_api",
            name: "APIModule",
            urlPath: "api",
            actions: {postOnly: {notification: "TEST", method: "POST"}}
          }
        ]
      },
      mergeData: function () { return {success: true, data: this.configData.moduleData}; }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "APIModule", action: "postOnly"}, method: "GET", query: {}};
    const res = {
      status: (code) => {
        captured.status = code;
        return {json: (data) => { captured.response = data; }};
      }
    };
    answerModuleApi(request, res);

    assert.equal(captured.status, 400);
    assert.equal(captured.response.success, false);
    assert.ok(captured.response.message.includes("not allowed"));
  });

  test("no moduleName returns all merged data", () => {
    const captured = {};
    const context = makeContext({
      configData: {moduleData: [{identifier: "module_1_test", name: "test"}]},
      mergeData: function () { return {success: true, data: this.configData.moduleData}; }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {}};
    const res = {json: (data) => { captured.response = data; }};
    answerModuleApi(request, res);

    assert.equal(captured.response.success, true);
    assert.ok(Array.isArray(captured.response.data));
    assert.equal(captured.response.data.length, 1);
  });

  test("no action returns filtered moduleData", () => {
    const captured = {};
    const context = makeContext({
      configData: {moduleData: [{identifier: "module_1_clock", name: "clock", urlPath: "clock"}]},
      mergeData: function () { return {success: true, data: this.configData.moduleData}; }
    });
    const answerModuleApi = apiModule.answerModuleApi.bind(context);

    const request = {params: {moduleName: "clock"}};
    const res = {json: (data) => { captured.response = data; }};
    answerModuleApi(request, res);

    assert.equal(captured.response.success, true);
    assert.equal(captured.response.data.length, 1);
    assert.equal(captured.response.data[0].name, "clock");
  });
});
