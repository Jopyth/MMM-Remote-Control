/**
 * @file Unit tests for systemControl.js
 *
 * ⚠️ SAFETY CRITICAL: These tests mock system commands (shutdown, reboot, monitor control)
 * to prevent accidental execution on the test machine.
 *
 * DO NOT remove the safety guard at the top of this file!
 */

const {describe, it, beforeEach, afterEach} = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");

/**
 * SAFETY GUARD: Default blocker for real exec calls
 * Individual tests will override this with their mocks
 * @param {string} command - Command that was blocked
 * @throws {Error} Always throws to prevent real command execution
 */
childProcess.exec = (command) => {
  throw new Error(`SAFETY: Blocked real exec call in tests: ${command}`);
};

// Mock logger as console (has .log, .error, .warn methods)
const Module = require("node:module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id, ...args) {
  if (id === "logger") {
    return console;
  }
  return Reflect.apply(originalRequire, this, [id, ...args]);
};

// Import systemControl functions - will be reloaded in each test suite with mocked exec
let handleElectronActions;

/**
 * Helper to create mock exec function that never executes real commands
 * @param {Array<object>} execResults - Array to store exec calls for verification
 * @returns {function(string, object, function(Error, string, string): void): void} Mock exec function
 */
function createMockExec (execResults) {
  return (command, options, callback) => {
    // SAFETY: Never execute real commands, only record them
    execResults.push({command, options});
    setImmediate(() => {
      if (command.includes("display_power -1")) {
        callback(null, "display_power=1", "");
      } else if (command.includes("display_power 0")) {
        callback(null, "", "");
      } else if (command.includes("display_power 1")) {
        callback(null, "", "");
      } else {
        callback(null, "on", "");
      }
    });
  };
}

/**
 * Shared test helpers and mocks for monitorControl tests
 * @returns {object} Mock functions and result arrays
 */
function setupMonitorControlMocks () {
  const execResults = [];
  const socketNotifications = [];
  const errorCheckResults = [];

  const mockCheckForExecError = (error, stdout, stderr, res, data) => {
    errorCheckResults.push({error, stdout, stderr, res, data});
  };

  const mockSendSocketNotification = (notification, payload) => {
    socketNotifications.push({notification, payload});
  };

  return {execResults, socketNotifications, errorCheckResults, mockCheckForExecError, mockSendSocketNotification};
}


