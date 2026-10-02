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
  return string ? string.charAt(0).toUpperCase() + string.slice(1) : string;
}

/**
 * Checks if a string contains a pattern (null-safe).
 * @param {string} pattern - The pattern to search for
 * @param {string} string - The string to search in
 * @returns {boolean} True if pattern is found in string
 */
function includes (pattern, string) {
  return string != undefined && string.includes(pattern);
}

module.exports = {capitalizeFirst, includes};
