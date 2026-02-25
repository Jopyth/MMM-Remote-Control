/**
 * Module Manager for MMM-Remote-Control
 * Handles module discovery, installation, updates, and configuration
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const {exec} = require("node:child_process");
const {promisify} = require("node:util");
const simpleGit = require("simple-git");

let Log;
try {
  Log = require("logger");
} catch {
  Log = require("../tests/shims/logger.js");
}

const execPromise = promisify(exec);

// List of default MagicMirror modules
const defaultModules = [
  "updatenotification",
  "helloworld",
  "alert",
  "clock",
  "compliments",
  "weather",
  "calendar",
  "newsfeed"
];

/**
 * Download and update the module list from external source
 * @param {object} options - Options object
 * @param {boolean} options.force - Force update even if recently updated
 * @param {function(string): void} options.callback - Callback function(error)
 * @returns {Promise<void>}
 */
async function updateModuleList (options) {
  const {force, callback} = options;
  const downloadModules = require("../scripts/download_modules");

  downloadModules({
    force,
    callback: (result) => {
      if (result?.startsWith("ERROR")) {
        Log.error(result);
      }
      if (callback) {
        callback(result);
      }
    }
  });
}

/**
 * Read and parse modules.json file
 * @param {string} baseDir - Base directory (__dirname from node_helper)
 * @param {string} modulesDir - Modules directory path
 * @param {function(object, string): void} onModuleLoaded - Callback(module, modulePath)
 * @returns {Promise<{modulesAvailable: Array, modulesInstalled: Array, installedModules: Array}>} Object with module arrays
 */
async function readModuleData (baseDir, modulesDir, onModuleLoaded) {
  const modulesAvailable = [];
  const modulesInstalled = [];

  // Read modules.json
  const data = await fs.readFile(path.resolve(`${baseDir}/modules.json`), "utf8");
  const parsedModules = JSON.parse(data);

  // Mark all as not default modules
  for (const module of parsedModules) {
    module.isDefaultModule = false;
    modulesAvailable.push(module);
  }

  /*
   * Add default modules
   * TODO: Remove old path support in 2027 (MM < 2.35.0)
   * Determine which path to use for default modules (new: defaultmodules, old: modules/default)
   */
  let defaultModulesBasePath;
  try {
    await fs.access(path.resolve(`${baseDir}/../../defaultmodules`), fs.constants.F_OK);
    defaultModulesBasePath = "defaultmodules";
  } catch {
    defaultModulesBasePath = "modules/default";
  }

  for (const moduleName of defaultModules) {
    const module = {
      name: moduleName,
      isDefaultModule: true,
      installed: true,
      maintainer: "MagicMirrorOrg",
      description: "",
      id: "MagicMirrorOrg/MagicMirror",
      url: "https://docs.magicmirror.builders/modules/introduction.html"
    };
    modulesAvailable.push(module);

    const modulePath = `${defaultModulesBasePath}/${moduleName}`;

    if (onModuleLoaded) {
      onModuleLoaded(module, modulePath);
    }
  }

  // Read installed modules directory
  const files = await fs.readdir(path.resolve(`${baseDir}/..`));
  const installedModules = files.filter((f) => ![
    "node_modules",
    "default",
    "README.md"
  ].includes(f));

  // Return directory list for processing
  return {
    modulesAvailable,
    modulesInstalled,
    installedModules
  };
}

/**
 * Add a module to the available modules list
 * @param {object} options - Options object
 * @param {string} options.directoryName - Module directory name
 * @param {string} options.modulesDir - Modules directory path
 * @param {Array} options.modulesAvailable - Available modules array (modified in place)
 * @param {Array} options.modulesInstalled - Installed modules array (modified in place)
 * @param {function(object, string): void} options.onModuleLoaded - Callback(module, modulePath, isLast)
 * @param {function({module: object, modulePath: string, directoryName: string}): void} options.onUpdateCheckQueued - Callback({module, modulePath, directoryName})
 * @param {boolean} options.isLast - Whether this is the last module to process
 * @returns {Promise<void>}
 */
