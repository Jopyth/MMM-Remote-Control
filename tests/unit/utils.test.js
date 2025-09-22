/* Unit tests for lib/utils.js using Node's built-in test runner */
const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const group = typeof describe === "function" ? describe : (_n, fn) => fn();
const {capitalizeFirst, formatName, includes} = require("../../lib/utils");

group("utils", () => {
  group("capitalizeFirst", () => {
    test("converts first letter to uppercase", () => {
      assert.equal(capitalizeFirst("remote"), "Remote");
    });
    test("returns empty string unchanged", () => {
      assert.equal(capitalizeFirst(""), "");
    });
  });

  group("formatName", () => {
    test("removes MMM- prefix and splits camelCase", () => {
      assert.equal(formatName("MMM-Remote-Control"), "Remote Control");
    });
    test("converts hyphen/underscore to spaces and capitalizes", () => {
      assert.equal(formatName("my-module_name"), "My Module Name");
    });
  });

  group("includes", () => {
    test("returns true when substring is found", () => {
      assert.equal(includes("test", "this is a test string"), true);
    });
    test("returns false when substring is absent", () => {
      assert.equal(includes("absent", "present string"), false);
    });
  });
});
