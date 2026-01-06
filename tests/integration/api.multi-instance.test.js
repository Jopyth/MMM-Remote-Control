const assert = require("node:assert/strict");
const {describe, test, before, after} = require("node:test");
const express = require("express");
const path = require("node:path");
const ModuleLib = require("node:module");

// Ensure shims resolve like unit tests
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

/**
 * Integration test for multi-instance module handling.
 * Tests the bug where SHOW/HIDE on multiple instances of the same module
 * causes "Cannot set headers after they are sent to the client" error.
 *
 * Issue: https://forum.magicmirror.builders/topic/20022/mmm-remote-control/35?_=1767691040166
 *
 * The bug occurs in answerModuleApi() when it loops through multiple
 * module instances and calls executeQuery() -> handleSimpleSocketNotification() ->
 * sendResponse() for each instance, attempting to send the HTTP response multiple times.
 */

/**
 * Create mock context with bound methods for testing
 * @param {object} app - Express app
 * @param {Array} notifications - Notifications array to capture socket notifications
 * @returns {object} Mock context object
 */
function createMockContext (app, notifications) {
  const apiModule = require("../../API/api.js");
  const helperModule = require("../../node_helper.js");

  const mockContext = {
    expressApp: app,
    expressRouter: express.Router(),
    externalApiRoutes: {},
    moduleApiMenu: {},
    configData: {
      moduleData: [
        // Simulate two instances of MMM-MotionEye
        {
          identifier: "module_0_MMM-MotionEye",
          name: "MMM-MotionEye",
          index: 0,
          hidden: false
        },
        {
          identifier: "module_1_MMM-MotionEye",
          name: "MMM-MotionEye",
          index: 1,
          hidden: false
        },
        // Simulate three instances of MMM-homeassistant-sensors
        {
          identifier: "module_2_MMM-homeassistant-sensors",
          name: "MMM-homeassistant-sensors",
          index: 0,
          hidden: false
        },
        {
          identifier: "module_3_MMM-homeassistant-sensors",
          name: "MMM-homeassistant-sensors",
          index: 1,
          hidden: false
        },
        {
          identifier: "module_4_MMM-homeassistant-sensors",
          name: "MMM-homeassistant-sensors",
          index: 2,
          hidden: false
        }
      ]
    },
    configOnHd: {
      modules: []
    },
    thisConfig: {},
    initialized: true,
    apiKey: undefined,
    secureEndpoints: false,

    // Capture socket notifications
    sendSocketNotification (what, payload) {
      notifications.push({what, payload});
    },

    // Bind helper methods
    modulesAvailable: [],
    translation: {},
    answerGet: helperModule.answerGet,
    handleGetModuleAvailable: helperModule.handleGetModuleAvailable,
    handleGetModuleInstalled: helperModule.handleGetModuleInstalled,
    getDataHandlers: helperModule.getDataHandlers,
    sendResponse: helperModule.sendResponse,
    checkInitialized: helperModule.checkInitialized,
    getActionHandlers: helperModule.getActionHandlers,
    executeQuery: helperModule.executeQuery,
    handleSimpleSocketNotification: helperModule.handleSimpleSocketNotification,
    handleSimpleValueNotification: helperModule.handleSimpleValueNotification,
    handleSimpleNotification: helperModule.handleSimpleNotification,
    checkDelay: helperModule.checkDelay,

    // Bind API methods
    answerNotifyApi: apiModule.answerNotifyApi,
    answerModuleApi: apiModule.answerModuleApi,
    mergeData: apiModule.mergeData,

    getApiKey () {
      // No API key for test
    },

    delayedQuery () {
      // Stub - not tested
    },

    getExternalApiByGuessing () {
      // Stub - module API guessing not needed for test
    },

    updateModuleApiMenu () {
      // Stub - menu update not needed for test
    }
  };

  // Bind all methods to context
  mockContext.answerGet = mockContext.answerGet.bind(mockContext);
  mockContext.handleGetModuleAvailable = mockContext.handleGetModuleAvailable.bind(mockContext);
  mockContext.handleGetModuleInstalled = mockContext.handleGetModuleInstalled.bind(mockContext);
  mockContext.getDataHandlers = mockContext.getDataHandlers.bind(mockContext);
  mockContext.sendResponse = mockContext.sendResponse.bind(mockContext);
  mockContext.checkInitialized = mockContext.checkInitialized.bind(mockContext);
  mockContext.getActionHandlers = mockContext.getActionHandlers.bind(mockContext);
  mockContext.executeQuery = mockContext.executeQuery.bind(mockContext);
  mockContext.handleSimpleSocketNotification = mockContext.handleSimpleSocketNotification.bind(mockContext);
  mockContext.handleSimpleValueNotification = mockContext.handleSimpleValueNotification.bind(mockContext);
  mockContext.handleSimpleNotification = mockContext.handleSimpleNotification.bind(mockContext);
  mockContext.checkDelay = mockContext.checkDelay.bind(mockContext);
  mockContext.answerNotifyApi = mockContext.answerNotifyApi.bind(mockContext);
  mockContext.answerModuleApi = mockContext.answerModuleApi.bind(mockContext);
  mockContext.mergeData = mockContext.mergeData.bind(mockContext);

  return mockContext;
}

