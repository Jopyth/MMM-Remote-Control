/**
 * Utility helpers extracted from node_helper.js for unit testing.
 * Pure functions – no side effects.
 */

function capitalizeFirst (string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatName (string) {
  if (!string) return string;
  // Original logic: strip MMM-, split camelCase, convert delimiters to spaces & capitalize
  return string.replaceAll("MMM-", "").replaceAll(/([a-z])([A-Z])/g, "$1 $2").replaceAll(/(^|[-_])(\w)/g, ($0, $1, $2) => ($1 && " ") + $2.toUpperCase());
}

function includes (pattern, string) {
  if (string == undefined) return false;
  return string.includes(pattern);
}

module.exports = {capitalizeFirst, formatName, includes};
