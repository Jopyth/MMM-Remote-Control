/* Magic Mirror
 * Module Extension: Remote Control API
 *
 * By shbatm
 * MIT Licensed.
 */
/* jshint node: true, esversion: 6 */

const path = require("path");
const url = require("url");
const fs = require("fs");
const os = require("os");
const bodyParser = require("body-parser");
const express = require("express");

module.exports = {
    /* getApiKey 
     * Middleware method for ExpressJS to check if an API key is provided.
     * Only checks for an API key if one is defined in the module's config section.
     */
    getApiKey: function() {
        console.log("getApiKey called.");
        let thisConfig = this.configOnHd.modules.find(x => x.module === "MMM-Remote-Control");
        if (typeof "thisConfig" !== "undefined" &&
            "config" in thisConfig &&
            "apiKey" in thisConfig.config) {
            this.apiKey = thisConfig.config.apiKey;
        } else {
            this.apiKey = undefined;
        }
    },


    /* getExternalApiByGuessing()
     * This method is called when an API call is made to /module or /modules
     * It checks if a string is a Module Name or an Instance Name and returns
     * the actual Module Name
     *
     * @updates this.externalApiRoutes
     */
    getExternalApiByGuessing: function() {
        if (!this.configData) { return undefined; }

        let getActions = function(content) {
            let re = /notification \=\=\=? "([A-Z_]+)"|case '([A-Z_]+)'/g;
            let m;
            let availabeActions = [];

            if (re.test(content)) {
                content.match(re).forEach((match) => {
                    let n = match.replace(re, '$1');
                    if (['ALL_MODULES_STARTED', 'DOM_OBJECTS_CREATED'].indexOf(n) < 0) {
                        availabeActions.push(n);
                    }
                });
            }

            return availabeActions;
        };

        let skippedModules = ['clock', 'MMM-Remote-Control'];
        this.configData.moduleData.filter(mod => skippedModules.indexOf(mod.name) === -1).forEach(mod => {
            try {
                let modFile = fs.readFileSync(path.resolve(`${__dirname}/../../../${mod.path}${mod.file}`), 'utf8');
                let modActions = getActions(modFile);

                if (modActions.length > 0) {
                    let pathGuess = mod.name.replace(/MMM-/g, '').replace(/-/g, '').toLowerCase();

                    // Generate formatted actions object
                    let actionsGuess = {};

                    modActions.forEach(a => {
                        actionsGuess[a.replace(/[-_]/g, '').toLowerCase()] = { notification: a };
                    });

                    if (pathGuess in this.externalApiRoutes) {
                        this.externalApiRoutes[pathGuess].actions = Object.assign({}, actionsGuess, this.externalApiRoutes[pathGuess].actions);
                    } else {
                        this.externalApiRoutes[pathGuess] = {
                            module: mod.name,
                            path: mod.name.replace(/MMM-/g, '').replace(/-/g, '').toLowerCase(),
                            actions: actionsGuess,
                            guessed: true
                        };
                    }
                }
            } catch (err) {
                console.warn(`getExternalApiByGuessing failed for ${mod.name}: ${err.message}`);
            }
        });
    },

    createApiRoutes: function() {
        var self = this;

        this.getApiKey();

        this.expressApp.use(bodyParser.urlencoded({ extended: true }));
        this.expressApp.use(bodyParser.json());

        this.expressRouter = express.Router();

        // Check for authorization if apiKey is defined in the config.
        // Can be passed as a header "Authorization: apiKey YOURAPIKEY"
        // or can be passed in the url ?apiKey=YOURAPIKEY
        this.expressRouter.use((req, res, next) => {
            if (typeof this.apiKey !== "undefined") {
                if (!("authorization" in req.headers) && req.headers.authorization.indexOf("apiKey") !== 0) {
                    // API Key was not provided as a header. Check the URL.
                    var query = url.parse(req.url, true).query;
                    if ("apiKey" in query) {
                        if (query.apiKey !== this.apiKey) {
                            return res.status(401).end();
                        }
                    } else {
                        return res.status(403).end();
                    }
                } else if (req.headers.authorization.split(" ")[1] !== this.apiKey) {
                    return res.status(401).end();
                }
            }

            next(); // make sure we go to the next routes and don't stop here
        });

        // Route for testing the api at http://mirror:8080/api/test
        this.expressRouter.route('/test')
            .get((req, res) => {
                res.json({ success: true });
            });

        this.expressRouter.route([
            '/modules',
            '/modulesInstalled',
            '/modulesAvailable',
            '/brightness',
            '/translations',
            '/mmUpdateAvailable',
            '/config',
            '/defaultConfig'
        ]).get((req, res) => {
            self.answerGet({ data: req.path.substring(1) }, res);
        });

        this.expressRouter.route('/modules/:moduleName/:action?')
            .get((req, res) => {
                this.answerModuleApi(req, res);
            });

        // Add routes to be extended by other modules.
        this.expressRouter.route('/module/:moduleName?/:action?/:p?')
            .get((req, res) => {
                this.answerExternalApi(req, res);
            })
            .post((req, res) => {
                if (!req.is('application/json')) {
                    res.status(400).json({ success: false, message: "Incorrect content-type, must be 'application/json'" });
                    return;
                } else {
                    this.answerExternalApi(req, res);
                }
            });

        this.expressRouter.route('/monitor/:action')
            .get((req, res) => {
                var actionName = req.params.action.toUpperCase();
                this.executeQuery({ action: `MONITOR${actionName}` }, res);
            });

        this.expressRouter.route('/brightness/:setting(\\d+)')
            .get((req, res) => {
                this.executeQuery({ action: `BRIGHTNESS`, value: req.params.setting }, res);
            });

        this.expressApp.use('/api', this.expressRouter);
    },

    answerModuleApi: function(req, res) {
        if (!this.configData) {
            res.json({ success: false, message: "API not yet implemented" });
            return;
        }
        let modData = this.configData.moduleData.filter(m => m.name === req.params.moduleName || m.identifier === req.params.moduleName);
        if (!modData) {
            res.json({ success: false, message: "Module Name or Identifier Not Found!" });
            return;
        }
        if (!req.params.action) {
            res.json({ success: true, data: modData });
            return;
        }

        let actionName = req.params.action.toUpperCase();

        try {
            modData.forEach(mod => {
                if (["SHOW", "HIDE", "FORCE"].indexOf(actionName) !== -1) {
                    let query = { module: mod.identifier };
                    if (actionName === "FORCE") {
                        query.action = "SHOW";
                        query.force = true;
                    } else {
                        query.action = actionName;
                    }
                    this.executeQuery(query, res);
                } else {
                    throw "Invalid Action!";
                }
            });
        } catch (err) {
            res.json({ success: false, message: e.message });
            return;
        }
    },

    /* answerExternalApi(req, res)
     * This method is called when an API call is made to /module/:moduleName...
     * It provides a method for responding to external api calls (calls for other modules).
     * External API calls can be registered from another module by sending this module a
     * notification upon startup.
     *
     * @param {object} req - Express Request Object
     * @param {object} res - Express Response Object
     */
    answerExternalApi: function(req, res) {
        if (!req.params.moduleName) {
            res.json(Object.assign({ success: true }, this.externalApiRoutes));
            return;
        }

        if (!(req.params.moduleName in this.externalApiRoutes)) {
            res.json({ success: false, info: `No API routes found for ${req.params.moduleName}.` });
            return;
        }

        let moduleApi = this.externalApiRoutes[req.params.moduleName];
        if (!req.params.action) {
            res.json(Object.assign({ success: true }, moduleApi));
            return;
        }

        if (!(req.params.action in moduleApi.actions)) {
            res.json({ success: false, info: `Action ${req.params.action} is not a valid action for ${moduleApi.module}.` });
            return;
        }
        let action = moduleApi.actions[req.params.action];
        if ("method" in action && action.method !== req.method) {
            res.json({ success: false, info: `Method ${req.method} is not allowed for ${moduleName}/${req.params.action}.` });
            return;
        }

        // Build the payload to send with our notification.
        // If only a URL Parameter is passed, it will be sent as a string
        // If we have either a query string or a payload already provided w the action,
        //  then the paramteter will be inside the payload.param property.
        delete req.query.apiKey;
        let payload = {};
        if (Object.keys(req.query).length === 0 && typeof req.params.p !== "undefined") {
            payload = req.params.p;
        } else if (Object.keys(req.query).length !== 0 && typeof req.params.p !== "undefined") {
            payload = Object.assign({ param: req.params.p }, req.query);
        } else {
            payload = req.query;
        }
        if (req.method === "POST" && typeof req.body !== "undefined") {
            if (typeof payload === "object") {
                payload = Object.assign({}, payload, req.body);
            } else {
                payload = Object.assign({}, { param: payload }, req.body);
            }
        }
        if (action.payload) {
            if (typeof payload === "object") {
                payload = Object.assign({}, payload, action.payload);
            } else {
                payload = Object.assign({}, { param: payload }, action.payload);
            }
        }

        this.sendSocketNotification("NOTIFICATION", { notification: action.notification, payload: payload });
        res.json({ success: true, notification: action.notification, payload: payload });
        return;
    },

    checkInititialized: function(res) {
        if (!this.initialized) {
            res.json({
                success: false,
                message: "Not initialized, have you opened or refreshed your browser since the last time you started MagicMirror?"
            });
            return false;
        }
        return true;
    },

};