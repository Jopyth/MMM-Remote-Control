const {test, describe, before} = require("node:test");
const assert = require("node:assert/strict");

let Remote;

before(async () => {
  const {setupRemote} = await import("./setup.mjs");
  Remote = await setupRemote();
});

function makeSlider (value, min, max) {

  const props = {};

  return {
    value: String(value),
    min: String(min),
    max: String(max),
    style: {setProperty: (k, v) => { props[k] = v; }},
    _props: props
  };

}

describe("hasForcedType", () => {

  test("root-level path (1 slash) -> forcedType true", () => {
    assert.equal(Remote.hasForcedType("<root>/position"), true);
    assert.equal(Remote.hasForcedType("<root>/port"), true);
  });

  test("nested path (2 slashes) -> forcedType false", () => {
    assert.equal(Remote.hasForcedType("<root>/config/key"), false);
  });

  test("deeply nested path -> forcedType false", () => {
    assert.equal(Remote.hasForcedType("<root>/a/b/c"), false);
  });

  test("no slash -> forcedType false", () => {
    assert.equal(Remote.hasForcedType("noslash"), false);
  });

});

describe("getTypeAsString", () => {

  test("null -> 'null'", () => {
    assert.equal(Remote.getTypeAsString(null, "<root>/key"), "null");
  });

  test("undefined -> 'undefined'", () => {
    assert.equal(Remote.getTypeAsString(undefined, "<root>/key"), "undefined");
  });

  test("array -> 'array'", () => {
    assert.equal(Remote.getTypeAsString([1, 2, 3], "<root>/key"), "array");
  });

  test("path '<root>/position' -> 'position' regardless of value", () => {
    assert.equal(Remote.getTypeAsString("top_left", "<root>/position"), "position");
    assert.equal(Remote.getTypeAsString(42, "<root>/position"), "position");
  });

  test("string value -> 'string'", () => {
    assert.equal(Remote.getTypeAsString("hello", "<root>/key"), "string");
  });

  test("number value -> 'number'", () => {
    assert.equal(Remote.getTypeAsString(42, "<root>/key"), "number");
  });

  test("boolean value -> 'boolean'", () => {
    assert.equal(Remote.getTypeAsString(true, "<root>/key"), "boolean");
  });

  test("plain object -> 'object'", () => {
    assert.equal(Remote.getTypeAsString({a: 1}, "<root>/key"), "object");
  });

});

describe("createConfigInput", () => {

  test("creates input element with correct id and class", () => {
    const input = Remote.createConfigInput("my-key", "my-value", false);
    assert.equal(input.tagName.toLowerCase(), "input");
    assert.equal(input.id, "my-key");
    assert.ok(input.classList.contains("config-input"));
  });

  test("sets value when omitValue is false", () => {
    const input = Remote.createConfigInput("k", "hello", false);
    assert.equal(input.value, "hello");
  });

  test("does not set value when omitValue is true", () => {
    const input = Remote.createConfigInput("k", "hello", true);
    assert.equal(input.value, "");
  });

  test("creates select element when element param is 'select'", () => {
    const select = Remote.createConfigInput("s", "", false, "select");
    assert.equal(select.tagName.toLowerCase(), "select");
    assert.equal(select.id, "s");
  });

});

describe("updateSliderThumbColor", () => {

  test("brightness at 0% -> dark thumb color", () => {
    const slider = makeSlider(0, 0, 100);
    Remote.updateSliderThumbColor(slider, "brightness");
    assert.equal(slider._props["--thumb-color"], "rgb(50, 50, 50)");
  });

  test("brightness at 100% -> bright white thumb", () => {
    const slider = makeSlider(100, 0, 100);
    Remote.updateSliderThumbColor(slider, "brightness");
    assert.equal(slider._props["--thumb-color"], "rgb(255, 255, 255)");
  });

  test("brightness also sets --track-gradient", () => {
    const slider = makeSlider(50, 0, 100);
    Remote.updateSliderThumbColor(slider, "brightness");
    assert.ok(
      slider._props["--track-gradient"].startsWith("linear-gradient"),
      "track gradient should be set"
    );
  });

  test("temp at 0% -> cool blue thumb", () => {
    const slider = makeSlider(0, 0, 100);
    Remote.updateSliderThumbColor(slider, "temp");
    assert.equal(slider._props["--thumb-color"], "rgb(100, 181, 246)");
  });

  test("temp at 100% -> warm orange thumb", () => {
    const slider = makeSlider(100, 0, 100);
    Remote.updateSliderThumbColor(slider, "temp");
    assert.equal(slider._props["--thumb-color"], "rgb(255, 147, 41)");
  });

  test("unknown type -> no CSS properties set", () => {
    const slider = makeSlider(50, 0, 100);
    Remote.updateSliderThumbColor(slider, "unknown-type");
    assert.equal(Object.keys(slider._props).length, 0);
  });

});
