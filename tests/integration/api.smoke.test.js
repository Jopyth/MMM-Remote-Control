const assert = require("node:assert/strict");
const { describe, test, before, after } = require("node:test");
const express = require("express");
const path = require("node:path");
const ModuleLib = require("node:module");

// Ensure shims resolve like unit tests
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

/**
 * HTTP-layer smoke test for API endpoints.
 * Tests Express routing and API contracts without full MagicMirror runtime.
 *
 * Scope: HTTP-layer verification, NOT end-to-end integration.
 *
 * What this tests:
 * - Express route wiring (paths, parameters)
 * - Middleware execution (JSON parsing, auth)
 * - API response contracts (status codes, JSON structure)
 * - Error handling (400/403 responses)
 *
 * What this does NOT test:
 * - Actual MagicMirror module interaction
 * - Socket notification delivery to frontend
 * - Config file loading from disk
 * - Module lifecycle (show/hide real modules)
 *
 * Purpose: Catch API contract breakage and Express configuration bugs
 * while remaining CI-compatible (no browser/Electron needed).
 *
 * Mocked:
 * - MagicMirror globals (Module, Log)
 * - Socket notifications (captured, not sent)
 * - File system operations
 *
 * Real:
 * - Express app and routing
 * - HTTP requests/responses
 * - JSON parsing
 * - Middleware execution
 */

describe("API HTTP-Layer Smoke Tests", () => {
  let server;
  let port;
  let baseUrl;
  const notifications = [];

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
    app.use(express.urlencoded({ extended: true }));

    // Load required modules
    const apiModule = require("../../API/api.js");
    const helperModule = require("../../node_helper.js");

    // Create minimal context for API
    const mockContext = {
      expressApp: app,
      expressRouter: express.Router(),
      externalApiRoutes: {},
      moduleApiMenu: {},
      configData: {
        moduleData: []
      },
      configOnHd: {
        modules: []
      },
      thisConfig: {},
      initialized: true,
      apiKey: undefined, // No auth for smoke test
      secureEndpoints: false,

      // Capture socket notifications
      sendSocketNotification(what, payload) {
        notifications.push({ what, payload });
      },

      // Minimal response handler
      sendResponse(res, error, data) {
        let response = { success: true };
        let status = 200;
        if (error) {
          response = { success: false, status: "error", reason: "unknown", info: error };
          status = 400;
        }
        if (data) {
          response = { ...response, ...data };
        }
        res.status(status).json(response);
        return !error;
      },

      checkInitialized(res) {
        if (!this.initialized) {
          this.sendResponse(res, new Error("System not initialized"));
          return false;
        }
        return true;
      },

      getApiKey() {
        // No API key for smoke test
      },

      delayedQuery() {
        // Stub - not tested in smoke
      },

      getExternalApiByGuessing() {
        // Stub - module API guessing not needed for smoke test
      },

      updateModuleApiMenu() {
        // Stub - menu update not needed for smoke test
      },

      // Bind helper methods
      modulesAvailable: [],
      translation: {},
      answerGet: helperModule.answerGet,
      handleGetModuleAvailable: helperModule.handleGetModuleAvailable,
      handleGetModuleInstalled: helperModule.handleGetModuleInstalled,
      getDataHandlers: helperModule.getDataHandlers,

      // Bind API methods
      answerNotifyApi: apiModule.answerNotifyApi,
      answerModuleApi: apiModule.answerModuleApi
    };

    // Bind all methods to context
    mockContext.answerGet = mockContext.answerGet.bind(mockContext);
    mockContext.handleGetModuleAvailable = mockContext.handleGetModuleAvailable.bind(mockContext);
    mockContext.handleGetModuleInstalled = mockContext.handleGetModuleInstalled.bind(mockContext);
    mockContext.getDataHandlers = mockContext.getDataHandlers.bind(mockContext);
    mockContext.answerNotifyApi = mockContext.answerNotifyApi.bind(mockContext);
    mockContext.answerModuleApi = mockContext.answerModuleApi.bind(mockContext);

    // Bind API methods to context
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

  test("GET /api/test returns success", async () => {
    const response = await fetch(`${baseUrl}/api/test`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(data.success, true);
  });

  test("POST /api/notification sends socket notification", async () => {
    notifications.length = 0; // Clear previous

    const response = await fetch(`${baseUrl}/api/notification/TEST_NOTIFICATION`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.notification, "TEST_NOTIFICATION");
    assert.deepEqual(data.payload, { foo: "bar" });

    // Verify socket notification was captured
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].what, "NOTIFICATION");
    assert.equal(notifications[0].payload.notification, "TEST_NOTIFICATION");
  });

  test("GET /api/config returns config structure", async () => {
    const response = await fetch(`${baseUrl}/api/config`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.query.data, "config");
    assert.equal(typeof data.data, "object");
    assert.ok(Array.isArray(data.data.modules), "config should have modules array");
  });

  test("POST without Content-Type application/json returns 400", async () => {
    const response = await fetch(`${baseUrl}/api/notification/TEST`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "invalid"
    });
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /content-type/i);
  });

  test("GET /api/module/available returns sorted module list", async () => {
    const response = await fetch(`${baseUrl}/api/module/available`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data), "should return array of modules");
  });
});
