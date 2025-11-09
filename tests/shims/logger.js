/*
 * Logger shim for tests.
 * By default, suppress info/log/debug output to keep test output clean.
 * Errors and warnings are still shown as they may indicate real issues.
 */
const isTestEnvironment = process.env.NODE_ENV === "test" || typeof process.env.npm_lifecycle_event === "string" && process.env.npm_lifecycle_event.includes("test");

module.exports = {
  log: (...args) => {
    if (!isTestEnvironment) {
      console.log(...args);
    }
  },
  info: (...args) => {
    if (!isTestEnvironment) {
      console.info(...args);
    }
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => {
    if (!isTestEnvironment) {
      console.debug(...args);
    }
  }
};
