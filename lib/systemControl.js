/**
 * @file System Control Functions
 * @module lib/systemControl
 * Handles system operations like monitor control, shutdown/reboot, and Electron window actions
 */

const {exec} = require("node:child_process");
const Log = require("logger");

/**
 * Control monitor power state via custom commands or vcgencmd
 * @param {string} action - Monitor action: MONITORON, MONITOROFF, MONITORTOGGLE, MONITORSTATUS
 * @param {object} config - Configuration object with customCommand settings
 * @param {object} options - Exec options (uid, gid, etc.)
 * @param {object} res - Express response object
 * @param {function(Error, string, string, object, object): void} checkForExecError - Callback to handle exec errors
 * @param {function(string, object): void} sendSocketNotification - Callback to send socket notifications
 * @returns {void}
 */
function monitorControl (action, config, options, res, checkForExecError, sendSocketNotification) {
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
    case "MONITORSTATUS": exec(monitorStatusCommand, options, (error, stdout, stderr) => {
      status = offArray.has(stdout.trim())
        ? "off"
        : "on";
      checkForExecError(error, stdout, stderr, res, {monitor: status});

    });
      break;

    case "MONITORTOGGLE": exec(monitorStatusCommand, options, (error, stdout) => {
      status = offArray.has(stdout.trim())
        ? "off"
        : "on";
      if (status === "on") {
        monitorControl("MONITOROFF", config, options, res, checkForExecError, sendSocketNotification);
      } else {
        monitorControl("MONITORON", config, options, res, checkForExecError, sendSocketNotification);
      }

    });
      break;

    case "MONITORON": exec(monitorOnCommand, options, (error, stdout, stderr) => {
      checkForExecError(error, stdout, stderr, res, {monitor: "on"});
      sendSocketNotification("USER_PRESENCE", true);
    });
      break;

    case "MONITOROFF": exec(monitorOffCommand, options, (error, stdout, stderr) => {
      checkForExecError(error, stdout, stderr, res, {monitor: "off"});
      sendSocketNotification("USER_PRESENCE", false);
    });
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
 * @returns {void}
 */
function shutdownControl (action, config, options, res, sendResponse) {
  const shutdownCommand = config?.customCommand?.shutdownCommand || "sudo shutdown -h now";
  const rebootCommand = config?.customCommand?.rebootCommand || "sudo shutdown -r now";

  if (action === "SHUTDOWN") {
    sendResponse(res, undefined, {action: "SHUTDOWN", info: "Shutting down system..."});
    Log.log(`Executing shutdown command: ${shutdownCommand}`);
    exec(shutdownCommand, options, (error, stdout, stderr) => {
      if (error) {
        // Check for sudo password requirement
        if (error.killed && error.signal === "SIGTERM") {
          Log.error("Shutdown failed: System requires password for shutdown.");
          Log.error("See setup guide: https://github.com/Jopyth/MMM-Remote-Control#faq");
          return;
        }
        Log.error(`Shutdown error: ${stderr || error.message}`);
      } else {
        Log.log("Shutdown command executed successfully - system should be shutting down...");
      }
    });
  }

  if (action === "REBOOT") {
    sendResponse(res, undefined, {action: "REBOOT", info: "Rebooting system..."});
    Log.log(`Executing reboot command: ${rebootCommand}`);
    exec(rebootCommand, options, (error, stdout, stderr) => {
      if (error) {
        // Check for sudo password requirement
        if (error.killed && error.signal === "SIGTERM") {
          Log.error("Reboot failed: System requires password for reboot.");
          Log.error("See setup guide: https://github.com/Jopyth/MMM-Remote-Control#faq");
          return;
        }
        Log.error(`Reboot error: ${stderr || error.message}`);
      } else {
        Log.log("Reboot command executed successfully - system should be rebooting...");
      }
    });
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
    const electron = require("electron").BrowserWindow;
    if (!electron) { throw new Error("Could not get Electron window instance."); }
    const win = electron.getAllWindows()[0];
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
    sendResponse(res, error);
  }
}

module.exports = {
  monitorControl,
  shutdownControl,
  handleElectronActions
};
