const assert = require("node:assert/strict");
const {test} = require("node:test");
const {cleanConfig} = require("../../lib/configUtils");

test("cleanConfig removes top-level defaults and module defaults", () => {
  const defaultConfig = {language: "en", timeFormat: 24};
  const moduleDefaultsMap = {
    "modA": {foo: 1, bar: 2},
    "modB": {alpha: true}
  };
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
  const modA = config.modules[0];
  assert.ok(!("foo" in modA.config));
  assert.ok(!("bar" in modA.config));
  assert.equal(modA.config.baz, 9);
  assert.ok(!("position" in modA.config));
  assert.ok(!("header" in modA));
  // modB cleaned
  const modB = config.modules[1];
  assert.ok(!("alpha" in modB.config));
  // modC untouched
  const modC = config.modules[2];
  assert.equal(modC.config.value, 42);
});

test("cleanConfig handles missing modules array gracefully", () => {
  const cfg = {language: "en"};
  cleanConfig({config: cfg, defaultConfig: {language: "en"}, moduleDefaultsMap: {}});
  assert.ok(!("language" in cfg));
});
