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


            case "brightness": {

              const slider = document.querySelector("#brightness-slider");
              slider.value = payload.result;
              this.updateSliderThumbColor(
                slider,
                "brightness"
              );

              break;

            }
            case "temp": {

              const slider = document.querySelector("#temp-slider");
              slider.value = payload.result;
              this.updateSliderThumbColor(
                slider,
                "temp"
              );

              break;

            }
            case "zoom": {

              const slider = document.querySelector("#zoom-slider");
              slider.value = payload.result;
              this.updateSliderThumbColor(
                slider,
                "zoom"
              );

              break;

            }
            case "backgroundColor": {

              const picker = document.querySelector("#background-color-picker");
              if (payload.result) {

                picker.value = payload.result;

              }

              break;

            }
            case "fontColor": {

              const picker = document.querySelector("#font-color-picker");
              if (payload.result) {

                picker.value = payload.result;

              }

              break;

            }
            case "translations":

              this.translations = payload.data;
              this.onTranslationsLoaded();

              break;


            default:

              this.handleLoadList(payload);


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

          setTimeout(
            () => {

              document.location.reload();

            },
            2000
          );
          return;


        case "RESTART":

          setTimeout(
            () => {

              document.location.reload();

            },
            62_000
          );
          return;


        case "REMOTE_CLIENT_CUSTOM_MENU":

          this.customMenu = payload;
          this.createDynamicMenu(this.customMenu);
          return;


        case "REMOTE_CLIENT_MODULEAPI_MENU":

          this.moduleApiMenu = payload;
          this.createDynamicMenu(this.moduleApiMenu);


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
            "headers": {
              "Content-type": "application/x-www-form-urlencoded"
            },
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

    loadList (listname, dataId) {

      const loadingIndicator = document.getElementById(`${listname}-loading`),
        parent = document.getElementById(`${listname}-results`);

      parent.replaceChildren();
      this.show(loadingIndicator);

      return new Promise((resolve, reject) => {

        this.pendingResolver = (parent, data) => {

          resolve({parent, data});

        };
        this.pendingRejecter = (error) => {

          reject(error);

        };
        this.sendSocketNotification(
          "REMOTE_ACTION",
          {"data": dataId, listname}
        );

      });

    },

    handleLoadList (result) {

      const loadingIndicator = document.getElementById(`${result.query.listname}-loading`),
        emptyIndicator = document.getElementById(`${result.query.listname}-empty`),
        parent = document.getElementById(`${result.query.listname}-results`);

      this.hide(loadingIndicator);
      this.savedData[result.query.data] = false;

      try {

        if (result.data.length === 0) {

          this.show(emptyIndicator);

        } else {

          this.hide(emptyIndicator);

        }
        this.savedData[result.query.data] = result.data;

        // Cache moduleInstalled data for repository buttons
        if (result.query.data === "moduleInstalled" && this.installedModulesCacheResolver) {

          this.installedModulesCacheResolver(result);
          delete this.installedModulesCacheResolver;

        }

        if (this.pendingResolver) {

          this.pendingResolver(
            parent,
            result.data
          );
          delete this.pendingResolver;

        }

      } catch (error) {

        console.debug(
          "Error loading list:",
          error
        );
        this.show(emptyIndicator);

      }

    }

  }
);
