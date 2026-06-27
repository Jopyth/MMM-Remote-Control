import "./remote-utils.mjs";
import "./remote-socket.mjs";
import "./remote-modules.mjs";
import "./remote-config.mjs";
import "./remote-render.mjs";
import {registerRemoteMenuRouting} from "./remote-menu-routing.mjs";
import {registerRemoteMenuUI} from "./remote-menu-ui.mjs";
import {Remote} from "./remote.mjs";

registerRemoteMenuRouting(Remote);

/**
 * Menu navigation and dynamic menu methods for MMM-Remote-Control.
 * Covers menu switching, header title, element setup, and API-driven menus.
 */
registerRemoteMenuUI(Remote);

// Auto-initialize when fully loaded in browser (all topic files merged into Remote)
if (globalThis.window !== undefined && document.querySelector("#load-error")) {

  Remote.init();

}
