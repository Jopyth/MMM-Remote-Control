/* Unit tests for lib/utils.js using Node's built-in test runner */
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {capitalizeFirst, formatName, includes} = require("../../lib/utils");

test("capitalizeFirst normal word", () => {
  assert.equal(capitalizeFirst("remote"), "Remote");
});

test("capitalizeFirst empty string", () => {
  assert.equal(capitalizeFirst(""), "");
});

test("formatName strips MMM- and splits camelCase", () => {
  assert.equal(formatName("MMM-Remote-Control"), "Remote Control");
});

test("formatName handles hyphen and underscore", () => {
  assert.equal(formatName("my-module_name"), "My Module Name");
});

test("includes finds substring", () => {
  assert.equal(includes("test", "this is a test string"), true);
});

test("includes returns false if not found", () => {
  assert.equal(includes("absent", "present string"), false);
});
