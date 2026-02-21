const assert = require("node:assert/strict");
const {test, describe, beforeEach, afterEach} = require("node:test");

// Add tests/shims to module resolution
const path = require("node:path");
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

// Mock electron via require hook
const originalRequire = ModuleLib.prototype.require;
let currentElectronMock = null;

ModuleLib.prototype.require = function (id, ...args) {
  if (id === "electron" && currentElectronMock !== null) {
    return currentElectronMock;
  }
  return Reflect.apply(originalRequire, this, [id, ...args]);
};

function freshHelper () {
  const h = Object.create(helperFactory);
  h.__responses = [];
  h.sendResponse = (_res, error, data) => {
    h.__responses.push({err: error, data});
  };
  h.handleRestart = helperFactory.handleRestart.bind(h);
  return h;
}

function mockRes () {
  const r = {
    _finishCb: null,
    on (event, cb) {
      if (event === "finish") {
        r._finishCb = cb;
      }
    },
    finish () {
      if (r._finishCb) { r._finishCb(); }
    }
  };
  return r;
}

describe("handleRestart", () => {
  let originalPm2Home;
  let originalPmId;
  let originalExit;

  beforeEach(() => {
    // Save and clear pm2 env vars
    originalPm2Home = process.env.PM2_HOME;
    originalPmId = process.env.pm_id;
    delete process.env.PM2_HOME;
    delete process.env.pm_id;

    // Block real process.exit
    originalExit = process.exit;
    process.exit = () => {
      throw new Error("SAFETY: process.exit called in test");
    };

    currentElectronMock = null;
  });

  afterEach(() => {
    // Restore env vars
    if (originalPm2Home !== undefined) {
      process.env.PM2_HOME = originalPm2Home;
    }
    if (originalPmId !== undefined) {
      process.env.pm_id = originalPmId;
    }
    process.exit = originalExit;
    currentElectronMock = null;
  });

  describe("standalone Electron (no pm2)", () => {
    test("calls app.relaunch() and app.quit()", () => {
      const calls = [];
      currentElectronMock = {
        app: {
          relaunch: () => calls.push("relaunch"),
          quit: () => calls.push("quit")
        }
      };

      const helper = freshHelper();
      helper.handleRestart({}, null);

      assert.deepEqual(calls, ["relaunch", "quit"]);
    });

    test("sends RESTART response", () => {
      currentElectronMock = {
        app: {relaunch: () => {}, quit: () => {}}
      };

      const helper = freshHelper();
      helper.handleRestart({}, null);

      assert.equal(helper.__responses.length, 1);
      assert.equal(helper.__responses[0].data.action, "RESTART");
    });
  });

  describe("under pm2 (PM2_HOME set)", () => {
    test("does NOT call app.relaunch()", (t, done) => {
      process.env.PM2_HOME = "/home/user/.pm2";
      const calls = [];
      currentElectronMock = {
        app: {
          relaunch: () => calls.push("relaunch"),
          quit: () => { calls.push("quit"); done(); }
        }
      };

      const helper = freshHelper();
      const res = mockRes();
      helper.handleRestart({}, res);
      res.finish();

      assert.ok(!calls.includes("relaunch"), "relaunch must not be called under pm2");
    });

    test("calls app.quit() after response is sent", (t, done) => {
      process.env.PM2_HOME = "/home/user/.pm2";
      currentElectronMock = {
        app: {
          relaunch: () => {},
          quit: () => done()
        }
      };

      const helper = freshHelper();
      const res = mockRes();
      helper.handleRestart({}, res);
      res.finish();
    });

    test("sends RESTART response", () => {
      process.env.PM2_HOME = "/home/user/.pm2";
      currentElectronMock = {
        app: {relaunch: () => {}, quit: () => {}}
      };

      const helper = freshHelper();
      const res = mockRes();
      helper.handleRestart({}, res);

      assert.equal(helper.__responses.length, 1);
      assert.equal(helper.__responses[0].data.action, "RESTART");
    });
  });

  describe("under pm2 (pm_id set)", () => {
    test("does NOT call app.relaunch() when pm_id is defined", (t, done) => {
      process.env.pm_id = "0";
      const calls = [];
      currentElectronMock = {
        app: {
          relaunch: () => calls.push("relaunch"),
          quit: () => { calls.push("quit"); done(); }
        }
      };

      const helper = freshHelper();
      const res = mockRes();
      helper.handleRestart({}, res);
      res.finish();

      assert.ok(!calls.includes("relaunch"), "relaunch must not be called when pm_id is set");
    });
  });

  describe("server mode (no Electron)", () => {
    test("calls process.exit(0) via res.on finish", (t, done) => {
      currentElectronMock = null; // require("electron") will throw

      const helper = freshHelper();
      const res = mockRes();

      process.exit = (code) => {
        assert.equal(code, 0);
        done();
      };

      helper.handleRestart({}, res);
      res.finish();
    });

    test("sends RESTART response", () => {
      currentElectronMock = null;

      const helper = freshHelper();
      const res = mockRes();

      process.exit = () => {}; // suppress

      helper.handleRestart({}, res);

      assert.equal(helper.__responses.length, 1);
      assert.equal(helper.__responses[0].data.action, "RESTART");
    });
  });
});