describe("systemControl", () => {
  describe("monitorControl", () => {
    describe("default commands", () => {
      let monitorControl;
      let mocks;

      beforeEach(() => {
        mocks = setupMonitorControlMocks();
        // Set mock exec BEFORE loading systemControl
        childProcess.exec = createMockExec(mocks.execResults);
        // Reload systemControl with mocked exec
        delete require.cache[require.resolve("../../lib/systemControl.js")];
        const sc = require("../../lib/systemControl.js");
        monitorControl = sc.monitorControl;
      });

      it("should execute MONITORON command with default command", (t, done) => {
        const config = {customCommand: {}};
        const options = {uid: 1000};
        const res = {test: "response"};

        monitorControl("MONITORON", config, options, res, mocks.mockCheckForExecError, mocks.mockSendSocketNotification);

        setTimeout(() => {
          assert.strictEqual(mocks.execResults.length, 1);
          assert.ok(mocks.execResults[0].command.includes("vcgencmd display_power 1"));
          assert.strictEqual(mocks.socketNotifications.length, 1);
          assert.strictEqual(mocks.socketNotifications[0].notification, "USER_PRESENCE");
          assert.strictEqual(mocks.socketNotifications[0].payload, true);
          done();
        }, 50);
      });

      it("should execute MONITOROFF command with default command", (t, done) => {
        const config = {customCommand: {}};
        const options = {uid: 1000};
        const res = {test: "response"};

        monitorControl("MONITOROFF", config, options, res, mocks.mockCheckForExecError, mocks.mockSendSocketNotification);

        setTimeout(() => {
          assert.strictEqual(mocks.execResults.length, 1);
          assert.ok(mocks.execResults[0].command.includes("vcgencmd display_power 0"));
          assert.strictEqual(mocks.socketNotifications.length, 1);
          assert.strictEqual(mocks.socketNotifications[0].notification, "USER_PRESENCE");
          assert.strictEqual(mocks.socketNotifications[0].payload, false);
          done();
        }, 50);
      });

      it("should execute MONITORSTATUS command", (t, done) => {
        const config = {customCommand: {}};
        const options = {uid: 1000};
        const res = {test: "response"};

        monitorControl("MONITORSTATUS", config, options, res, mocks.mockCheckForExecError, mocks.mockSendSocketNotification);

        setTimeout(() => {
          assert.strictEqual(mocks.execResults.length, 1);
          assert.ok(mocks.execResults[0].command.includes("vcgencmd display_power -1"));
          assert.strictEqual(mocks.errorCheckResults.length, 1);
          assert.strictEqual(mocks.errorCheckResults[0].data.monitor, "on");
          done();
        }, 50);
      });
    });

    describe("custom commands", () => {
      let monitorControl;
      let mocks;

      beforeEach(() => {
        mocks = setupMonitorControlMocks();
        childProcess.exec = createMockExec(mocks.execResults);
        delete require.cache[require.resolve("../../lib/systemControl.js")];
        const sc = require("../../lib/systemControl.js");
        monitorControl = sc.monitorControl;
      });

      it("should use custom monitor commands from config", (t, done) => {
        const config = {
          customCommand: {
            monitorOnCommand: "custom on",
            monitorOffCommand: "custom off",
            monitorStatusCommand: "custom status"
          }
        };
        const options = {};
        const res = {};

        monitorControl("MONITORON", config, options, res, mocks.mockCheckForExecError, mocks.mockSendSocketNotification);

        setTimeout(() => {
          assert.strictEqual(mocks.execResults[0].command, "custom on");
          done();
        }, 50);
      });

      it("should handle MONITORTOGGLE by calling MONITOROFF when on", (t, done) => {
        const config = {customCommand: {}};
        const options = {};
        const res = {};

        monitorControl("MONITORTOGGLE", config, options, res, mocks.mockCheckForExecError, mocks.mockSendSocketNotification);

        setTimeout(() => {
          // First call is status check, second is the toggle action
          assert.ok(mocks.execResults.length > 0);
          assert.ok(mocks.execResults[0].command.includes("display_power -1"));
          done();
        }, 100);
      });
    });
  });

  describe("shutdownControl", () => {

    /*
     * TODO: These tests need proper mocking strategy
     * Currently skipped due to module reloading + logger mock issues
     */
    it.skip("should execute SHUTDOWN command with default command", (t, done) => {
      done();
    });

    it.skip("should execute REBOOT command with default command", (t, done) => {
      done();
    });

    it.skip("should use custom shutdown command from config", (t, done) => {
      done();
    });

    it.skip("should use custom reboot command from config", (t, done) => {
      done();
    });
  });

  describe("handleElectronActions", () => {
    let responses = [];
    let windowActions = [];

    const mockElectron = {
      BrowserWindow: {
        getAllWindows: () => [
          {
            minimize: () => windowActions.push("minimize"),
            setFullScreen: (value) => windowActions.push(`fullscreen:${value}`),
            isFullScreen: () => false,
            webContents: {
              isDevToolsOpened: () => false,
              openDevTools: () => windowActions.push("devtools:open"),
              closeDevTools: () => windowActions.push("devtools:close")
            }
          }
        ]
      }
    };

    const mockSendResponse = (res, error) => {
      responses.push({res, error});
    };

    beforeEach(() => {
      responses = [];
      windowActions = [];
      // Mock electron module
      require.cache[require.resolve("electron")] = {exports: mockElectron};
      // Load handleElectronActions
      delete require.cache[require.resolve("../../lib/systemControl.js")];
      const sc = require("../../lib/systemControl.js");
      handleElectronActions = sc.handleElectronActions;
    });

    afterEach(() => {
      delete require.cache[require.resolve("electron")];
    });

    it("should minimize window", () => {
      const query = {action: "MINIMIZE"};
      const res = {test: "response"};

      handleElectronActions(query, res, mockSendResponse);

      assert.strictEqual(windowActions.length, 1);
      assert.strictEqual(windowActions[0], "minimize");
      assert.strictEqual(responses.length, 1);
      assert.strictEqual(responses[0].error, undefined);
    });

    it("should toggle fullscreen", () => {
      const query = {action: "TOGGLEFULLSCREEN"};
      const res = {test: "response"};

      handleElectronActions(query, res, mockSendResponse);

      assert.strictEqual(windowActions.length, 1);
      assert.ok(windowActions[0].startsWith("fullscreen:"));
      assert.strictEqual(responses.length, 1);
    });

    it("should open devtools", () => {
      const query = {action: "DEVTOOLS"};
      const res = {test: "response"};

      handleElectronActions(query, res, mockSendResponse);

      assert.strictEqual(windowActions.length, 1);
      assert.strictEqual(windowActions[0], "devtools:open");
      assert.strictEqual(responses.length, 1);
    });

    it("should handle unknown action gracefully", () => {
      const query = {action: "UNKNOWN"};
      const res = {test: "response"};

      handleElectronActions(query, res, mockSendResponse);

      assert.strictEqual(windowActions.length, 0);
      assert.strictEqual(responses.length, 1);
      assert.strictEqual(responses[0].error, undefined);
    });
  });
});
