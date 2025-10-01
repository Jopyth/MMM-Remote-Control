const assert = require("node:assert/strict");
const {test} = require("node:test");

// We'll import the module and bind methods to a fake context so we can test pure-ish helpers
const apiModule = require("../../API/api.js");

function makeCtx (overrides = {}) {
  return {
    configOnHd: {modules: []},
    externalApiRoutes: {},
    moduleApiMenu: {},
    translation: {},
    sendSocketNotification: () => {},
    sendResponse: () => {},
    checkInitialized: () => true,
    translate: (s) => s,
    formatName: (s) => s,
    thisConfig: {},
    ...overrides
  };
}

test("checkDelay adds DELAYED wrapper and UUID if '/delay' is used", () => {
  const ctx = makeCtx();
  const checkDelay = apiModule.checkDelay.bind(ctx);
  const req = {params: {delayed: "delay"}, query: {}, body: {}};
  const q = {action: "RESTART"};
  const out = checkDelay(q, req);
  assert.equal(out.action, "DELAYED");
  assert.ok(out.did && typeof out.did === "string");
  assert.equal(out.timeout, 10);
  assert.deepEqual(out.query, q);
});

test("checkDelay keeps original query when no '/delay'", () => {
  const ctx = makeCtx();
  const checkDelay = apiModule.checkDelay.bind(ctx);
  const req = {params: {}, query: {}, body: {}};
  const q = {action: "REFRESH"};
  const out = checkDelay(q, req);
  assert.equal(out, q);
});

test("answerNotifyApi builds payload from query and params (GET)", () => {
  const captured = {};
  const ctx = makeCtx({
    sendSocketNotification: (what, payload) => {
      captured.what = what;
      captured.payload = payload;
    }
  });
  const answerNotifyApi = apiModule.answerNotifyApi.bind(ctx);

  const req = {
    method: "GET",
    params: {notification: "TEST_ACTION"},
    query: {foo: "bar"}
  };
  const res = {json: (obj) => { captured.response = obj; }};
  answerNotifyApi(req, res);

  assert.equal(captured.what, "NOTIFICATION");
  assert.equal(captured.payload.notification, "TEST_ACTION");
  assert.deepEqual(captured.response, {success: true, notification: "TEST_ACTION", payload: {foo: "bar"}});
});

test("answerNotifyApi merges POST body into payload and supports action payload", () => {
  const captured = {};
  const ctx = makeCtx({
    sendSocketNotification: (what, payload) => { captured.payload = payload; }
  });
  const answerNotifyApi = apiModule.answerNotifyApi.bind(ctx);

  const req = {
    method: "POST",
    params: {notification: "TEST_ACTION"},
    query: {alpha: 1},
    body: {beta: 2}
  };
  const res = {json: () => {}};

  const action = {notification: "TEST_ACTION", payload: {gamma: 3}};
  answerNotifyApi(req, res, action);

  // payload should contain alpha, beta, and action payload gamma
  assert.equal(captured.payload.notification, "TEST_ACTION");
  assert.equal(captured.payload.payload.alpha, 1);
  assert.equal(captured.payload.payload.beta, 2);
  assert.equal(captured.payload.payload.gamma, 3);
});