async function addModule (options) {
  const {
    directoryName,
    modulesDir,
    modulesAvailable,
    modulesInstalled,
    onModuleLoaded,
    onUpdateCheckQueued,
    isLast
  } = options;

  const modulePath = `${modulesDir}/${directoryName}`;

  try {
    const stats = await fs.stat(modulePath);

    if (!stats.isDirectory()) {
      return;
    }

    // Add to installed list
    modulesInstalled.push(directoryName);

    // Find or create module entry
    let currentModule = modulesAvailable.find((m) => m.name === directoryName);

    if (currentModule) {
      currentModule.installed = true;
    } else {
      currentModule = {
        name: directoryName,
        isDefaultModule: false,
        installed: true,
        maintainer: "unknown",
        description: "",
        id: `local/${directoryName}`,
        url: ""
      };
      modulesAvailable.push(currentModule);
    }

    // Load module config
    if (onModuleLoaded) {
      onModuleLoaded(currentModule, modulePath, isLast);
    }

    // Check for CHANGELOG
    try {
      await fs.access(path.join(modulePath, "CHANGELOG.md"), fs.constants.F_OK);
      currentModule.hasChangelog = true;
    } catch {
      currentModule.hasChangelog = false;
    }

    // Check if module is a git repository
    try {
      await fs.stat(path.join(modulePath, ".git"));

      // Queue update check
      if (onUpdateCheckQueued) {
        onUpdateCheckQueued({
          module: currentModule,
          modulePath,
          directoryName
        });
      }

      // Get remote URL if not already set
      if (!currentModule.url || currentModule.url === "") {
        const sg = simpleGit(modulePath);
        try {
          const remotes = await sg.getRemotes(true);
          if (remotes?.length > 0) {
            let baseUrl = remotes[0].refs.fetch;
            // Replace patterns
            baseUrl = baseUrl.replace(".git", "").replace("github.com:", "github.com/");
            // If cloned with ssh
            currentModule.url = baseUrl.replace("git@", "https://");
          }
        } catch (error) {
          Log.debug(`Could not get remote URL for module ${directoryName}: ${error}`);
        }
      }
    } catch {
      Log.debug(`Module ${directoryName} is not managed with git, skipping update check`);
    }
  } catch (error) {
    Log.error(`Error adding module ${directoryName}: ${error.message || error}`);
  }
}

/**
 * Check a single module for available updates
 * @param {object} check - Update check object
 * @param {object} check.module - Module object to update
 * @param {string} check.modulePath - Path to module directory
 * @param {string} check.directoryName - Directory name
 * @returns {Promise<void>}
 */
async function checkModuleUpdate (check) {
  const sg = simpleGit(check.modulePath);

  try {
    await sg.fetch();
    const data = await sg.status();

    if (data.behind > 0) {
      check.module.updateAvailable = true;
      Log.info(`Module ${check.directoryName} has updates available (behind ${data.behind} commits)`);
    }
  } catch (error) {
    Log.warn(`Error checking updates for ${check.directoryName}: ${error.message || error}`);
  }
}

/**
 * Load module's default configuration
 * @param {object} module - Module object
 * @param {string} modulePath - Path to module directory
 * @returns {Promise<void>}
 */
async function loadModuleDefaultConfig (module, modulePath) {
  const filename = path.resolve(`${modulePath}/${module.name}.js`);

  try {

    /* Defaults are stored when Module.register is called during require(filename); */
    require(filename);
  } catch (error) {
    if (error instanceof ReferenceError) {
      Log.log(`Could not get defaults for ${module.name}. See #335.`);
    } else if (error.code === "MODULE_NOT_FOUND" || error.code === "ENOENT") {
      Log.error(`Could not find main module js file for ${module.name}`);
    } else if (error instanceof SyntaxError) {
      Log.error(`Could not validate main module js file for ${module.name}`);
      Log.error(error);
    } else {
      throw error;
    }
  }
}

/**
 * Install a module from a git URL
 * @param {object} options - Options object
 * @param {string} options.url - Git URL to clone
 * @param {string} options.baseDir - Base directory (__dirname from node_helper)
 * @param {function({stdout: string}): void} options.onSuccess - Callback({stdout})
 * @param {function(Error, {stdout?: string, stderr?: string}): void} options.onError - Callback(error, {stdout, stderr})
 * @returns {Promise<void>}
 */
async function installModule (options) {
  const {url, baseDir, onSuccess, onError} = options;

  try {
    // Clone repository using native promises
    await simpleGit(path.resolve(`${baseDir}/..`)).clone(url, path.basename(url));

    const workDir = path.resolve(`${baseDir}/../${path.basename(url)}`);

    try {
      const packageJsonData = await fs.readFile(`${workDir}/package.json`, "utf8");
      const packageJson = JSON.parse(packageJsonData);
      const installNecessary = packageJson.dependencies || packageJson.scripts?.preinstall || packageJson.scripts?.postinstall;

      if (installNecessary) {
        let packageLockExists = false;
        try {
          await fs.access(`${workDir}/package-lock.json`, fs.constants.F_OK);
          packageLockExists = true;
        } catch {
          packageLockExists = false;
        }

        const command = packageLockExists
          ? "npm ci --omit=dev"
          : "npm install --omit=dev";

        try {
          const {stdout} = await execPromise(command, {cwd: workDir, timeout: 120_000});
          if (onSuccess) {
            onSuccess({stdout});
          }
        } catch (error) {
          Log.error(error);
          if (onError) {
            onError(error, {stdout: error.stdout, stderr: error.stderr});
          }
        }
      } else {
        // Module has package.json but no dependencies/install scripts
        if (onSuccess) {
          onSuccess({stdout: "Module installed (no dependencies)."});
        }
      }
    } catch {
      // No package.json found
      if (onSuccess) {
        onSuccess({stdout: "Module installed."});
      }
    }
  } catch (error) {
    Log.error(error);
    if (onError) {
      onError(error, {});
    }
  }
}

