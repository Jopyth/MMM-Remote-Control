const assert = require("node:assert/strict");
const {test} = require("node:test");
const {cleanConfig} = require("../../lib/configUtils");

test("cleanConfig leaves non-default top-level keys and removes defaults deeply (arrays/objects)", () => {
  const defaultConfig = {language: "en", header: {enabled: true}, list: [1, 2, 3]};
  const moduleDefaultsMap = {foo: {arr: [1, 2], obj: {a: 1}}};
  const cfg = {
    language: "en", // should be removed
    header: {enabled: true}, // should be removed (deep equal)
    list: [1, 2, 3, 4], // differs -> keep
    modules: [{module: "foo", header: "", config: {arr: [1, 2], obj: {a: 1}, extra: 9, position: ""}}]
  };
  cleanConfig({config: cfg, defaultConfig, moduleDefaultsMap});
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

test("cleanConfig tolerates nulls and unknown modules", () => {
  const cfg = {language: null, modules: [{module: "unknown", config: {x: 1}}]};
  cleanConfig({config: cfg, defaultConfig: {language: null}, moduleDefaultsMap: {}});
  assert.ok(!("language" in cfg));
  assert.equal(cfg.modules[0].config.x, 1);
});
