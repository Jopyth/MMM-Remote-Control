/**
 * Utility helpers extracted from node_helper.js for unit testing.
 * Pure functions – no side effects.
 */

/**
 * Capitalizes the first character of a string.
 * @param {string} string - The string to capitalize
 * @returns {string} String with first character capitalized
 */
function capitalizeFirst (string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Formats a module name by removing MMM- prefix and converting to title case.
 * @param {string} string - The module name to format
 * @returns {string} Formatted module name with spaces and title case
 */
function formatName (string) {
  if (!string) return string;
  // Original logic: strip MMM-, split camelCase, convert delimiters to spaces & capitalize
  return string.replaceAll("MMM-", "").replaceAll(/([a-z])([A-Z])/g, "$1 $2").replaceAll(/(^|[-_])(\w)/g, ($0, $1, $2) => ($1 && " ") + $2.toUpperCase());
}

/**
 * Checks if a string contains a pattern (null-safe).
 * @param {string} pattern - The pattern to search for
 * @param {string} string - The string to search in
 * @returns {boolean} True if pattern is found in string
 */
function includes (pattern, string) {
  if (string == undefined) return false;
  return string.includes(pattern);
}

module.exports = {capitalizeFirst, formatName, includes};
