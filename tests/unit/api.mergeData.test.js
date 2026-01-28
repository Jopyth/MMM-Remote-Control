const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const apiModule = require("../../API/api.js");

function makeContext(overrides = {}) {
  return {
    configData: { moduleData: [] },
    externalApiRoutes: {},
    ...overrides
  };
}

describe("mergeData", () => {
  test("returns modules without external routes unchanged", () => {
    const context = makeContext({
      configData: {
        moduleData: [
          { name: "clock", identifier: "module_1_clock" },
          { name: "calendar", identifier: "module_2_calendar" }
        ]
      },
      externalApiRoutes: {}
    });
    const mergeData = apiModule.mergeData.bind(context);

    const result = mergeData();

    assert.equal(result.success, true);
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0].name, "clock");
    assert.equal(result.data[1].name, "calendar");
  });

  test("merges external API routes with matching modules", () => {
    const context = makeContext({
      configData: {
        moduleData: [{ name: "CustomModule", identifier: "module_1_custom", urlPath: "old-path" }]
      },
      externalApiRoutes: {
        CustomModule: {
          path: "custom-api",
          actions: {
            myAction: { notification: "CUSTOM_ACTION" }
          }
        }
      }
    });
    const mergeData = apiModule.mergeData.bind(context);

    const result = mergeData();

    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "CustomModule");
    assert.equal(result.data[0].urlPath, "custom-api"); // Overwritten
    assert.deepEqual(result.data[0].actions, { myAction: { notification: "CUSTOM_ACTION" } });
  });

  test("preserves original module properties when merging", () => {
    const context = makeContext({
      configData: {
        moduleData: [
          {
            name: "TestModule",
            identifier: "module_1_test",
            hidden: false,
            position: "top_left"
          }
        ]
      },
      externalApiRoutes: {
        TestModule: {
          path: "test",
          actions: {}
        }
      }
    });
    const mergeData = apiModule.mergeData.bind(context);

    const result = mergeData();

    assert.equal(result.data[0].identifier, "module_1_test");
    assert.equal(result.data[0].hidden, false);
    assert.equal(result.data[0].position, "top_left");
  });

  test("handles mix of modules with and without external routes", () => {
    const context = makeContext({
      configData: {
        moduleData: [
          { name: "clock", identifier: "module_1_clock" },
          { name: "CustomModule", identifier: "module_2_custom" },
          { name: "calendar", identifier: "module_3_calendar" }
        ]
      },
      externalApiRoutes: {
        CustomModule: {
          path: "custom",
          actions: { test: { notification: "TEST" } }
        }
      }
    });
    const mergeData = apiModule.mergeData.bind(context);

    const result = mergeData();

    assert.equal(result.data.length, 3);
    // clock - no external route
    assert.equal(result.data[0].name, "clock");
    assert.equal(result.data[0].actions, undefined);
    // CustomModule - has external route
    assert.equal(result.data[1].name, "CustomModule");
    assert.equal(result.data[1].urlPath, "custom");
    assert.ok(result.data[1].actions.test);
    // calendar - no external route
    assert.equal(result.data[2].name, "calendar");
    assert.equal(result.data[2].actions, undefined);
  });

  test("returns empty data array when no modules present", () => {
    const context = makeContext({
      configData: { moduleData: [] },
      externalApiRoutes: {}
    });
    const mergeData = apiModule.mergeData.bind(context);

    const result = mergeData();

    assert.equal(result.success, true);
    assert.deepEqual(result.data, []);
  });

  test("external routes for non-existent modules are ignored", () => {
    const context = makeContext({
      configData: {
        moduleData: [{ name: "clock", identifier: "module_1_clock" }]
      },
      externalApiRoutes: {
        NonExistentModule: { path: "nope", actions: {} }
      }
    });
    const mergeData = apiModule.mergeData.bind(context);

    const result = mergeData();

    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "clock");
  });
});
