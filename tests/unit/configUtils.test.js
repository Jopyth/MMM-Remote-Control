const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { cleanConfig } = require("../../lib/configUtils");

describe("configUtils.cleanConfig", () => {
  test("removes defaults at top level and per-module", () => {
    const defaultConfig = { language: "en", timeFormat: 24 };
    const moduleDefaultsMap = { modA: { foo: 1, bar: 2 }, modB: { alpha: true } };
    const config = {
      language: "en", // should be removed
      timeFormat: 12, // differs -> keep
      modules: [
        { module: "modA", header: "", config: { foo: 1, bar: 2, baz: 9, position: "" } },
        { module: "modB", config: { alpha: true } },
        { module: "modC", config: { value: 42 } } // no defaults -> untouched
      ]
    };
    cleanConfig({ config, defaultConfig, moduleDefaultsMap });
    // top level
    assert.ok(!("language" in config));
    assert.equal(config.timeFormat, 12);
    // modA cleaned
    const moduleA = config.modules[0];
    assert.ok(!("foo" in moduleA.config));
    assert.ok(!("bar" in moduleA.config));
    assert.equal(moduleA.config.baz, 9);
    assert.ok(!("position" in moduleA.config));
    assert.ok(!("header" in moduleA));
    // modB cleaned
    const moduleB = config.modules[1];
    assert.ok(!("alpha" in moduleB.config));
    // modC untouched
    const moduleC = config.modules[2];
    assert.equal(moduleC.config.value, 42);
  });

  test("handles configs without a modules array", () => {
    const cfg = { language: "en" };
    cleanConfig({ config: cfg, defaultConfig: { language: "en" }, moduleDefaultsMap: {} });
    assert.ok(!("language" in cfg));
  });

  test("removes deep-equal defaults; preserves differing arrays/objects", () => {
    const defaultConfig = { language: "en", header: { enabled: true }, list: [1, 2, 3] };
    const moduleDefaultsMap = { foo: { arr: [1, 2], obj: { a: 1 } } };
    const cfg = {
      language: "en", // should be removed
      header: { enabled: true }, // should be removed (deep equal)
      list: [1, 2, 3, 4], // differs -> keep
      modules: [{ module: "foo", header: "", config: { arr: [1, 2], obj: { a: 1 }, extra: 9, position: "" } }]
    };
    cleanConfig({ config: cfg, defaultConfig, moduleDefaultsMap });
    assert.ok(!("language" in cfg));
    assert.ok(!("header" in cfg));
    assert.deepEqual(cfg.list, [1, 2, 3, 4]);
    const m = cfg.modules[0];
    assert.ok(!("arr" in m.config));
    assert.ok(!("obj" in m.config));
    assert.equal(m.config.extra, 9);
    assert.ok(!("position" in m.config));
    assert.ok(!("header" in m));
  });

  test("tolerates nulls at top level and unknown modules", () => {
    const cfg = { language: null, modules: [{ module: "unknown", config: { x: 1 } }] };
    cleanConfig({ config: cfg, defaultConfig: { language: null }, moduleDefaultsMap: {} });
    assert.ok(!("language" in cfg));
    assert.equal(cfg.modules[0].config.x, 1);
  });
});
