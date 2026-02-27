/**
 * Shared setup for DOM tests using happy-dom.
 * Returns Remote after initializing globals and importing all ESM modules.
 * Safe to call multiple times — modules are cached after first import.
 */

import {Window} from "happy-dom";

let remoteInstance;

export async function setupRemote () {

  if (remoteInstance) {

    return remoteInstance;

  }

  const window = new Window({"url": "http://localhost:8080"});

  globalThis.MMSocket = class {

    constructor (name) {

      this.name = name;

    }

    setNotificationCallback () {}

    sendNotification () {}

  };

  globalThis.document = window.document;
  globalThis.window = window;
  globalThis.location = {"hash": ""};
  globalThis.localStorage = {"getItem": () => {}, "setItem": () => {}};

  const {Remote} = await import("../../remote.mjs");
  await import("../../remote-utils.mjs");
  await import("../../remote-socket.mjs");
  await import("../../remote-modules.mjs");
  await import("../../remote-config.mjs");
  await import("../../remote-menu.mjs");

  remoteInstance = Remote;

  return remoteInstance;

}
