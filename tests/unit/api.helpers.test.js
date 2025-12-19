const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const group = typeof describe === "function" ? describe : (_n, function_) => function_();

// We'll import the module and bind methods to a fake context so we can test pure-ish helpers
const apiModule = require("../../API/api.js");

function makeContext (overrides = {}) {
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

group("API helpers", () => {
  group("checkDelay", () => {
    test("wraps query as DELAYED when '/delay' is used (adds ID and default timeout)", () => {
      const context = makeContext();
      const checkDelay = apiModule.checkDelay.bind(context);
      const request = {params: {delayed: "delay"}, query: {}, body: {}};
      const q = {action: "RESTART"};
      const out = checkDelay(q, request);
      assert.equal(out.action, "DELAYED");
      assert.ok(out.did && typeof out.did === "string");
      assert.equal(out.timeout, 10);
      assert.deepEqual(out.query, q);
    });

    test("keeps original query when '/delay' is not used", () => {
      const context = makeContext();
      const checkDelay = apiModule.checkDelay.bind(context);
      const request = {params: {}, query: {}, body: {}};
      const q = {action: "REFRESH"};
      const out = checkDelay(q, request);
      assert.equal(out, q);
    });
  });

  group("answerNotifyApi", () => {
    test("builds payload from GET params and returns success", () => {
      const captured = {};
      const context = makeContext({
        sendSocketNotification: (what, payload) => {
          captured.what = what;
          captured.payload = payload;
        }
      });
      const answerNotifyApi = apiModule.answerNotifyApi.bind(context);

      const request = {method: "GET", params: {notification: "TEST_ACTION"}, query: {foo: "bar"}};
      const res = {json: (object) => { captured.response = object; }};
      answerNotifyApi(request, res);

      assert.equal(captured.what, "NOTIFICATION");
      assert.equal(captured.payload.notification, "TEST_ACTION");
      assert.deepEqual(captured.response, {success: true, notification: "TEST_ACTION", payload: {foo: "bar"}});
    });

    test("merges POST body and action payload into final payload", () => {
      const captured = {};
      const context = makeContext({sendSocketNotification: (what, payload) => { captured.payload = payload; }});
      const answerNotifyApi = apiModule.answerNotifyApi.bind(context);

      const request = {method: "POST", params: {notification: "TEST_ACTION"}, query: {alpha: 1}, body: {beta: 2}};
      const res = {json: () => {}};
      const action = {notification: "TEST_ACTION", payload: {gamma: 3}};

      answerNotifyApi(request, res, action);

      // payload should contain alpha, beta, and action payload gamma
      assert.equal(captured.payload.notification, "TEST_ACTION");
      assert.equal(captured.payload.payload.alpha, 1);
      assert.equal(captured.payload.payload.beta, 2);
      assert.equal(captured.payload.payload.gamma, 3);
    });
  });
});
