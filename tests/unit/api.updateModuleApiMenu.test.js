const assert = require("node:assert/strict");
const {describe, test} = require("node:test");

const apiModule = require("../../API/api.js");

describe("updateModuleApiMenu", () => {
  test("generates menu structure from externalApiRoutes", () => {
    const sentNotifications = [];
    const context = {
      thisConfig: {showModuleApiMenu: true},
      externalApiRoutes: {
        "weather-api": {
          path: "weather-api",
          module: "MMM-Weather",
          actions: {
            UPDATE: {notification: "WEATHER_UPDATE", payload: {}},
            REFRESH: {notification: "WEATHER_REFRESH"}
          }
        },
        "calendar-ext": {
          path: "calendar-ext",
          module: "MMM-CalendarExt3",
          actions: {
            NEXT: {notification: "CALENDAR_NEXT"},
            PREV: {notification: "CALENDAR_PREV"}
          }
        }
      },
      moduleApiMenu: null,
      translate: (key) => key.replace("%%TRANSLATE:", "").replace("%%", ""),
      sendSocketNotification: (notification, payload) => {
        sentNotifications.push({notification, payload});
      }
    };

    apiModule.updateModuleApiMenu.call(context);

    assert.ok(context.moduleApiMenu, "moduleApiMenu should be created");
    assert.equal(context.moduleApiMenu.id, "module-control");
    assert.equal(context.moduleApiMenu.type, "menu");
    assert.ok(Array.isArray(context.moduleApiMenu.items), "should have items array");
    assert.equal(context.moduleApiMenu.items.length, 2, "should have 2 module submenus");

    // Check first submenu (MMM-Weather)
    const weatherMenu = context.moduleApiMenu.items[0];
    assert.equal(weatherMenu.id, "mc-weather-api");
    assert.equal(weatherMenu.type, "menu");
    assert.equal(weatherMenu.text, "MMM-Weather", "module name should be unchanged");
    assert.equal(weatherMenu.items.length, 2, "should have 2 actions");

    // Check action items
    const updateAction = weatherMenu.items[0];
    assert.equal(updateAction.id, "mc-weather-api-UPDATE");
    assert.equal(updateAction.action, "NOTIFICATION");
    assert.deepEqual(updateAction.content, {notification: "WEATHER_UPDATE", payload: {}});

    // Check notification was sent
    assert.equal(sentNotifications.length, 1);
    assert.equal(sentNotifications[0].notification, "REMOTE_CLIENT_MODULEAPI_MENU");
  });

  test("handles empty externalApiRoutes", () => {
    const context = {
      thisConfig: {showModuleApiMenu: true},
      externalApiRoutes: {},
      moduleApiMenu: null,
      translate: (key) => key,
      sendSocketNotification: () => {}
    };

    apiModule.updateModuleApiMenu.call(context);

    assert.ok(context.moduleApiMenu, "moduleApiMenu should still be created");
    assert.equal(context.moduleApiMenu.items.length, 0, "should have no items");
  });

  test("skips when showModuleApiMenu is false", () => {
    const context = {
      thisConfig: {showModuleApiMenu: false},
      externalApiRoutes: {test: {path: "test", module: "MMM-Test", actions: {}}},
      moduleApiMenu: null
    };

    apiModule.updateModuleApiMenu.call(context);

    assert.equal(context.moduleApiMenu, null, "should not create menu when disabled");
  });

  test("preserves module name unchanged", () => {
    const context = {
      thisConfig: {showModuleApiMenu: true},
      externalApiRoutes: {
        test: {
          path: "test",
          module: "MMM-PublicTransportHafas",
          actions: {TEST: {notification: "TEST"}}
        }
      },
      moduleApiMenu: null,
      translate: (key) => key,
      sendSocketNotification: () => {}
    };

    apiModule.updateModuleApiMenu.call(context);

    const menu = context.moduleApiMenu.items[0];
    assert.equal(menu.text, "MMM-PublicTransportHafas", "should keep module name unchanged");
  });
});
