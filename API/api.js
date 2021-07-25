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
const uuid = require("uuid/v4");
const bodyParser = require("body-parser");
const express = require("express");

module.exports = {
    /* getApiKey 
     * Middleware method for ExpressJS to check if an API key is provided.
     * Only checks for an API key if one is defined in the module's config section.
     */
    getApiKey: function() {
        let thisConfig = this.configOnHd.modules.find(x => x.module === "MMM-Remote-Control");
        if (typeof "thisConfig" !== "undefined" &&
            "config" in thisConfig){
            if ("apiKey" in thisConfig.config &&
                thisConfig.config.apiKey !== '') {
                this.apiKey = thisConfig.config.apiKey;
            } else {
                this.apiKey = undefined;
            }
            if ("secureEndpoints" in thisConfig.config &&
                !thisConfig.config.secureEndpoints) {
                this.secureEndpoints = false;
            } else {
                this.secureEndpoints = true;
            }
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
        if (!this.configOnHd) { return undefined; }

        let getActions = function(content) {
            let re = /notification \=\=\=? (?:"|')([A-Z_-]+?)(?:"|')|case (?:"|')([A-Z_-]+)(?:"|')/g;
            let m;
            let availabeActions = [];
            if (re.test(content)) {
                content.match(re).forEach((match) => {
                    let n = match.replace(re, '$1');
                    if (['ALL_MODULES_STARTED',
                            'DOM_OBJECTS_CREATED',
                            'KEYPRESS',
                            'MODULE_DOM_CREATED',
                            'KEYPRESS_MODE_CHANGED',
                            'USER_PRESENCE'
                        ].indexOf(n) === -1) {
                        availabeActions.push(n);
                    }
                });
            }
            return availabeActions;
        };

        let skippedModules = ['clock', 'compliments', 'MMM-Remote-Control'];

        this.configOnHd.modules.filter(mod => skippedModules.indexOf(mod.module) === -1).forEach(mod => {
            try {
                let modActions = getActions(Module.notificationHandler[mod.module]);

                if (modActions.length > 0) {
                    let pathGuess = mod.module.replace(/MMM-/g, '').replace(/-/g, '').toLowerCase();

                    // Generate formatted actions object
                    let actionsGuess = {};

                    modActions.forEach(a => {
                        actionsGuess[a.replace(/[-_]/g, '').toLowerCase()] = { notification: a, guessed: true };
                    });

                    if (pathGuess in this.externalApiRoutes) {
                        this.externalApiRoutes[pathGuess].actions = Object.assign({}, actionsGuess, this.externalApiRoutes[pathGuess].actions);
                    } else {
                        this.externalApiRoutes[pathGuess] = {
                            module: mod.module,
                            path: mod.module.replace(/MMM-/g, '').replace(/-/g, '').toLowerCase(),
                            actions: actionsGuess
                        };
                    }
                }
            } catch (err) {
                console.warn(`getExternalApiByGuessing failed for ${mod.module}: ${err.message}`);
            }
        });

        this.updateModuleApiMenu();
    },

    createApiRoutes: function() {
        var self = this;

        this.getApiKey();

        this.expressApp.use(bodyParser.urlencoded({ extended: true }));
        this.expressApp.use(bodyParser.json());
        
        this.expressApp.use('/api/docs', express.static(path.join(__dirname, '../docs'))); // Docs without apikey

        this.expressRouter = express.Router();
        
        // Route for testing the api at http://mirror:8080/api/test
        this.expressRouter.route(['/test','/']) // Test without apiKey
            .get((req, res) => {
                if (!this.checkInititialized(res)) { return; }
                res.json({ success: true });
            });

        // Check for authorization if apiKey is defined in the config.
        // Can be passed as a header "Authorization: apiKey YOURAPIKEY" or "Authorization: Bearer YOURAPIKEY"
        // or can be passed in the url ?apiKey=YOURAPIKEY
        this.expressRouter.use((req, res, next) => {
            if (typeof this.apiKey !== "undefined") {
                if (!("authorization" in req.headers) || req.headers.authorization.search(/(apikey|bearer)/gi) === -1) {
                    // API Key was not provided as a header. Check the URL.
                    var query = url.parse(req.url, true).query;
                    if ("apiKey" in query) {
                        if (query.apiKey !== this.apiKey) {
                            return res.status(401).json({ success: false, message: "Unauthorized: Wrong API Key Provided!" });
                        }
                    } else {
                        return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided!" });
                    }
                } else if (req.headers.authorization.split(" ")[1] !== this.apiKey) {
                    return res.status(401).json({ success: false, message: "Unauthorized: Wrong API Key Provided!" });
                }
            }

            // Check for correct Content-Type header:
            if (req.method === "POST" && !req.is('application/json')) {
                res.status(400).json({ success: false, message: "Incorrect content-type, must be 'application/json'" });
                return;
            }

            next(); // make sure we go to the next routes and don't stop here
        });

        this.expressRouter.route([
        	'/saves',
        	'/classes',
            '/module/installed',
            '/module/available',
            '/brightness',
            '/translations',
            '/mmUpdateAvailable',
            '/config'
        ]).get((req, res) => {
            let r = req.path.substring(1);
            r = r.replace(/\/([a-z])/i, function(v) { return v.substring(1).toUpperCase(); }).replace('/','');
            self.answerGet({ data: r }, res);
        });

        this.expressRouter.route([
            '/refresh/:delayed?',
            '/shutdown/:delayed?',
            '/reboot/:delayed?',
            '/restart/:delayed?',
            '/save',
            '/minimize',
            '/togglefullscreen',
            '/devtools'
        ]).get((req, res) => {
            if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
            let r = req.path.split("/")[1].toUpperCase();
            console.log(req.path);
            self.executeQuery(this.checkDelay({ action: r }, req), res);
        });
        
        this.expressRouter.route('/classes/:value')
            .get((req, res) => {
                var classes = self.getConfig().modules.find(m => m.module === "MMM-Remote-Control").config || {};
                const val = decodeURIComponent(req.params.value)
                if(classes.classes && classes.classes[val]) {
                	self.executeQuery({ action: "MANAGE_CLASSES", payload: { classes: req.params.value} }, res);
                } else {
               		res.status(400).json({ success: false, message: `Invalid value ${val} provided in request. Use /api/classes to see actual values` });
               	}
            });
            
        this.expressRouter.route('/command/:value')
            .get((req, res) => {
                if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
                const val = decodeURIComponent(req.params.value)
                self.executeQuery({ action: "COMMAND", command: req.params.value }, res);
            });

        this.expressRouter.route('/userpresence/:value?')
            .get((req, res) => {
                if (req.params.value) {
                    if (req.params.value === "true" || req.params.value === "false") {
                        self.executeQuery({ action: "USER_PRESENCE", value: (req.params.value === "true") }, res);
                    } else {
                        res.status(400).json({ success: false, message: `Invalid value ${req.params.value} provided in request. Must be true or false.` });
                    }
                } else {
                    self.answerGet({ data: "userPresence" }, res);
                }
            });

        this.expressRouter.route('/update/:moduleName?')
            .get((req, res) => {
                if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
                if(!req.params.moduleName) return self.answerGet({ data: 'mmUpdateAvailable' }, res);
                switch(req.params.moduleName) {
                    case 'mm': case 'MM': self.answerGet({ data: 'mmUpdateAvailable' }, res); break;
                    case 'rc': case 'RC': this.updateModule('MMM-Remote-Control', res); break;
                    default: this.updateModule(req.params.moduleName, res); break;
                }
            });

        this.expressRouter.route('/install')
            .get((req, res) => {
                res.status(400).json({ success: false, message: "Invalid method, use POST" });
            })
            .post((req, res) => {
                if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
                if (typeof req.body !== 'undefined' && "url" in req.body) {
                    this.installModule(req.body.url, res);
                } else {
                    res.status(400).json({ success: false, message: "Invalid URL provided in request body" });
                }
            });
        
        //edit config, payload is completely new config object with your changes(edits).
        this.expressRouter.route('/config/edit')
            .get((req, res) => {
                res.status(400).json({ success: false, message: "Invalid method, use POST" });
            })
            .post((req, res) => {
                if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
                if (typeof req.body !== 'undefined' && "payload" in req.body) {
                    this.answerPost({ data: "config" }, { body: req.body.payload }, res);
                } else {
                    res.status(400).json({ success: false, message: "Invalid URL provided in request body" });
                }
            });
        //edit config

        this.expressRouter.route('/notification/:notification/:p?/:delayed?')
            .get((req, res) => {
                if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
                this.answerNotifyApi(req, res);
            })
            .post((req, res) => {
                if(!this.apiKey && this.secureEndpoints) return res.status(403).json({ success: false, message: "Forbidden: API Key Not Provided in Config! Use secureEndpoints to bypass this message" });
                this.answerNotifyApi(req, res);
            });

        this.expressRouter.route('/module/:moduleName?/:action?/:delayed?')
            .get((req, res) => {
                this.answerModuleApi(req, res);
            })
            .post((req, res) => {
                this.answerModuleApi(req, res);
            });

        this.expressRouter.route('/monitor/:action?/:delayed?')
            .get((req, res) => {
                if (!req.params.action) { req.params.action = "STATUS"; }
                var actionName = req.params.action.toUpperCase();
                this.executeQuery(this.checkDelay({ action: `MONITOR${actionName}` }, req), res);
            })
            .post((req, res) => {
                var actionName = "STATUS";
                if (typeof req.body !== 'undefined' && "monitor" in req.body) {
                    if(["OFF","ON","TOGGLE"].includes(req.body.monitor.toUpperCase())) {
                        actionName = req.body.monitor.toUpperCase();
                    }
                } else {
                    var actionName = req.params.action ? req.params.action.toUpperCase() : "STATUS";
                }
                this.executeQuery(this.checkDelay({ action: `MONITOR${actionName}` }, req), res);
            });

        this.expressRouter.route('/brightness/:setting(\\d+)')
            .get((req, res) => {
                this.executeQuery({ action: `BRIGHTNESS`, value: req.params.setting }, res);
            });

        this.expressRouter.route('/timers').get((req, res) => { this.sendResponse(res, undefined, this.delayedQueryTimers); });

        this.expressApp.use('/api', this.expressRouter);

        this.getExternalApiByGuessing();
    },

    checkDelay: (query, req) => {
        // expects .../delay?did=SOME_UNIQUE_ID&timeout=10&abort=false
        // accepts .../delay
        // defaults to a 10s delay with a random UUID as ID.
        if (req.params && req.params.delayed && req.params.delayed === "delay") {
            let dQuery = {
                action: "DELAYED",
                did: (req.query.did) ? req.query.did : (req.body.did) ? req.body.did : uuid().replace(/-/g, ''),
                timeout: (req.query.timeout) ? req.query.timeout : (req.body.timeout) ? req.body.timeout : 10,
                abort: (req.query.abort && req.query.abort === "true") ? true : (req.query.abort && req.query.abort === "true") ? true : false,
                query: query
            };
            return dQuery;
        }
        return query;
    },
    
    mergeData: function() {
        var extApiRoutes = this.externalApiRoutes;
        var modules = this.configData.moduleData
        var query = {success: true, data: []};
        
        modules.forEach((mod) => {
            if (extApiRoutes[mod.name] === undefined) {
                query.data.push(mod);
            } else {
                query.data.push(Object.assign({},mod, {actions: extApiRoutes[mod.name].actions}));
            }
        })
        
        return query;
    },

    answerModuleApi: function(req, res) {
        if (!this.checkInititialized(res)) { return; }
        var dataMerged = this.mergeData().data
        
        if (!req.params.moduleName) {
            res.json({ success: true, data: dataMerged });
            return;
        }
        
        var modData = [];
        if(req.params.moduleName !== 'all') {
            let i = dataMerged.find(m => {
                return (req.params.moduleName.includes(m.identifier));
            });
            if (!i) {
                modData = dataMerged.filter(m => {
                    return (req.params.moduleName.includes(m.name));
                });
            } else modData.push(i)
        } else {
            modData = dataMerged;
        }
    
        if (!modData.length) {
            res.status(400).json({ success: false, message: "Module Name or Identifier Not Found!" });
            return;
        } 
        
        if (!req.params.action) {
            res.json({ success: true, data: dataMerged.filter(m => req.params.moduleName.includes(m.name)) });
            return;
        }
        
        var action = req.params.action.toUpperCase();
        
        if (["SHOW", "HIDE", "FORCE", "TOGGLE", "DEFAULTS"].indexOf(action) !== -1) { // /api/modules part of the code
            
            if (action === "DEFAULTS") {
                this.answerGet({ data: "defaultConfig", module: mod.name }, res);
                return;
            }
            
            if (req.params.moduleName === "all") {
                let query = { module: "all" };
                if (action === "FORCE") {
                    query.action = "SHOW";
                    query.force = true;
                } else {
                    query.action = action;
                }
                this.executeQuery(this.checkDelay(query, req), res);
                return;
            }
            
            modData.forEach(mod => {
                let query = { module: mod.identifier };
                if (action === "FORCE") {
                    query.action = "SHOW";
                    query.force = true;
                } else {
                    query.action = action;
                }
                this.executeQuery(this.checkDelay(query, req), res);
            });
            this.sendSocketNotification("UPDATE");
            return;
        }
        
        action = modData[0].actions[req.params.action]
        
        if (action) {
            if ("method" in action && action.method !== req.method) {
                res.status(400).json({ success: false, info: `Method ${req.method} is not allowed for ${moduleName}/${req.params.action}.` });
                return;
            }
            this.answerNotifyApi(req, res, action);
        }
        
    },
    
    answerNotifyApi: function(req, res, action) {
        // Build the payload to send with our notification.
        let n = "";
        if (action) { n = action.notification; } else if ("notification" in req.params) {
            n = decodeURI(req.params.notification);
        }
        // If only a URL Parameter is passed, it will be sent as a string
        // If we have either a query string or a payload already provided w the action,
        //  then the paramteter will be inside the payload.param property.
        delete req.query.apiKey;
        let query = { notification: n };
        if (req.params.p && req.params.p === "delay") {
            req.params.delayed = req.params.p;
            delete req.params.p;
        }
        if (req.params.delayed && req.params.delayed === "delay") {
            query = this.checkDelay(query, req);
            if (req.query) {
                delete req.query.did;
                delete req.query.abort;
                delete req.query.timeout;
            }
        }

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
        if (action && action.payload) {
            if (typeof payload === "object") {
                payload = Object.assign({}, payload, action.payload);
            } else {
                payload = Object.assign({}, { param: payload }, action.payload);
            }
        }

        if ("action" in query && query.action == "DELAYED") {
            query.query.payload = payload;
            query.query.action = "NOTIFICATION";
            this.delayedQuery(query, res);
        } else {
            query.payload = payload;
            this.sendSocketNotification("NOTIFICATION", query);
            res.json(Object.assign({ success: true }, query));
        }
        return;
    },

    checkInititialized: function(res) {
        if (!this.initialized) {
            this.sendResponse(res, "Not initialized, have you opened or refreshed your browser since the last time you started MagicMirror?");
            return false;
        }
        return true;
    },

    updateModuleApiMenu: function() {
        if (!this.thisConfig.showModuleApiMenu) { return; }

        this.moduleApiMenu = {
            id: "module-control",
            type: "menu",
            text: this.translate("%%TRANSLATE:MODULE_CONTROLS%%"),
            icon: "window-restore",
            items: []
        };
        Object.keys(this.externalApiRoutes).forEach(r => {
            let sub = {
                id: "mc-" + r,
                type: "menu",
                icon: "bars",
                text: this.formatName(this.externalApiRoutes[r].module),
                items: []
            };
            Object.keys(this.externalApiRoutes[r].actions).forEach(a => {
                let item = {
                    id: `mc-${r}-${a}`,
                    menu: "item",
                    icon: "dot-circle-o",
                    action: "NOTIFICATION",
                    content: this.externalApiRoutes[r].actions[a]
                };
                if ("prettyName" in this.externalApiRoutes[r].actions[a]) {
                    item.text = this.translate(this.externalApiRoutes[r].actions[a].prettyName);
                } else {
                    item.text = this.translate(this.externalApiRoutes[r].actions[a].notification).toLowerCase().replace(/(^|_)(\w)/g, function($0, $1, $2) {
                        return ($1 && ' ') + $2.toUpperCase();
                    });
                }
                sub.items.push(item);
            });
            this.moduleApiMenu.items.push(sub);
        });

        // console.log(JSON.stringify(this.moduleApiMenu, undefined, 3));
        this.sendSocketNotification("REMOTE_CLIENT_MODULEAPI_MENU", this.moduleApiMenu);
    },
};
