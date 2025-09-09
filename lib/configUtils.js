/**
 * cleanConfig removes keys from the full MagicMirror config object that equal their defaults.
 * It mirrors the logic inside removeDefaultValues in node_helper.js but is pure and testable.
 * Mutates and also returns the provided config object.
 *
 * @param {object} params
 * @param {object} params.config - The full runtime config (will be mutated)
 * @param {object} params.defaultConfig - Global MagicMirror default config
 * @param {Object.<string,object>} params.moduleDefaultsMap - Map moduleName -> defaults
 * @param {Array<object>} [params.moduleDataFromBrowser] - Optional list providing defaults for bundled modules
 */
function cleanConfig ({config, defaultConfig, moduleDefaultsMap, moduleDataFromBrowser = []}) {
  if (!config || typeof config !== "object") return config;

  // Remove top-level keys equal to defaults
  for (const key in defaultConfig) {
    if (Object.hasOwn(defaultConfig, key) && Object.hasOwn(config, key) && JSON.stringify(defaultConfig[key]) === JSON.stringify(config[key])) {
      delete config[key];
    }
  }

  if (!Array.isArray(config.modules)) return config;

  for (let i = 0; i < config.modules.length; i++) {
    const current = config.modules[i];
    if (!current) continue;
    const moduleName = current.module;
    const moduleDefaultsFromRequire = moduleDefaultsMap[moduleName];
    const moduleDataFromBrowserEntry = moduleDataFromBrowser.find((item) => item.name === moduleName);
    const moduleDefaults = moduleDefaultsFromRequire || moduleDataFromBrowserEntry?.defaults;

    if (!current.config) current.config = {};
    if (moduleDefaults) {
      for (const key in moduleDefaults) {
        if (Object.hasOwn(moduleDefaults, key) && Object.hasOwn(current.config, key) && JSON.stringify(moduleDefaults[key]) === JSON.stringify(current.config[key])) {
          delete current.config[key];
        }
      }
    }

    if (current.config["position"] === "") {
      delete current.config["position"];
    }
    if (current.header === "") {
      delete current.header;
    }
  }
  return config;
}

module.exports = {cleanConfig};
