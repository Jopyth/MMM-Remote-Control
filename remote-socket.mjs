/* global MMSocket */
import {Remote} from "./remote.mjs";
import {marked} from "marked";

/**
 * Socket communication methods for MMM-Remote-Control.
 * Covers server communication, action handling, and list loading.
 */
Object.assign(
  Remote,
  {

    /*
     * Socket()
     * Returns a socket object. If it doesn't exist, it's created.
     * It also registers the notification handler.
     */
    socket () {

      if (this._socket === undefined) {

        this._socket = new MMSocket(this.name);

      }

      this._socket.setNotificationCallback((notification, payload) => {

        this.socketNotificationReceived(
          notification,
          payload
        );

      });

      return this._socket;

    },

    /*
     * SendSocketNotification(notification, payload)
     * Send a socket notification to the node helper.
     *
     * argument notification string - The identifier of the notification.
     * argument payload mixed - The payload of the notification.
     */
    sendSocketNotification (notification, payload) {

      this.socket().sendNotification(
        notification,
        payload
      );

    },

    action (name, extra = {}) {

      this.sendSocketNotification("REMOTE_ACTION", {"action": name, ...extra});

    },

    getData (name, extra = {}) {

      this.sendSocketNotification("REMOTE_ACTION", {"data": name, ...extra});

    },

    /*
     * SocketNotificationReceived(notification, payload)
     * This method is called when a socket notification arrives.
     *
     * argument notification string - The identifier of the notification.
     * argument payload mixed - The payload of the notification.
     */
    socketNotificationReceived (notification, payload) {

      if (notification === "REMOTE_ACTION_RESULT") {

        // Console.log("Result received:", JSON.stringify(payload, undefined, 4));
        if ("action" in payload && payload.action === "INSTALL") {

          this.handleInstall(payload);
          return;

        }
        if ("action" in payload && payload.action === "GET_CHANGELOG") {

          this.handleShowChangelog(payload);
          return;

        }
        if ("query" in payload && "data" in payload.query) {

          switch (payload.query.data) {

            case "config_update":

              this.handleSaveConfig(payload);
              break;


            case "saves":

              this.handleRestoreConfigMenu(payload);
              break;


            case "mmUpdateAvailable":

              this.handleMmUpdate(payload.result);
              break;


            case "translations":

              this.translations = payload.data;
              this.onTranslationsLoaded();
              break;


            default: {

              const sliderMap = {
                "brightness": {"selector": "#brightness-slider", "type": "brightness"},
                "temp": {"selector": "#temp-slider", "type": "temp"},
                "zoom": {"selector": "#zoom-slider", "type": "zoom"}
              };
              const pickerMap = {
                "backgroundColor": "#background-color-picker",
                "fontColor": "#font-color-picker"
              };
              const dataKey = payload.query.data;
              if (sliderMap[dataKey]) {

                const {selector, type} = sliderMap[dataKey],
                  slider = document.querySelector(selector);
                slider.value = payload.result;
                this.updateSliderThumbColor(
                  slider,
                  type
                );

              } else if (pickerMap[dataKey]) {

                const picker = document.querySelector(pickerMap[dataKey]);
                if (payload.result) {

                  picker.value = payload.result;

                }

              } else {

                this.handleLoadList(payload);

              }

            }

          }
          return;

        }
        if ("code" in payload && payload.code === "restart") {

          this.offerRestart(payload.chlog
            ? `${payload.info}<br><div id='changelog'>${marked.parse(payload.chlog)}</div>`
            : payload.info);
          return;

        }
        if ("success" in payload) {

          if (!("status" in payload)) {

            payload.status = payload.success
              ? "success"
              : "error";

          }
          const message = payload.status === "error"
            ? `${this.translate("RESPONSE_ERROR")
            }: <br><pre><code>${JSON.stringify(
              payload,
              undefined,
              3
            )}</code></pre>`
            : payload.info;
          this.setStatus(
            payload.status,
            message
          );
          return;

        }

      }
      switch (notification) {

        case "REFRESH":
        case "RESTART": {

          const delay = notification === "RESTART" ? 62_000 : 2000;
          setTimeout(
            () => { document.location.reload(); },
            delay
          );
          return;

        }


        case "REMOTE_CLIENT_CUSTOM_MENU":
        case "REMOTE_CLIENT_MODULEAPI_MENU": {

          const menuKey = notification === "REMOTE_CLIENT_CUSTOM_MENU" ? "customMenu" : "moduleApiMenu";
          this[menuKey] = payload;
          this.createDynamicMenu(payload);
          return;

        }


      }

    },

    async getWithStatus (parameters) {

      this.setStatus("loading");
      const response = await this.get(
        "remote",
        parameters
      );

      try {

        const result = JSON.parse(response);
        if (result.success) {

          this.setStatus(
            "success",
            result.info || null
          );

        } else {

          this.setStatus("error");

        }

      } catch (error) {

        console.error(
          "Error parsing response:",
          error
        );
        this.setStatus("error");

      }

    },

    async get (route, parameters, timeout) {

      const url = `${route}?${parameters}`,
        controller = new AbortController(),
        {signal} = controller;

      if (timeout) {

        setTimeout(
          () => controller.abort(),
          timeout
        );

      }

      try {

        const response = await fetch(
          url,
          {
            "method": "GET",
            signal
          }
        );

        if (!response.ok) {

          throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);

        }

        return await response.text();

      } catch (error) {

        if (error.name === "AbortError") {

          console.error("Request was aborted.");
          document.body.insertAdjacentHTML(
            "beforeend",
            "<div class=\"error-message\">The request was aborted. Please try again.</div>"
          );

        } else {

          console.error(
            "Fetch error:",
            error
          );

        }
        throw error;

      }

    },

    loadList (listname, dataId, timeoutMs = 30_000) {

      const loadingIndicator = document.getElementById(`${listname}-loading`),
        parent = document.getElementById(`${listname}-results`);

      parent?.replaceChildren();
      loadingIndicator?.classList.remove("hidden");

      this._listResolvers ??= new Map();

      // Supersede any previous pending request for the same list
      const existing = this._listResolvers.get(listname);
      if (existing) {

        clearTimeout(existing.timeoutId);
        existing.abort.abort("superseded");

      }

      const {promise, resolve, reject} = Promise.withResolvers(),
        abort = new AbortController();

      const timeoutId = setTimeout(() => {

        this._listResolvers.delete(listname);
        loadingIndicator?.classList.add("hidden");
        document.getElementById(`${listname}-empty`)?.classList.remove("hidden");
        reject(new Error(`loadList: timeout after ${timeoutMs}ms for "${listname}"`));

      }, timeoutMs);

      this._listResolvers.set(listname, {resolve, reject, abort, timeoutId});
      this.getData(dataId, {listname});

      return promise;

    },

    handleLoadList (result) {

      const listname = result.query.listname,
        loadingIndicator = document.getElementById(`${listname}-loading`),
        emptyIndicator = document.getElementById(`${listname}-empty`),
        parent = document.getElementById(`${listname}-results`);

      loadingIndicator?.classList.add("hidden");
      this.savedData[result.query.data] = false;

      const resolver = this._listResolvers?.get(listname);

      if (resolver) {

        clearTimeout(resolver.timeoutId);
        resolver.abort.abort("resolved");
        this._listResolvers.delete(listname);

      }

      try {

        const dataSize = Array.isArray(result.data) ? result.data.length : Object.keys(result.data ?? {}).length;
        emptyIndicator?.classList.toggle("hidden", dataSize > 0);
        this.savedData[result.query.data] = result.data;

        // Cache moduleInstalled data for repository buttons
        if (result.query.data === "moduleInstalled" && this.installedModulesCacheResolver) {

          this.installedModulesCacheResolver(result);
          delete this.installedModulesCacheResolver;

        }

        if (resolver) {

          resolver.resolve({parent, "data": result.data});

        }

      } catch (error) {

        console.debug(
          "Error loading list:",
          error
        );
        emptyIndicator?.classList.remove("hidden");
        if (resolver) {

          resolver.reject(error);

        }

      }

    }

  }
);
