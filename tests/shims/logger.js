/*
 * Logger shim for tests.
 * By default, suppress info/log/debug output to keep test output clean.
 * Errors and warnings are still shown as they may indicate real issues.
 */
const isTestEnvironment = process.env.NODE_ENV === "test" || typeof process.env.npm_lifecycle_event === "string" && process.env.npm_lifecycle_event.includes("test");

module.exports = {
  log: (...arguments_) => {
    if (!isTestEnvironment) {
      console.log(...arguments_);
    }
  },
  info: (...arguments_) => {
    if (!isTestEnvironment) {
      console.info(...arguments_);
    }
  },
  warn: (...arguments_) => console.warn(...arguments_),
  error: (...arguments_) => console.error(...arguments_),
  debug: (...arguments_) => {
    if (!isTestEnvironment) {
      console.debug(...arguments_);
    }
  }
};