describe("API Multi-Instance Module Tests", () => {
  let server;
  let port;
  let baseUrl;
  const notifications = [];
  let mockContext;

  before(async () => {
    // Mock MagicMirror globals
    globalThis.Module = {
      configDefaults: {},
      _resolveFilename: require.resolve
    };
    globalThis.Log = {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };

    // Setup minimal Express app
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));

    // Create mock context
    const apiModule = require("../../API/api.js");
    mockContext = createMockContext(app, notifications);

    // Bind API routes
    apiModule.createApiRoutes.call(mockContext);
    app.use("/api", mockContext.expressRouter);

    // Start server on random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test("SHOW on multi-instance module should not throw 'headers already sent' error", async () => {
    notifications.length = 0;

    const response = await fetch(`${baseUrl}/api/module/MMM-MotionEye/SHOW`, {
      method: "GET"
    });

    // Should not throw error
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);

    // Should send notification for both instances
    const showNotifications = notifications.filter((n) => n.what === "SHOW");
    assert.equal(showNotifications.length, 2, "Should send SHOW notification for both instances");
    assert.equal(showNotifications[0].payload.module, "module_0_MMM-MotionEye");
    assert.equal(showNotifications[1].payload.module, "module_1_MMM-MotionEye");
  });

  test("HIDE on multi-instance module should not throw 'headers already sent' error", async () => {
    notifications.length = 0;

    const response = await fetch(`${baseUrl}/api/module/MMM-homeassistant-sensors/HIDE`, {
      method: "GET"
    });

    // Should not throw error
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);

    // Should send notification for all three instances
    const hideNotifications = notifications.filter((n) => n.what === "HIDE");
    assert.equal(hideNotifications.length, 3, "Should send HIDE notification for all three instances");
    assert.equal(hideNotifications[0].payload.module, "module_2_MMM-homeassistant-sensors");
    assert.equal(hideNotifications[1].payload.module, "module_3_MMM-homeassistant-sensors");
    assert.equal(hideNotifications[2].payload.module, "module_4_MMM-homeassistant-sensors");
  });

  test("TOGGLE on multi-instance module should not throw 'headers already sent' error", async () => {
    notifications.length = 0;

    const response = await fetch(`${baseUrl}/api/module/MMM-MotionEye/TOGGLE`, {
      method: "POST"
    });

    // Should not throw error
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);

    // Should send notification for both instances
    const toggleNotifications = notifications.filter((n) => n.what === "TOGGLE");
    assert.equal(toggleNotifications.length, 2, "Should send TOGGLE notification for both instances");
  });

  test("FORCE (SHOW with force flag) on multi-instance module should not throw error", async () => {
    notifications.length = 0;

    const response = await fetch(`${baseUrl}/api/module/MMM-homeassistant-sensors/FORCE`, {
      method: "GET"
    });

    // Should not throw error
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);

    // Should send SHOW notification with force flag for all three instances
    const showNotifications = notifications.filter((n) => n.what === "SHOW");
    assert.equal(showNotifications.length, 3, "Should send SHOW notification for all three instances");
    assert.equal(showNotifications[0].payload.force, true);
    assert.equal(showNotifications[1].payload.force, true);
    assert.equal(showNotifications[2].payload.force, true);
  });

  test("Single instance module should work normally", async () => {
    // Add a single instance module to configData
    const originalModuleData = mockContext.configData.moduleData;
    mockContext.configData.moduleData = [
      ...originalModuleData,
      {
        identifier: "module_5_clock",
        name: "clock",
        index: 0,
        hidden: false
      }
    ];

    notifications.length = 0;

    const response = await fetch(`${baseUrl}/api/module/clock/SHOW`, {
      method: "GET"
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);

    // Should send notification for single instance
    const showNotifications = notifications.filter((n) => n.what === "SHOW");
    assert.ok(showNotifications.length > 0, "Should send SHOW notification for clock module");

    // Restore original moduleData
    mockContext.configData.moduleData = originalModuleData;
  });
});
