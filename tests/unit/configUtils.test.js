const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const group = typeof describe === "function" ? describe : (_n, function_) => function_();
const {cleanConfig} = require("../../lib/configUtils");

group("configUtils.cleanConfig", () => {
  test("removes defaults at top level and per-module", () => {
    const defaultConfig = {language: "en", timeFormat: 24};
    const moduleDefaultsMap = {modA: {foo: 1, bar: 2}, modB: {alpha: true}};
    const config = {
      language: "en", // should be removed
      timeFormat: 12, // differs -> keep
      modules: [
        {module: "modA", header: "", config: {foo: 1, bar: 2, baz: 9, position: ""}},
        {module: "modB", config: {alpha: true}},
        {module: "modC", config: {value: 42}} // no defaults -> untouched
      ]
    };
    cleanConfig({config, defaultConfig, moduleDefaultsMap});
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
    const cfg = {language: "en"};
    cleanConfig({config: cfg, defaultConfig: {language: "en"}, moduleDefaultsMap: {}});
    assert.ok(!("language" in cfg));
  });
});
