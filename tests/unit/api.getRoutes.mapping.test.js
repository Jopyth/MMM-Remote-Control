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

test("/test returns success true", async () => {
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    checkInitialized: () => true
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/test");
  let body;
  const res = {json: (b) => { body = b; }};
  await handler({}, res);
  assert.equal(body.success, true);
});

test("/save triggers executeQuery with SAVE action", async () => {
  const called = [];
  const fake = {
    secureEndpoints: false, // bypass secure endpoint check
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    checkDelay: (q) => q,
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    executeQuery: (q) => { called.push(q); }
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/save");
  await handler({path: "/save"}, {});
  assert.equal(called[0].action, "SAVE");
});

test("/userpresence maps to answerGet without value", async () => {
  const calls = [];
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    checkInitialized: () => true,
    answerGet: (q) => { calls.push(q); }
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/userpresence{/:value}") || getHandlerForPath(fake.expressRouter, "get", "/userpresence/:value?");
  await handler({path: "/userpresence", params: {}}, {json: () => {}});
  assert.equal(calls[0].data, "userPresence");
});

test("/userpresence/true triggers USER_PRESENCE with true", async () => {
  const called = [];
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    executeQuery: (q) => { called.push(q); }
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/userpresence{/:value}") || getHandlerForPath(fake.expressRouter, "get", "/userpresence/:value?");
  await handler({path: "/userpresence/true", params: {value: "true"}}, {});
  assert.equal(called[0].action, "USER_PRESENCE");
  assert.equal(called[0].value, true);
});

test("/userpresence/invalid returns 400", async () => {
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {}
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/userpresence{/:value}") || getHandlerForPath(fake.expressRouter, "get", "/userpresence/:value?");
  let statusCode;
  const res = {status: (c) => { statusCode = c; return {json: () => {}}; }};
  await handler({path: "/userpresence/invalid", params: {value: "invalid"}}, res);
  assert.equal(statusCode, 400);
});

test("/update maps to mmUpdateAvailable via answerGet when no module", async () => {
  const calls = [];
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    secureEndpoints: false,
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    answerGet: (q) => { calls.push(q); }
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/update{/:moduleName}") || getHandlerForPath(fake.expressRouter, "get", "/update/:moduleName");
  await handler({path: "/update", params: {}}, {});
  assert.equal(calls[0].data, "mmUpdateAvailable");
});

test("/update/rc calls updateModule for MMM-Remote-Control", async () => {
  const called = [];
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    secureEndpoints: false,
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    updateModule: (name) => { called.push(name); }
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/update{/:moduleName}") || getHandlerForPath(fake.expressRouter, "get", "/update/:moduleName");
  await handler({path: "/update/rc", params: {moduleName: "rc"}}, {});
  assert.equal(called[0], "MMM-Remote-Control");
});

test("/brightness/:setting validates number and executes BRIGHTNESS", async () => {
  const called = [];
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {},
    executeQuery: (q) => { called.push(q); }
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/brightness/:setting");
  await handler({path: "/brightness/99", params: {setting: "99"}}, {status: () => ({json: () => {}})});
  assert.equal(called[0].action, "BRIGHTNESS");
  assert.equal(called[0].value, "99");
});

test("/brightness/:setting invalid returns 400", async () => {
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {}
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/brightness/:setting");
  let statusCode;
  await handler({path: "/brightness/abc", params: {setting: "abc"}}, {status: (c) => { statusCode = c; return {json: () => {}}; }});
  assert.equal(statusCode, 400);
});

test("/install GET returns 400", async () => {
  const fake = {
    configOnHd: {modules: [{module: "MMM-Remote-Control", config: {}}]},
    getApiKey: () => {},
    expressApp: {use: () => {}},
    getExternalApiByGuessing: () => {}
  };
  api.createApiRoutes.call(fake);
  const handler = getHandlerForPath(fake.expressRouter, "get", "/install");
  let statusCode;
  await handler({}, {status: (c) => { statusCode = c; return {json: () => {}}; }});
  assert.equal(statusCode, 400);
});
