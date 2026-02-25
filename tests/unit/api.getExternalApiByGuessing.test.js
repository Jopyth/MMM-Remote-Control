const assert = require("node:assert/strict");
const {describe, test} = require("node:test");

const apiModule = require("../../API/api.js");

describe("getExternalApiByGuessing", () => {
  test("does not warn for modules without notification handler", () => {
    const context = {
      configOnHd: {
        modules: [{module: "MMM-RAIN-MAP"}]
      },
      externalApiRoutes: {},
      thisConfig: {showModuleApiMenu: false},
      updateModuleApiMenu: () => {},
      sendSocketNotification: () => {}
    };

    const previousModule = globalThis.Module;
    const previousWarn = console.warn;
    const warnings = [];

    globalThis.Module = {
      notificationHandler: {}
    };
    console.warn = (message) => {
      warnings.push(message);
    };

    try {
      apiModule.getExternalApiByGuessing.call(context);
    } finally {
      console.warn = previousWarn;
      globalThis.Module = previousModule;
    }

    assert.equal(warnings.length, 0);
    assert.deepEqual(context.externalApiRoutes, {});
  });

  test("extracts actions from function handlers", () => {
    const context = {
      configOnHd: {
        modules: [{module: "MMM-TestModule"}]
      },
      externalApiRoutes: {},
      thisConfig: {showModuleApiMenu: false},
      updateModuleApiMenu: () => {},
      sendSocketNotification: () => {}
    };

    const previousModule = globalThis.Module;

    globalThis.Module = {
      notificationHandler: {
        "MMM-TestModule": function (notification) {
          switch (notification) {
            case "PING_NOW":
              return true;
            default:
              return false;
          }
        }
      }
    };

    try {
      apiModule.getExternalApiByGuessing.call(context);
    } finally {
      globalThis.Module = previousModule;
    }

    assert.ok(context.externalApiRoutes["MMM-TestModule"]);
    assert.equal(context.externalApiRoutes["MMM-TestModule"].path, "testmodule");
    assert.deepEqual(context.externalApiRoutes["MMM-TestModule"].actions.pingnow, {
      notification: "PING_NOW",
      guessed: true
    });
  });

  test("does not add guessed actions when explicit actions already exist", () => {
    const context = {
      configOnHd: {
        modules: [{module: "MMM-pages"}]
      },
      externalApiRoutes: {
        "MMM-pages": {
          module: "MMM-pages",
          path: "pages",
          actions: {
            next: {
              notification: "PAGE_INCREMENT",
              prettyName: "Next Page"
            }
          }
        }
      },
      thisConfig: {showModuleApiMenu: false},
      updateModuleApiMenu: () => {},
      sendSocketNotification: () => {}
    };

    const previousModule = globalThis.Module;

    globalThis.Module = {
      notificationHandler: {
        "MMM-pages": function (notification) {
          switch (notification) {
            case "PAGE_INCREMENT":
              return true;
            case "PAGE_DECREMENT":
              return true;
            default:
              return false;
          }
        }
      }
    };

    try {
      apiModule.getExternalApiByGuessing.call(context);
    } finally {
      globalThis.Module = previousModule;
    }

    assert.ok(context.externalApiRoutes["MMM-pages"]);
    assert.equal(context.externalApiRoutes["MMM-pages"].actions.next.notification, "PAGE_INCREMENT");
    assert.equal(context.externalApiRoutes["MMM-pages"].actions.pageincrement, undefined);
    assert.equal(context.externalApiRoutes["MMM-pages"].actions.pagedecrement, undefined);
  });
});
