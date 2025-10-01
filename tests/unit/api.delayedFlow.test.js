const assert = require("node:assert/strict");
const {test} = require("node:test");

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
    checkDelay: apiModule.checkDelay,
    translate: (s) => s,
    formatName: (s) => s,
    delayedQuery: () => {},
    thisConfig: {},
    ...overrides
  };
}

test("answerNotifyApi wraps into DELAYED when /delay used", () => {
  const captured = {};
  const ctx = makeCtx({
    delayedQuery: (query) => { captured.query = query; }
  });
  const answerNotifyApi = apiModule.answerNotifyApi.bind(ctx);

  const req = {
    method: "GET",
    params: {notification: "HELLO", delayed: "delay"},
    query: {did: "ID1", timeout: 5}
  };
  const res = {json: () => {}};

  answerNotifyApi(req, res);

  assert.equal(captured.query.action, "DELAYED");
  assert.equal(captured.query.did, "ID1");
  assert.equal(captured.query.timeout, 5);
  assert.equal(captured.query.query.action, "NOTIFICATION");
  assert.equal(captured.query.query.notification, "HELLO");
});
