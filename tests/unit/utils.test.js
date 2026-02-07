/* Unit tests for lib/utils.js using Node's built-in test runner */
const assert = require("node:assert/strict");
const {test, describe} = require("node:test");
const {capitalizeFirst, includes} = require("../../lib/utils");

describe("utils", () => {
  describe("capitalizeFirst", () => {
    test("converts first letter to uppercase", () => {
      assert.equal(capitalizeFirst("remote"), "Remote");
    });
    test("returns empty string unchanged", () => {
      assert.equal(capitalizeFirst(""), "");
    });
  });

  describe("includes", () => {
    test("returns true when substring is found", () => {
      assert.equal(includes("test", "this is a test string"), true);
    });
    test("returns false when substring is absent", () => {
      assert.equal(includes("absent", "present string"), false);
    });
  });
});
