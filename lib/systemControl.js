/**
 * @file System Control Functions
 * @module lib/systemControl
 * Handles system operations like monitor control, shutdown/reboot, and Electron window actions
 */

const {exec} = require("node:child_process");
const Log = require("logger");

/**
 * Promisified exec wrapper that resolves with {stdout, stderr}
 * @param {string} command - Shell command to execute
 * @param {object} options - Options passed to child_process.exec
 * @returns {Promise<{stdout: string, stderr: string}>} Resolves with stdout/stderr
 */
function execAsync (command, options) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({stdout, stderr});
      }
    });
  });
}

/**
 * Control monitor power state via custom commands or vcgencmd
 * @param {string} action - Monitor action: MONITORON, MONITOROFF, MONITORTOGGLE, MONITORSTATUS
 * @param {object} config - Configuration object with customCommand settings
 * @param {object} options - Exec options (uid, gid, etc.)
 * @param {object} res - Express response object
 * @param {function(Error, string, string, object, object): void} checkForExecError - Callback to handle exec errors
 * @param {function(string, object): void} sendSocketNotification - Callback to send socket notifications
 * @returns {Promise<void>}
 */
async function monitorControl (action, config, options, res, checkForExecError, sendSocketNotification) {
  let status = "unknown";
  const offArray = new Set([
    "false",
    "TV is off",
    "standby",
    "display_power=0"
  ]);
  const monitorOnCommand = config?.customCommand?.monitorOnCommand || "vcgencmd display_power 1";
  const monitorOffCommand = config?.customCommand?.monitorOffCommand || "vcgencmd display_power 0";
  const monitorStatusCommand = config?.customCommand?.monitorStatusCommand || "vcgencmd display_power -1";

  switch (action) {
    case "MONITORSTATUS":
      try {
        const {stdout, stderr} = await execAsync(monitorStatusCommand, options);
        status = offArray.has(stdout.trim()) ? "off" : "on";
        checkForExecError(null, stdout, stderr, res, {monitor: status});
      } catch (error) {
        checkForExecError(error, "", "", res, {monitor: status});
      }
      break;


    case "MONITORTOGGLE":
      try {
        const {stdout} = await execAsync(monitorStatusCommand, options);
        status = offArray.has(stdout.trim()) ? "off" : "on";
        if (status === "on") {
          monitorControl("MONITOROFF", config, options, res, checkForExecError, sendSocketNotification);
        } else {
          monitorControl("MONITORON", config, options, res, checkForExecError, sendSocketNotification);
        }
      } catch (error) {
        checkForExecError(error, "", "", res, {monitor: status});
      }
      break;


    case "MONITORON":
      try {
        const {stdout, stderr} = await execAsync(monitorOnCommand, options);
        checkForExecError(null, stdout, stderr, res, {monitor: "on"});
        sendSocketNotification("USER_PRESENCE", true);
      } catch (error) {
        checkForExecError(error, "", "", res, {monitor: "on"});
      }
      break;


    case "MONITOROFF":
      try {
        const {stdout, stderr} = await execAsync(monitorOffCommand, options);
        checkForExecError(null, stdout, stderr, res, {monitor: "off"});
        sendSocketNotification("USER_PRESENCE", false);
      } catch (error) {
        checkForExecError(error, "", "", res, {monitor: "off"});
      }
      break;

  }
}

/**
 * Control system shutdown or reboot via custom commands or sudo
 * @param {string} action - System action: SHUTDOWN or REBOOT
 * @param {object} config - Configuration object with customCommand settings
 * @param {object} options - Exec options (uid, gid, etc.)
 * @param {object} res - Express response object
 * @param {function(object, Error, object): void} sendResponse - Callback to send HTTP response
 * @returns {Promise<void>}
 */
async function shutdownControl (action, config, options, res, sendResponse) {
  const shutdownCommand = config?.customCommand?.shutdownCommand || "sudo shutdown -h now";
  const rebootCommand = config?.customCommand?.rebootCommand || "sudo shutdown -r now";

  if (action === "SHUTDOWN") {
    sendResponse(res, undefined, {action: "SHUTDOWN", info: "Shutting down system..."});
    Log.log(`Executing shutdown command: ${shutdownCommand}`);
    try {
      await execAsync(shutdownCommand, options);
      Log.log("Shutdown command executed successfully - system should be shutting down...");
    } catch (error) {
      if (error.killed && error.signal === "SIGTERM") {
        Log.error("Shutdown failed: System requires password for shutdown.");
        Log.error("See setup guide: https://github.com/Jopyth/MMM-Remote-Control#faq");
      } else {
        Log.error(`Shutdown error: ${error.stderr || error.message}`);
      }
    }
  }

  if (action === "REBOOT") {
    sendResponse(res, undefined, {action: "REBOOT", info: "Rebooting system..."});
    Log.log(`Executing reboot command: ${rebootCommand}`);
    try {
      await execAsync(rebootCommand, options);
      Log.log("Reboot command executed successfully - system should be rebooting...");
    } catch (error) {
      if (error.killed && error.signal === "SIGTERM") {
        Log.error("Reboot failed: System requires password for reboot.");
        Log.error("See setup guide: https://github.com/Jopyth/MMM-Remote-Control#faq");
      } else {
        Log.error(`Reboot error: ${error.stderr || error.message}`);
      }
    }
  }
}

/**
 * Handle Electron window actions (minimize, fullscreen, devtools)
 * @param {object} query - Query object with action field
 * @param {string} query.action - Action: MINIMIZE, TOGGLEFULLSCREEN, or DEVTOOLS
 * @param {object} res - Express response object
 * @param {function(object, Error): void} sendResponse - Callback to send HTTP response
 * @returns {void}
 */
function handleElectronActions (query, res, sendResponse) {
  try {
    const {BrowserWindow} = require("electron");
    if (!BrowserWindow) { throw new Error("Could not get Electron BrowserWindow – is MagicMirror running inside Electron?"); }
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) { throw new Error("No Electron window found."); }
    switch (query.action) {
      case "MINIMIZE":
        win.minimize();
        break;

      case "TOGGLEFULLSCREEN":
        win.setFullScreen(!win.isFullScreen());
        break;

      case "DEVTOOLS":
        if (win.webContents.isDevToolsOpened()) { win.webContents.closeDevTools(); } else { win.webContents.openDevTools(); }
        break;

      default:
    }
    sendResponse(res);
  } catch (error) {
    Log.error(`handleElectronActions failed: ${error.message}`);
    sendResponse(res, error);
  }
}

module.exports = {
  monitorControl,
  shutdownControl,
  handleElectronActions
};
