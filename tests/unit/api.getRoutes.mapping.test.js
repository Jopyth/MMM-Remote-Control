const test = require("node:test");
const assert = require("node:assert/strict");

/*
 * Test contract:
 * - createApiRoutes registers GET routes that map to answerGet with a computed data key.
 * - We avoid MM core by stubbing getExternalApiByGuessing and spying answerGet.
 */

const api = require("../../API/api.js");

function getHandlerForPath (router, method, path) {
  // Find a layer whose route matches the path and method.
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const hasMethod = layer.route.methods && layer.route.methods[method.toLowerCase()];
    const matches = layer.route.path
      ? Array.isArray(layer.route.path)
        ? layer.route.path.includes(path)
        : layer.route.path === path
      : layer.route.regexp ? layer.route.regexp.test(path) : false;
    if (hasMethod && matches) {
      // Return first handler in the stack for the route
      return layer.route.stack[0].handle;
    }
  }
  return null;
}

test("API GET routes map to answerGet keys", async () => {
  const calls = [];
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    secureEndpoints: true,
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    checkInitialized: () => true,
    answerGet: (query) => { calls.push(query); }
  };

  api.createApiRoutes.call(fake);
  assert.ok(fake.expressRouter, "expressRouter should be initialized");

  const invoke = async (p) => {
    const handler = getHandlerForPath(fake.expressRouter, "get", p);
    assert.ok(handler, `handler found for ${p}`);
    await handler({path: p}, {});
  };

  await invoke("/saves");
  await invoke("/classes");
  await invoke("/module/installed");
  await invoke("/module/available");
  await invoke("/translations");
  await invoke("/mmUpdateAvailable");
  await invoke("/brightness");
  await invoke("/config");

  // Ensure mappings transformed path correctly
  const keys = calls.map((c) => c.data);
  assert.deepEqual(keys, [
    "saves",
    "classes",
    "moduleInstalled",
    "moduleAvailable",
    "translations",
    "mmUpdateAvailable",
    "brightness",
    "config"
  ]);
});

test("/classes/:value returns 400 for invalid value", async () => {
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    secureEndpoints: true,
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    checkInitialized: () => true,
    getConfig: () => ({modules: [{module: "MMM-Remote-Control", config: {classes: {valid: true}}}]}),
    executeQuery: () => {}
  };

  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/classes/:value");
  assert.ok(handler, "handler found for /classes/:value");

  let statusCode;
  let body;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (b) => { body = b; }
      };
    }
  };

  await handler({path: "/classes/unknown", params: {value: encodeURIComponent("unknown")}}, res);
  assert.equal(statusCode, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Invalid value/i);
});
