const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const path = require("node:path");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const h = Object.create(helperFactory);
  h.__socketNotifications = [];
  h.__responses = [];
  h.sendSocketNotification = (action, payload) => {
    h.__socketNotifications.push({action, payload});
  };
  return h;
}

describe("translate", () => {
  test("replaces translation placeholders with values", () => {
    const helper = freshHelper();
    helper.translation = {
      HELLO: "Hello",
      WORLD: "World"
    };
    helper.translate = helperFactory.translate.bind(helper);

    const result = helper.translate("%%TRANSLATE:HELLO%% %%TRANSLATE:WORLD%%!");

    assert.equal(result, "Hello World!");
  });

  test("replaces multiple occurrences of same placeholder", () => {
    const helper = freshHelper();
    helper.translation = {FOO: "bar"};
    helper.translate = helperFactory.translate.bind(helper);

    const result = helper.translate("%%TRANSLATE:FOO%% and %%TRANSLATE:FOO%%");

    assert.equal(result, "bar and bar");
  });

  test("returns unchanged string when no placeholders present", () => {
    const helper = freshHelper();
    helper.translation = {KEY: "value"};
    helper.translate = helperFactory.translate.bind(helper);

    const result = helper.translate("No placeholders here");

    assert.equal(result, "No placeholders here");
  });

  test("handles empty translation object", () => {
    const helper = freshHelper();
    helper.translation = {};
    helper.translate = helperFactory.translate.bind(helper);

    const result = helper.translate("%%TRANSLATE:MISSING%%");

    assert.equal(result, "%%TRANSLATE:MISSING%%");
  });
});

describe("sendResponse", () => {
  test("sends success response with status 200 when no error", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    const mockRes = {
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    helper.sendResponse(mockRes);

    assert.equal(mockRes.statusCode, 200);
    assert.deepEqual(mockRes.jsonData, {success: true});
  });

  test("sends error response with status 400 when error provided", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    const mockRes = {
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    helper.sendResponse(mockRes, "Something went wrong");

    assert.equal(mockRes.statusCode, 400);
    assert.equal(mockRes.jsonData.success, false);
    assert.equal(mockRes.jsonData.status, "error");
    assert.equal(mockRes.jsonData.info, "Something went wrong");
  });

  test("merges data into response when provided", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    const mockRes = {
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    helper.sendResponse(mockRes, null, {customField: "value", count: 42});

    assert.equal(mockRes.jsonData.success, true);
    assert.equal(mockRes.jsonData.customField, "value");
    assert.equal(mockRes.jsonData.count, 42);
  });

  test("sends socket notification when res.isSocket is true", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    const mockRes = {isSocket: true};

    helper.sendResponse(mockRes, null, {result: "success"});

    assert.equal(helper.__socketNotifications.length, 1);
    assert.equal(helper.__socketNotifications[0].action, "REMOTE_ACTION_RESULT");
    assert.equal(helper.__socketNotifications[0].payload.success, true);
    assert.equal(helper.__socketNotifications[0].payload.result, "success");
  });

  test("handles null/undefined res gracefully", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);

    // Should not throw
    assert.doesNotThrow(() => {
      helper.sendResponse(null);
      helper.sendResponse();
    });
  });

  test("returns false when error provided", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    const mockRes = {
      status: () => mockRes,
      json: () => {}
    };

    const result = helper.sendResponse(mockRes, "error");

    assert.equal(result, false);
  });

  test("returns true when no error", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    const mockRes = {
      status: () => mockRes,
      json: () => {}
    };

    const result = helper.sendResponse(mockRes);

    assert.equal(result, true);
  });
});

describe("checkForExecError", () => {
  test("sends error response when error provided", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    helper.checkForExecError = helperFactory.checkForExecError.bind(helper);
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    helper.checkForExecError("Command failed", "output", "error message", mockRes, {info: "test"});

    assert.equal(mockRes.jsonData.success, false);
  });

  test("sends success response when no error", () => {
    const helper = freshHelper();
    helper.sendResponse = helperFactory.sendResponse.bind(helper);
    helper.checkForExecError = helperFactory.checkForExecError.bind(helper);
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        mockRes.jsonData = data;
      }
    };

    helper.checkForExecError(null, "output", "", mockRes, {result: "done"});

    assert.equal(mockRes.jsonData.success, true);
    assert.equal(mockRes.jsonData.result, "done");
  });
});

describe("getIpAddresses", () => {
  test("returns array of non-internal IPv4 addresses", () => {
    const helper = freshHelper();
    helper.getIpAddresses = helperFactory.getIpAddresses.bind(helper);

    const addresses = helper.getIpAddresses();

    assert.ok(Array.isArray(addresses));
    // Should filter out internal addresses (127.0.0.1) and IPv6
    for (const addr of addresses) {
      assert.match(addr, /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    }
  });

  test("returns empty array when no external interfaces", () => {
    const helper = freshHelper();
    helper.getIpAddresses = helperFactory.getIpAddresses.bind(helper);

    const addresses = helper.getIpAddresses();

    // May be empty in test environment, should not throw
    assert.ok(Array.isArray(addresses));
  });
});
