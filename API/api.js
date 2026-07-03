/* global Module */

/*
 * MagicMirror²
 * Module Extension: Remote Control API
 *
 * By shbatm
 * MIT Licensed.
 */

const path = require("node:path");
const {randomUUID} = require("node:crypto");
const express = require("express");

const getActions = (handler) => {
  const content = typeof handler === "function"
    ? Function.prototype.toString.call(handler)
    : (typeof handler === "string"
      ? handler
      : "");
  const re = /notification ===? (?:"|')([A-Z_-]+?)(?:"|')|case (?:"|')([A-Z_-]+)(?:"|')/g;
  const availableActions = new Set();
  for (const match of content.matchAll(re)) {
    const n = match[1] ?? match[2];
    if (n && ![
      "ALL_MODULES_STARTED",
      "DOM_OBJECTS_CREATED",
      "KEYPRESS",
      "MODULE_DOM_CREATED",
      "KEYPRESS_MODE_CHANGED",
      "USER_PRESENCE"
    ].includes(n)) {
      availableActions.add(n);
    }
  }
  return [...availableActions];
};

/**
 * Registers color-related API routes (zoom, background color, font color).
 * Extracted to keep createApiRoutes within line limits.
 * @param {object} router - Express router
 * @param {object} context - API context (for executeQuery)
 */
function registerColorRoutes (router, context) {
  router.route(["/zoom/:setting"]).
    get((request, response) => {
    // Only allow numeric settings, otherwise return 400
      if (!(/^\d+$/).test(request.params.setting)) {
        return response.status(400).json({success: false, message: "Invalid zoom setting, must be a number (30-200)"});
      }
      context.executeQuery({action: "ZOOM", value: request.params.setting}, response);
    });

  router.route(["/backgroundcolor/:color"]).
    get((request, response) => {
      const {color} = request.params;
      if (color === "reset") {
        return context.executeQuery({action: "BACKGROUND_COLOR", value: ""}, response);
      }
      if (!(/^[\da-f]{6}$/i).test(color)) {
        return response.status(400).json({success: false, message: "Invalid color, use rrggbb hex format or 'reset'"});
      }
      context.executeQuery({action: "BACKGROUND_COLOR", value: `#${color}`}, response);
    });

  router.route(["/fontcolor/:color"]).
    get((request, response) => {
      const {color} = request.params;
      if (color === "reset") {
        return context.executeQuery({action: "FONT_COLOR", value: ""}, response);
      }
      if (!(/^[\da-f]{6}$/i).test(color)) {
        return response.status(400).json({success: false, message: "Invalid color, use rrggbb hex format or 'reset'"});
      }
      context.executeQuery({action: "FONT_COLOR", value: `#${color}`}, response);
    });
}

module.exports = {

  /*
   * getApiKey
   * Middleware method for ExpressJS to check if an API key is provided.
   * Only checks for an API key if one is defined in the module's config section.
   */
  getApiKey () {
    const thisConfig = this.configOnHd.modules.find((x) => x.module === "MMM-Remote-Control");
    if (thisConfig !== undefined && "config" in thisConfig) {
      this.apiKey = "apiKey" in thisConfig.config && thisConfig.config.apiKey !== "" ? thisConfig.config.apiKey : undefined;
      this.secureEndpoints = "secureEndpoints" in thisConfig.config && !thisConfig.config.secureEndpoints ? false : true;
    }
  },

  /*
   * getExternalApiByGuessing()
   * This method is called when an API call is made to /module or /modules
   * It checks if a string is a Module Name or an Instance Name and returns
   * the actual Module Name
   *
   * @updates this.externalApiRoutes
   */
  getExternalApiByGuessing () {
    if (!this.configOnHd) { return; }

    const skippedModules = new Set(["clock", "compliments", "MMM-Remote-Control"]);
    const activeModules = this.configOnHd.modules.filter((module__) => !skippedModules.has(module__.module));

    for (const module_ of activeModules) {
      if (Object.hasOwn(this.externalApiRoutes, module_.module)) { continue; }

      try {
        const moduleActions = getActions(Module.notificationHandler?.[module_.module]);

        if (moduleActions.length > 0) {
          const actionsGuess = {};

          for (const a of moduleActions) {
            const key = a.replaceAll(/[-_]/g, "").toLowerCase();
            if (key) {
              actionsGuess[key] = {notification: a, guessed: true};
            }
          }

          this.externalApiRoutes[module_.module] = {
            module: module_.module,
            path: module_.module.replaceAll("MMM-", "").replaceAll("-", "").toLowerCase(),
            actions: actionsGuess
          };
        }
      } catch (error) {
        console.warn(`getExternalApiByGuessing failed for ${module_.module}: ${error.message}`);
      }
    }

    this.updateModuleApiMenu();
  },

  createApiRoutes () {
    this.getApiKey();

    this.expressApp.use(express.urlencoded({extended: true}));
    this.expressApp.use(express.json());

    this.expressApp.use("/api/docs", express.static(path.join(__dirname, "../docs"))); // Docs without apikey

    this.expressRouter = express.Router();

    // Route for testing the api at http://mirror:8080/api/test
    this.expressRouter.route(["/test", "/"]). // Test without apiKey
      get((request, response) => {
        response.json({success: true, initialized: Boolean(this.initialized)});
      });

    /*
     * Check for authorization if apiKey is defined in the config.
     * Can be passed as a header "Authorization: apiKey YOURAPIKEY" or "Authorization: Bearer YOURAPIKEY"
     * or can be passed in the url ?apiKey=YOURAPIKEY
     */
    this.expressRouter.use((request, response, next) => {
      if (this.apiKey !== undefined) {
        if (!("authorization" in request.headers) || !(/(apikey|bearer)/gi).test(request.headers.authorization)) {
          // API Key was not provided as a header. Check the URL.
          const {query} = request;
          if ("apiKey" in query) {
            if (query.apiKey !== this.apiKey) {
              return response.status(401).json({success: false, message: "Unauthorized: Wrong API Key Provided!"});
            }
          } else {
            return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided! Pass it as header (Authorization: apiKey YOUR_KEY)."});
          }
        } else if (request.headers.authorization.split(" ", 2)[1] !== this.apiKey) {
          return response.status(401).json({success: false, message: "Unauthorized: Wrong API Key Provided!"});
        }
      }

      // Check for correct Content-Type header (skip check if no content-type is set):
      if (request.method === "POST" && request.headers["content-type"] && !request.is("application/json")) {
        response.status(400).json({success: false, message: "Incorrect content-type, must be 'application/json'"});
        return;
      }

      next(); // make sure we go to the next routes and don't stop here
    });

    this.expressRouter.route([
      "/saves",
      "/classes",
      "/module/installed",
      "/module/available",
      "/brightness",
      "/translations",
      "/mmUpdateAvailable",
      "/config"
    ]).get((request, response) => {
      let r = request.path.slice(1);
      r = r.replace(/\/([a-z])/i, (v) => v.slice(1).toUpperCase()).replace("/", "");
      this.answerGet({data: r}, response);
    });

    let route = [
      "/refresh{/:delayed}",
      "/shutdown{/:delayed}",
      "/reboot{/:delayed}",
      "/restart{/:delayed}",
      "/save",
      "/minimize",
      "/togglefullscreen",
      "/devtools"
    ];

    this.expressRouter.route(route).
      get((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        const r = request.path.split("/", 2)[1].toUpperCase();
        this.executeQuery(this.checkDelay({action: r}, request), response);
      });

    this.expressRouter.route("/classes/:value").
      get((request, response) => {
        const remoteControlConfig = this.configOnHd?.modules?.find((m) => m.module === "MMM-Remote-Control")?.config;
        const configuredClasses = remoteControlConfig?.classes;

        if (!configuredClasses || typeof configuredClasses !== "object") {
          response.status(400).json({success: false, message: "No classes configured. Use /api/classes to inspect available values."});
          return;
        }

        const className = decodeURIComponent(request.params.value);

        if (!Object.hasOwn(configuredClasses, className)) {
          response.status(400).json({success: false, message: `Invalid value ${className} provided in request. Use /api/classes to see actual values`});
          return;
        }

        this.executeQuery({action: "MANAGE_CLASSES", payload: {classes: className}}, response);
      });

    this.expressRouter.route("/command/:value").
      get((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        this.executeQuery({action: "COMMAND", command: request.params.value}, response);
      });

    route = "/userpresence{/:value}";
    this.expressRouter.route(route).
      get((request, response) => {
        if (request.params.value) {
          if (request.params.value === "true" || request.params.value === "false") {
            this.executeQuery({action: "USER_PRESENCE", value: request.params.value === "true"}, response);
          } else {
            response.status(400).json({success: false, message: `Invalid value ${request.params.value} provided in request. Must be true or false.`});
          }
        } else {
          this.answerGet({data: "userPresence"}, response);
        }
      });

    route = "/update{/:moduleName}";
    this.expressRouter.route(route).
      get((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        if (!request.params.moduleName) { return this.answerGet({data: "mmUpdateAvailable"}, response); }
        switch (request.params.moduleName) {
          case "mm": case "MM": this.answerGet({data: "mmUpdateAvailable"}, response); break;

          case "rc": case "RC": this.updateModule("MMM-Remote-Control", response); break;

          default: this.updateModule(request.params.moduleName, response); break;

        }
      });

    this.expressRouter.route("/install").
      get((request, response) => {
        response.status(400).json({success: false, message: "Invalid method, use POST"});
      }).
      post((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        if (request.body !== undefined && "url" in request.body) {
          this.installModule(request.body.url, response);
        } else {
          response.status(400).json({success: false, message: "Invalid URL provided in request body"});
        }
      });

    // edit config, payload is completely new config object with your changes(edits).
    this.expressRouter.route("/config/edit").
      get((request, response) => {
        response.status(400).json({success: false, message: "Invalid method, use POST"});
      }).
      post((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        if (request.body !== undefined && "payload" in request.body) {
          this.answerPost({data: "config"}, {body: request.body.payload}, response);
        } else {
          response.status(400).json({success: false, message: "Invalid URL provided in request body"});
        }
      });
    // edit config

    route = "/notification/:notification{/:p}{/:delayed}";
    this.expressRouter.route(route).
      get((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        this.answerNotifyApi(request, response);
      }).
      post((request, response) => {
        if (!this.apiKey && this.secureEndpoints) { return response.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        request.params = {
          ...request.params,
          ...request.body
        };
        this.answerNotifyApi(request, response);
      });

    route = "/module{/:moduleName}{/:action}{/:delayed}";
    this.expressRouter.route(route).
      get((request, response) => {
        this.answerModuleApi(request, response);
      }).
      post((request, response) => {
        request.params = {
          ...request.params,
          ...request.body
        };
        this.answerModuleApi(request, response);
      });

    route = "/monitor{/:action}{/:delayed}";
    this.expressRouter.route(route).
      get((request, response) => {
        if (!request.params.action) { request.params.action = "STATUS"; }
        const actionName = request.params.action.toUpperCase();
        this.executeQuery(this.checkDelay({action: `MONITOR${actionName}`}, request), response);
      }).
      post((request, response) => {
        let actionName = "STATUS";
        if (request.body !== undefined && "monitor" in request.body) {
          if (["OFF", "ON", "TOGGLE"].includes(request.body.monitor.toUpperCase())) {
            actionName = request.body.monitor.toUpperCase();
          }
        } else {
          actionName = request.params.action ? request.params.action.toUpperCase() : "STATUS";
        }
        this.executeQuery(this.checkDelay({action: `MONITOR${actionName}`}, request), response);
      });

    this.expressRouter.route(["/brightness/:setting"]).
      get((request, response) => {
      // Only allow numeric settings, otherwise return 400
        if (!(/^\d+$/).test(request.params.setting)) {
          return response.status(400).json({success: false, message: "Invalid brightness setting"});
        }
        this.executeQuery({action: "BRIGHTNESS", value: request.params.setting}, response);
      });

    registerColorRoutes(this.expressRouter, this);

    this.expressRouter.route("/timers").get((request, response) => { this.sendResponse(response, undefined, this.delayedQueryTimers); });

    this.expressApp.use("/api", this.expressRouter);
  },

  checkDelay: (query, request) => {

    /*
     * expects .../delay?did=SOME_UNIQUE_ID&timeout=10&abort=false
     * accepts .../delay
     * defaults to a 10s delay with a random UUID as ID.
     */
    if (request.params && request.params.delayed && request.params.delayed === "delay") {
      const dQuery = {
        action: "DELAYED",
        did: request.query.did || request.body.did || randomUUID().replaceAll("-", ""),
        timeout: request.query.timeout || request.body.timeout || 10,
        abort: request.query.abort && request.query.abort === "true" ? true : Boolean(request.query.abort && request.query.abort === "true"),
        query
      };
      return dQuery;
    }
    return query;
  },

  mergeData () {
    const extensionApiRoutes = this.externalApiRoutes;
    const modules = this.configData.moduleData;
    const query = {success: true, data: []};

    for (const module_ of modules) {
      if (extensionApiRoutes[module_.name] === undefined) {
        query.data.push(module_);
      } else {
        query.data.push({...module_, actions: extensionApiRoutes[module_.name].actions, urlPath: extensionApiRoutes[module_.name].path});
      }
    }

    return query;
  },

  answerModuleApi (request, response) {
    this.requireLiveState(response, () => this.resolveModuleApi(request, response));
  },

  resolveModuleApi (request, response) {
    const dataMerged = this.mergeData().data;

    if (!request.params.moduleName) {
      response.json({success: true, data: dataMerged});
      return;
    }

    let moduleData;
    if (request.params.moduleName === "all") {
      moduleData = dataMerged;
    } else {
      const name = request.params.moduleName;
      // First, try exact match on identifier (for specific instances like "module_0_MMM-MotionEye")
      moduleData = dataMerged.filter((m) => m.identifier === name);

      // If no exact match, try exact match on module name
      if (moduleData.length === 0) {
        moduleData = dataMerged.filter((m) => m.name === name);
      }

      // If still no match, try partial match on identifier (for urlPath or custom identifiers)
      if (moduleData.length === 0) {
        moduleData = dataMerged.filter((m) => m.identifier.includes(name) || (m.urlPath && m.urlPath.includes(name)));
      }

      // Finally, try partial match on module name (for backwards compatibility)
      if (moduleData.length === 0) {
        moduleData = dataMerged.filter((m) => m.name.includes(name) || name.includes(m.name));
      }
    }

    if (moduleData.length === 0) {
      response.status(400).json({success: false, message: "Module Name or Identifier Not Found!"});
      return;
    }

    if (!request.params.action) {
      response.json({success: true, data: moduleData});
      return;
    }

    let action = request.params.action.toUpperCase();

    if (["SHOW", "HIDE", "FORCE", "TOGGLE", "DEFAULTS"].includes(action)) { // /api/modules part of the code
      if (action === "DEFAULTS") {
        this.answerGet({data: "defaultConfig", module: request.params.moduleName}, response);
        return;
      }

      if (request.params.moduleName === "all") {
        const query = {module: "all"};
        if (action === "FORCE") {
          query.action = "SHOW";
          query.force = true;
        } else {
          query.action = action;
        }
        this.executeQuery(this.checkDelay(query, request), response);
        return;
      }

      for (let index = 0; index < moduleData.length; index++) {
        const module_ = moduleData[index];
        const query = {module: module_.identifier};
        if (action === "FORCE") {
          query.action = "SHOW";
          query.force = true;
        } else {
          query.action = action;
        }
        // Skip response for all but the last module to avoid "headers already sent" error
        const isSkipResponse = index < moduleData.length - 1;
        this.executeQuery(this.checkDelay(query, request), response, isSkipResponse);
      }
      this.sendSocketNotification("UPDATE");
      return;
    }

    // Check if the module has actions defined
    if (!moduleData[0].actions) {
      // Special case: alert/showalert maps to SHOW_ALERT (MM default module without REGISTER_API)
      if (request.params.moduleName === "alert" && request.params.action === "showalert") {
        this.answerNotifyApi(request, response, {notification: "SHOW_ALERT", prettyName: "Show Alert"});
        return;
      }
      response.status(400).json({success: false, message: `Module ${request.params.moduleName} does not have any actions defined.`});
      return;
    }

    action = moduleData[0].actions[request.params.action];

    if (action) {
      if ("method" in action && action.method !== request.method) {
        response.status(400).json({success: false, message: `Method ${request.method} is not allowed for ${request.params.moduleName}/${request.params.action}.`});
        return;
      }
      this.answerNotifyApi(request, response, action);
    } else {
      response.status(400).json({success: false, message: `Action ${request.params.action} not found for module ${request.params.moduleName}.`});
    }
  },

  answerNotifyApi (request, response, action) {
    // Build the payload to send with our notification.
    let n = "";
    if (action) { n = action.notification; } else if ("notification" in request.params) {
      n = decodeURI(request.params.notification);
    }

    /*
     * If only a URL Parameter is passed, it will be sent as a string
     * If we have either a query string or a payload already provided w the action,
     *  then the parameter will be inside the payload.param property.
     */
    delete request.query.apiKey;
    let query = {notification: n};
    if (request.params.p && request.params.p === "delay") {
      request.params.delayed = request.params.p;
      delete request.params.p;
    }
    if (request.params.delayed && request.params.delayed === "delay") {
      query = this.checkDelay(query, request);
      if (request.query) {
        delete request.query.did;
        delete request.query.abort;
        delete request.query.timeout;
      }
    }

    let payload;
    if (Object.keys(request.query).length === 0 && request.params.p !== undefined) {
      payload = request.params.p;
    } else if (Object.keys(request.query).length > 0 && request.params.p !== undefined) {
      payload = {param: request.params.p, ...request.query};
    } else {
      payload = request.query;
    }
    if (request.method === "POST" && request.body !== undefined) {
      payload = typeof payload === "object" ? {...payload, ...request.body} : {param: payload, ...request.body};
    }
    if (action && "payload" in action) {
      payload = typeof payload === "object" && typeof action.payload === "object"
        ? {...payload, ...action.payload}
        : action.payload;
    }

    /*
     * Convert numeric strings to numbers for cleaner module APIs
     * e.g., /api/notification/PAGE_SELECT/1 should send payload: 1 (not "1")
     * Also supports negative numbers: /api/notification/PAGE_SELECT/-1
     */
    if (typeof payload === "string" && (/^-?\d+$/).test(payload)) {
      payload = Number(payload);
    }

    if ("action" in query && query.action == "DELAYED") {
      query.query.payload = payload;
      query.query.action = "NOTIFICATION";
      this.delayedQuery(query, response);
    } else {
      query.payload = payload;
      this.sendSocketNotification("NOTIFICATION", query);
      response.json({success: true, ...query});
    }

  },

  updateModuleApiMenu () {
    if (!this.thisConfig.showModuleApiMenu) { return; }

    this.moduleApiMenu = {
      id: "module-control",
      type: "menu",
      text: this.translate("%%TRANSLATE:MODULE_CONTROLS%%"),
      icon: "window-restore",
      items: []
    };
    for (const r of Object.values(this.externalApiRoutes)) {
      const sub = {
        id: `mc-${r.path}`,
        type: "menu",
        icon: "bars",
        text: r.module,
        items: []
      };
      for (const [a, action] of Object.entries(r.actions)) {
        const item = {id: `mc-${r.path}-${a}`,
          menu: "item",
          icon: "dot-circle-o",
          action: "NOTIFICATION",
          content: action,
          text: "prettyName" in action ? this.translate(action.prettyName) : this.translate(action.notification).toLowerCase().replaceAll(/(^|_)(\w)/g, ($0, $1, $2) => ($1 && " ") + $2.toUpperCase())};
        sub.items.push(item);
      }
      this.moduleApiMenu.items.push(sub);
    }

    // console.log(JSON.stringify(this.moduleApiMenu, undefined, 3));
    this.sendSocketNotification("REMOTE_CLIENT_MODULEAPI_MENU", this.moduleApiMenu);
  }
};