/**
 * Update a module (or MagicMirror itself)
 * @param {object} options - Options object
 * @param {string} options.moduleName - Module name (or undefined for MagicMirror)
 * @param {string} options.baseDir - Base directory (__dirname from node_helper)
 * @param {Array} options.modulesAvailable - Available modules array
 * @param {function({code: string, info: string, chlog?: string, stdout?: string}): void} options.onSuccess - Callback({code, info, chlog?, stdout?})
 * @param {function(Error, {code?: string, info?: string, stdout?: string, stderr?: string}): void} options.onError - Callback(error, {code?, info?, stdout?, stderr?})
 * @returns {Promise<void>}
 */
async function updateModule (options) {
  const {moduleName, baseDir, modulesAvailable, onSuccess, onError} = options;

  Log.log(`UPDATE ${moduleName || "MagicMirror"}`);

  let modulePath = `${baseDir}/../../`;
  let name = "MM";

  if (moduleName && moduleName !== "undefined") {
    const moduleData = modulesAvailable?.find((m) => m.name === moduleName);
    if (!moduleData) {
      if (onError) {
        onError(new Error("Unknown Module"), {info: moduleName});
      }
      return;
    }

    modulePath = `${baseDir}/../${moduleData.name}`;
    name = moduleData.name;
  }

  Log.log(`path: ${modulePath} name: ${name}`);

  const git = simpleGit(modulePath);

  try {
    await git.fetch();

    // Check if there are changes before resetting
    const status = await git.status();
    const hasUpdates = status.behind > 0;

    if (!hasUpdates) {
      if (onSuccess) {
        onSuccess({code: "up-to-date", info: `${name} already up to date.`});
      }
      return;
    }

    // Reset to remote and pull
    await git.reset(["--hard", "FETCH_HEAD"]);
    await git.pull(["--ff-only"]);

    // Check if npm install is needed
    const packageJsonPath = `${modulePath}/package.json`;
    try {
      const packageJsonData = await fs.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageJsonData);
      const needsInstall = packageJson.dependencies || packageJson.scripts?.preinstall || packageJson.scripts?.postinstall;

      if (!needsInstall) {
        await sendUpdateResponse(modulePath, name, onSuccess);
        return;
      }

      // Run npm install
      let packageLockExists = false;
      try {
        await fs.access(`${modulePath}/package-lock.json`, fs.constants.F_OK);
        packageLockExists = true;
      } catch {
        packageLockExists = false;
      }

      const command = packageLockExists ? "npm ci --omit=dev" : "npm install --omit=dev";

      try {
        await execPromise(command, {cwd: modulePath, timeout: 120_000});
        await sendUpdateResponse(modulePath, name, onSuccess);
      } catch (error) {
        Log.error(error);
        if (onError) {
          onError(error, {stdout: error.stdout, stderr: error.stderr});
        }
      }
    } catch {
      // No package.json or error reading it
      await sendUpdateResponse(modulePath, name, onSuccess);
    }
  } catch (error) {
    Log.warn(`Error updating ${name}: ${error.message || error}`);
    if (onError) {
      onError(error, {});
    }
  }
}

/**
 * Send update response with optional changelog
 * @param {string} modulePath - Path to module directory
 * @param {string} name - Module name
 * @param {function({code: string, info: string, chlog?: string}): void} callback - Callback({code, info, chlog?})
 * @returns {Promise<void>}
 */
async function sendUpdateResponse (modulePath, name, callback) {
  const changelogPath = `${modulePath}/CHANGELOG.md`;
  const response = {code: "restart", info: `${name} updated.`};

  try {
    response.chlog = await fs.readFile(changelogPath, "utf8");
  } catch {
    // Changelog not found, continue without it
  }

  if (callback) {
    callback(response);
  }
}

module.exports = {
  updateModuleList,
  readModuleData,
  addModule,
  checkModuleUpdate,
  loadModuleDefaultConfig,
  installModule,
  updateModule
};
