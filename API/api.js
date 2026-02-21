/* global Module */

/*
 * MagicMirror²
 * Module Extension: Remote Control API
 *
 * By shbatm
 * MIT Licensed.
 */

const path = require("node:path");
const url = require("node:url");
const {v4: uuid} = require("uuid");
const express = require("express");

const getActions = (content) => {
  const re = /notification ===? (?:"|')([A-Z_-]+?)(?:"|')|case (?:"|')([A-Z_-]+)(?:"|')/g;
  const availableActions = [];
  if (re.test(content)) {
    for (const match of content.match(re)) {
      const n = match.replaceAll(re, "$1");
      if (![
        "ALL_MODULES_STARTED",
        "DOM_OBJECTS_CREATED",
        "KEYPRESS",
        "MODULE_DOM_CREATED",
        "KEYPRESS_MODE_CHANGED",
        "USER_PRESENCE"
      ].includes(n)) {
        availableActions.push(n);
      }
    }
  }
  return availableActions;
};

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

    for (const module_ of this.configOnHd.modules.filter((module__) => !skippedModules.has(module__.module))) {
      try {
        const moduleActions = getActions(Module.notificationHandler[module_.module]);

        if (moduleActions.length > 0) {
          // Generate formatted actions object
          const actionsGuess = {};

          for (const a of moduleActions) {
            actionsGuess[a.replaceAll(/[-_]/g, "").toLowerCase()] = {notification: a, guessed: true};
          }

          if (module_.module in this.externalApiRoutes) {
            this.externalApiRoutes[module_.module].actions = {...actionsGuess, ...this.externalApiRoutes[module_.module].actions};
          } else {
            this.externalApiRoutes[module_.module] = {
              module: module_.module,
              path: module_.module.replaceAll("MMM-", "").replaceAll("-", "").toLowerCase(),
              actions: actionsGuess
            };
          }
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

    /*
     * MagicMirror² switches to Express 5 with v2.32.0 - to keep compatibility with older versions we need
     * to check for the Express version. Since Express 5 dropt the .del method, we can use that to check.
     * If the method is not available, we are using Express 4.x and need to use the old syntax.
     * This is a temporary solution and will be removed in the future.
     */
    const expressVersionLessThan5 = express.application.del ? true : false;

    // Route for testing the api at http://mirror:8080/api/test
    this.expressRouter.route(["/test", "/"]). // Test without apiKey
      get((request, res) => {
        if (!this.checkInitialized(res)) { return; }
        res.json({success: true});
      });

    /*
     * Check for authorization if apiKey is defined in the config.
     * Can be passed as a header "Authorization: apiKey YOURAPIKEY" or "Authorization: Bearer YOURAPIKEY"
     * or can be passed in the url ?apiKey=YOURAPIKEY
     */
    this.expressRouter.use((request, res, next) => {
      if (this.apiKey !== undefined) {
        if (!("authorization" in request.headers) || request.headers.authorization.search(/(apikey|bearer)/gi) === -1) {
          // API Key was not provided as a header. Check the URL.
          const {query} = url.parse(request.url, true);
          if ("apiKey" in query) {
            if (query.apiKey !== this.apiKey) {
              return res.status(401).json({success: false, message: "Unauthorized: Wrong API Key Provided!"});
            }
          } else {
            return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided! Pass it as header (Authorization: apiKey YOUR_KEY)."});
          }
        } else if (request.headers.authorization.split(" ")[1] !== this.apiKey) {
          return res.status(401).json({success: false, message: "Unauthorized: Wrong API Key Provided!"});
        }
      }

      // Check for correct Content-Type header (skip check if no content-type is set):
      if (request.method === "POST" && request.headers["content-type"] && !request.is("application/json")) {
        res.status(400).json({success: false, message: "Incorrect content-type, must be 'application/json'"});
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
    ]).get((request, res) => {
      let r = request.path.slice(1);
      r = r.replace(/\/([a-z])/i, (v) => v.slice(1).toUpperCase()).replace("/", "");
      this.answerGet({data: r}, res);
    });

    let route = expressVersionLessThan5
      ? [
        "/refresh/:delayed?",
        "/shutdown/:delayed?",
        "/reboot/:delayed?",
        "/restart/:delayed?",
        "/save",
        "/minimize",
        "/togglefullscreen",
        "/devtools"
      ]
      : [
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
      get((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        const r = request.path.split("/")[1].toUpperCase();
        console.log(request.path);
        this.executeQuery(this.checkDelay({action: r}, request), res);
      });

    this.expressRouter.route("/classes/:value").
      get((request, res) => {
        const classes = this.getConfig().modules.find((m) => m.module === "MMM-Remote-Control").config || {};
        const value = decodeURIComponent(request.params.value);
        if (classes.classes && classes.classes[value]) {
          this.executeQuery({action: "MANAGE_CLASSES", payload: {classes: request.params.value}}, res);
        } else {
          res.status(400).json({success: false, message: `Invalid value ${value} provided in request. Use /api/classes to see actual values`});
        }
      });

    this.expressRouter.route("/command/:value").
      get((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        this.executeQuery({action: "COMMAND", command: request.params.value}, res);
      });

    route = expressVersionLessThan5
      ? "/userpresence/:value?"
      : "/userpresence{/:value}";
    this.expressRouter.route(route).
      get((request, res) => {
        if (request.params.value) {
          if (request.params.value === "true" || request.params.value === "false") {
            this.executeQuery({action: "USER_PRESENCE", value: request.params.value === "true"}, res);
          } else {
            res.status(400).json({success: false, message: `Invalid value ${request.params.value} provided in request. Must be true or false.`});
          }
        } else {
          this.answerGet({data: "userPresence"}, res);
        }
      });

    route = expressVersionLessThan5
      ? "/update/:moduleName?"
      : "/update{/:moduleName}";
    this.expressRouter.route(route).
      get((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        if (!request.params.moduleName) { return this.answerGet({data: "mmUpdateAvailable"}, res); }
        switch (request.params.moduleName) {
          case "mm": case "MM": this.answerGet({data: "mmUpdateAvailable"}, res); break;

          case "rc": case "RC": this.updateModule("MMM-Remote-Control", res); break;

          default: this.updateModule(request.params.moduleName, res); break;

        }
      });

    this.expressRouter.route("/install").
      get((request, res) => {
        res.status(400).json({success: false, message: "Invalid method, use POST"});
      }).
      post((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        if (request.body !== undefined && "url" in request.body) {
          this.installModule(request.body.url, res);
        } else {
          res.status(400).json({success: false, message: "Invalid URL provided in request body"});
        }
      });

    // edit config, payload is completely new config object with your changes(edits).
    this.expressRouter.route("/config/edit").
      get((request, res) => {
        res.status(400).json({success: false, message: "Invalid method, use POST"});
      }).
      post((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        if (request.body !== undefined && "payload" in request.body) {
          this.answerPost({data: "config"}, {body: request.body.payload}, res);
        } else {
          res.status(400).json({success: false, message: "Invalid URL provided in request body"});
        }
      });
    // edit config

    route = expressVersionLessThan5
      ? "/notification/:notification/:p?/:delayed?"
      : "/notification/:notification{/:p}{/:delayed}";
    this.expressRouter.route(route).
      get((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        this.answerNotifyApi(request, res);
      }).
      post((request, res) => {
        if (!this.apiKey && this.secureEndpoints) { return res.status(403).json({success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message"}); }
        request.params = {
          ...request.params,
          ...request.body
        };
        this.answerNotifyApi(request, res);
      });

    route = expressVersionLessThan5
      ? "/module/:moduleName?/:action?/:delayed?"
      : "/module{/:moduleName}{/:action}{/:delayed}";
    this.expressRouter.route(route).
      get((request, res) => {
        this.answerModuleApi(request, res);
      }).
      post((request, res) => {
        request.params = {
          ...request.params,
          ...request.body
        };
        this.answerModuleApi(request, res);
      });

    route = expressVersionLessThan5
      ? "/monitor/:action?/:delayed?"
      : "/monitor{/:action}{/:delayed}";
    this.expressRouter.route(route).
      get((request, res) => {
        if (!request.params.action) { request.params.action = "STATUS"; }
        const actionName = request.params.action.toUpperCase();
        this.executeQuery(this.checkDelay({action: `MONITOR${actionName}`}, request), res);
      }).
      post((request, res) => {
        let actionName = "STATUS";
        if (request.body !== undefined && "monitor" in request.body) {
          if (["OFF", "ON", "TOGGLE"].includes(request.body.monitor.toUpperCase())) {
            actionName = request.body.monitor.toUpperCase();
          }
        } else {
          actionName = request.params.action ? request.params.action.toUpperCase() : "STATUS";
        }
        this.executeQuery(this.checkDelay({action: `MONITOR${actionName}`}, request), res);
      });

    this.expressRouter.route(["/brightness/:setting"]).
      get((request, res) => {
      // Only allow numeric settings, otherwise return 400
        if (!(/^\d+$/).test(request.params.setting)) {
          return res.status(400).json({success: false, message: "Invalid brightness setting"});
        }
        this.executeQuery({action: "BRIGHTNESS", value: request.params.setting}, res);
      });

    this.expressRouter.route("/timers").get((request, res) => { this.sendResponse(res, undefined, this.delayedQueryTimers); });

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
        did: request.query.did || request.body.did || uuid().replaceAll("-", ""),
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

  answerModuleApi (request, res) {
    if (!this.checkInitialized(res)) { return; }
    const dataMerged = this.mergeData().data;

    if (!request.params.moduleName) {
      res.json({success: true, data: dataMerged});
      return;
    }

    let moduleData = [];
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
      res.status(400).json({success: false, message: "Module Name or Identifier Not Found!"});
      return;
    }

    if (!request.params.action) {
      res.json({success: true, data: moduleData});
      return;
    }

    let action = request.params.action.toUpperCase();

    if (["SHOW", "HIDE", "FORCE", "TOGGLE", "DEFAULTS"].includes(action)) { // /api/modules part of the code
      if (action === "DEFAULTS") {
        this.answerGet({data: "defaultConfig", module: request.params.moduleName}, res);
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
        this.executeQuery(this.checkDelay(query, request), res);
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
        const skipResponse = index < moduleData.length - 1;
        this.executeQuery(this.checkDelay(query, request), res, skipResponse);
      }
      this.sendSocketNotification("UPDATE");
      return;
    }

    // Check if the module has actions defined
    if (!moduleData[0].actions) {
      // Special case: alert/showalert maps to SHOW_ALERT (MM default module without REGISTER_API)
      if (request.params.moduleName === "alert" && request.params.action === "showalert") {
        this.answerNotifyApi(request, res, {notification: "SHOW_ALERT", prettyName: "Show Alert"});
        return;
      }
      res.status(400).json({success: false, message: `Module ${request.params.moduleName} does not have any actions defined.`});
      return;
    }

    action = moduleData[0].actions[request.params.action];

    if (action) {
      if ("method" in action && action.method !== request.method) {
        res.status(400).json({success: false, message: `Method ${request.method} is not allowed for ${request.params.moduleName}/${request.params.action}.`});
        return;
      }
      this.answerNotifyApi(request, res, action);
    } else {
      res.status(400).json({success: false, message: `Action ${request.params.action} not found for module ${request.params.moduleName}.`});
    }
  },

  answerNotifyApi (request, res, action) {
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

    let payload = {};
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
    if (action && action.payload) {
      payload = typeof payload === "object" ? {...payload, ...action.payload} : {param: payload, ...action.payload};
    }

    if ("action" in query && query.action == "DELAYED") {
      query.query.payload = payload;
      query.query.action = "NOTIFICATION";
      this.delayedQuery(query, res);
    } else {
      query.payload = payload;
      this.sendSocketNotification("NOTIFICATION", query);
      res.json({success: true, ...query});
    }

  },

  checkInitialized (res) {
    if (!this.initialized) {
      this.sendResponse(res, "Not initialized, have you opened or refreshed your browser since the last time you started MagicMirror²?");
      return false;
    }
    return true;
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
      for (const a of Object.keys(r.actions)) {
        const item = {id: `mc-${r.path}-${a}`,
          menu: "item",
          icon: "dot-circle-o",
          action: "NOTIFICATION",
          content: r.actions[a],
          text: "prettyName" in r.actions[a] ? this.translate(r.actions[a].prettyName) : this.translate(r.actions[a].notification).toLowerCase().replaceAll(/(^|_)(\w)/g, ($0, $1, $2) => ($1 && " ") + $2.toUpperCase())};
        sub.items.push(item);
      }
      this.moduleApiMenu.items.push(sub);
    }

    // console.log(JSON.stringify(this.moduleApiMenu, undefined, 3));
    this.sendSocketNotification("REMOTE_CLIENT_MODULEAPI_MENU", this.moduleApiMenu);
  }
};
