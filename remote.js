// main javascript file for the remote control page

var Remote = {
    validPositions: [
        "top_bar", "top_left", "top_center", "top_right",
        "upper_third",
        "middle_center",
        "lower_third",
        "bottom_left", "bottom_center", "bottom_right", "bottom_bar",
        "fullscreen_above",
        "fullscreen_below"
    ],
    savedData: {},
    translations: {},
    currentConfig: {},

    loadButtons: function(buttons) {
        for (var key in buttons) {
            if (buttons.hasOwnProperty(key)) {
                var element = document.getElementById(key);

                element.addEventListener("click", buttons[key], false);
            }
        }
    },

    loadTranslations: function() {
        var self = this;

        this.get("get", "data=translations", function (text) {
            self.translations = JSON.parse(text);
        });
    },

    translate: function(pattern) {
        return this.translations[pattern];
    },

    hasClass: function(element, name) {
        return (' ' + element.className + ' ').indexOf(' ' + name + ' ') > -1;
    },

    loadToggleButton: function(element, toggleCallback) {
        var self = this;

        element.addEventListener("click", function (event) {
            if (self.hasClass(event.currentTarget, "toggled-off"))
            {
                event.currentTarget.className = event.currentTarget.className.replace("toggled-off", "toggled-on");
                if (toggleCallback) {
                    toggleCallback(true, event);
                }
            } else {
                event.currentTarget.className = event.currentTarget.className.replace("toggled-on", "toggled-off");
                if (toggleCallback) {
                    toggleCallback(false, event);
                }
            }
        }, false);
    },

    filter: function(pattern) {
        var regex = new RegExp(pattern, "i");
        var searchIn = ["author", "desc", "longname", "name"];

        var data = this.savedData.modulesAvailable;
        for (var i = 0; i < data.length; i++) {
            var currentData = data[i];
            var id = "install-module-" + i;
            var element = document.getElementById(id);
            if (pattern === "") {
                // cleared search input, show all
                element.style.display = "";
                continue;
            }

            var match = false;
            for (var k = 0; k < searchIn.length; k++) {
                var key = searchIn[k];
                if (currentData[key] && currentData[key].match(regex)) {
                    match = true;
                    break;
                }
            }
            if (match) {
                element.style.display = "";                
            } else {
                element.style.display = "none";
            }
        }
    },

    closePopup: function() {
        var popup = document.getElementById("popup-container");
        popup.style.display = "none";

        var popupContents = document.getElementById("popup-contents");
        while (popupContents.firstChild) {
            popupContents.removeChild(popupContents.firstChild);
        }
    },

    showPopup: function() {
        var popup = document.getElementById("popup-container");
        popup.style.display = "block";
    },

    getPopupContent: function(clear) {
        if (clear === undefined) {
            clear = true;
        }
        if (clear) {
            this.closePopup();
        }
        return document.getElementById("popup-contents");
    },

    loadOtherElements: function() {
        var self = this;

        var slider = document.getElementById("brightness-slider");
        slider.addEventListener("change", function(event) {
            self.getWithStatus("action=BRIGHTNESS&value=" + slider.value);
        }, false);

        var input = document.getElementById("add-module-search");
        var deleteButton = document.getElementById("delete-search-input");

        input.addEventListener("input", function(event) {
            self.filter(input.value);
            if (input.value === "") {
                deleteButton.style.display = "none";
            } else {
                deleteButton.style.display = "";
            }
        }, false);

        deleteButton.addEventListener("click", function(event) {
            input.value = "";
            self.filter(input.value);
            deleteButton.style.display = "none";
        }, false);
    },

    showMenu: function(newMenu) {
        if (newMenu === "add-module-menu") {
            Remote.loadModulesToAdd();
        }
        if (newMenu === "edit-menu") {
            Remote.loadVisibleModules();
        }
        if (newMenu === "settings-menu") {
            Remote.loadConfigModules();
        }

        var allMenus = document.getElementsByClassName("menu-element");

        for (var i = 0; i < allMenus.length; i++) {
            var button = allMenus[i];

            button.style.display = 'none';
        }

        var currentMenu = document.getElementsByClassName(newMenu);

        for (var i = 0; i < currentMenu.length; i++) {
            var button = currentMenu[i];

            if (this.hasClass(button, "inline-menu-element")) {
                button.style.display = 'inline-block';
            } else {
                button.style.display = 'block';
            }
        }

        this.setStatus('none');
    },

    setStatus: function(status) {
        var allMenus = document.getElementsByClassName("status-indicator");

        for (var i = 0; i < allMenus.length; i++) {
            var button = allMenus[i];

            button.style.display = 'none';
        }

        var currentInfo = document.getElementById(status);

        if (currentInfo)
        {
            currentInfo.style.display = 'block';
        }
    },

    getWithStatus: function(params, callback) {
        var self = this;

        self.setStatus("loading");
        self.get("remote", params, function (response) {
            if (callback) {
                callback(response);
            } else {
                var result = JSON.parse(response);
                if (result.status === "success") {
                    self.setStatus("success");
                } else {
                    self.setStatus("error");
                }
            }
        });
    },

    showModule: function(id) {
        this.getWithStatus("action=SHOW&module=" + id);
    },

    hideModule: function(id) {
        this.getWithStatus("action=HIDE&module=" + id);
    },

    install: function(url, index) {
        var self = this;

        var downloadButton = document.getElementById("download-button");
        var symbol = downloadButton.children[0];
        var text = downloadButton.children[1];
        symbol.className = "fa fa-fw fa-spinner fa-pulse";
        text.innerHTML = " " + self.translate("DOWNLOADING");

        self.get("remote", "action=INSTALL&url=" + url, function (response) {
            var result = JSON.parse(response);
            if (result.status === "success") {
                var bgElement = document.getElementById("install-module-" + index);
                bgElement.firstChild.className = "fa fa-fw fa-check-circle";
                self.savedData.modulesAvailable[index].installed = true;
                self.createAddingPopup(index);
            } else {
                symbol.className = "fa fa-fw fa-exclamation-circle";
                text.innerHTML = " " + self.translate("ERROR");
            }
        });
    },

    get: function(route, params, callback, timeout) {
        var req = new XMLHttpRequest();
        var url = route + "?" + params;
        req.open("GET", url, true);

        if (timeout) {
            req.timeout = timeout; // time in milliseconds
        }

        //Send the proper header information along with the request
        req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

        req.onreadystatechange = function() {
            if(req.readyState == 4 && req.status == 200) {
                if (callback)
                {
                    callback(req.responseText);
                }
            }
        }
        req.send(null);
    },

    loadList: function(listname, dataId, callback) {
        var self = this;

        var parent = document.getElementById(listname + "-results");
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }

        this.get("get", "data=" + dataId, function (text) {
            document.getElementById(listname + "-loading").className = "hidden";
            self.savedData[dataId] = [];

            try {
                var data = JSON.parse(text);

                if (data.length === 0) {
                    document.getElementById(listname + "-empty").className = "";
                } else {
                    document.getElementById(listname + "-empty").className = "hidden";
                }
                self.savedData[dataId] = data;
                callback(parent, data);
            } catch (e) {
                document.getElementById(listname + "-empty").className = "";
            }
        });
    },

    formatName: function(string) {
        string = string.replace(/MMM-/ig, "");
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    formatLabel: function(string) {
        var result = string.replace(/([A-Z])/g, " $1" );
        return result.charAt(0).toUpperCase() + result.slice(1);
    },

    formatPosition: function(string) {
        return string.replace("_", " ").replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    },

    getHiddenStatus: function(data) {
        var hiddenStatus = 'toggled-on';
        if (data.hidden) {
            hiddenStatus = 'toggled-off';
            if (data.lockStrings && data.lockStrings.length > 0) {
                hiddenStatus += ' external-locked';
            }
        }
        return hiddenStatus
    },

    addToggleElements: function(parent) {
        var outerSpan = document.createElement("span");
        outerSpan.className = "stack fa-fw";

        spanClasses = [
            "fa fa-fw fa-toggle-on outer-label fa-stack-1x",
            "fa fa-fw fa-toggle-off outer-label fa-stack-1x",
            "fa fa-fw fa-lock inner-small-label fa-stack-1x"
        ];

        for (var i = 0; i < spanClasses.length; i++) {
            var innerSpan = document.createElement("span");
            innerSpan.className = spanClasses[i];
            outerSpan.appendChild(innerSpan);
        }

        parent.appendChild(outerSpan);
    },

    loadVisibleModules: function() {
        var self = this;

        console.log("Load visible modules...");

        this.loadList("visible-modules", "modules", function (parent, moduleData) {
            for (var i = 0; i < moduleData.length; i++) {
                if (!moduleData[i]["position"]) {
                    // skip invisible modules
                    continue;
                }

                var moduleBox = document.createElement("div");
                moduleBox.className = "button module-line " + self.getHiddenStatus(moduleData[i]);
                moduleBox.id = moduleData[i].identifier;

                self.addToggleElements(moduleBox);

                var text = document.createElement("span");
                text.className = "text";
                text.innerHTML = " " + self.formatName(moduleData[i].name);
                moduleBox.appendChild(text);
                
                parent.appendChild(moduleBox);

                self.loadToggleButton(moduleBox, function (toggledOn, event) {
                    if (toggledOn) {
                        self.showModule(event.currentTarget.id);
                    } else {
                        self.hideModule(event.currentTarget.id);
                    }
                });
            }
        });
    },

    createSymbolText: function(symbol, text, eventListener, element) {
        if (element === undefined) {
            element = "div";
        }
        var wrapper = document.createElement(element);
        if (eventListener) {
            wrapper.className = "button";
        }
        var symbolElement = document.createElement("span");
        symbolElement.className = symbol;
        wrapper.appendChild(symbolElement);
        var textElement = document.createElement("span");
        textElement.innerHTML = " " + text;
        wrapper.appendChild(textElement);
        if (eventListener) {
            wrapper.addEventListener("click", eventListener, false);
        }
        return wrapper
    },

    createConfigLabel: function (key, name) {
        var symbol = "fa-tag";
        if (name[0] === "#") {
            symbol = "fa-hashtag";
            name = name.substring(1);
        }
        var label = Remote.createSymbolText("fa fa-fw " + symbol, this.formatLabel(name), function () {
            document.getElementById(key).focus();
        }, "label");
        label.className = "config-label";
        label.htmlFor = key;
        return label;
    },

    createConfigInput: function (key, value) {
        var input = document.createElement("input");
        input.className = "config-input input-spacing";
        input.value = value;
        input.id = key;
        return input;
    },

    createConfigElement: {
        string: function(wrapper, key, name, value) {
            var self = Remote;

            wrapper.appendChild(self.createConfigLabel(key, name));
            var input = self.createConfigInput(key, value);
            input.type = "text";
            input.size = 200;
            wrapper.appendChild(input);
        },
        number: function(wrapper, key, name, value) {
            var self = Remote;

            wrapper.appendChild(self.createConfigLabel(key, name));
            var input = self.createConfigInput(key, value);
            input.type = "number";
            if (value % 1 !== 0) {
                input.step = 0.01;
            }
            wrapper.appendChild(input);
        },
        boolean: function(wrapper, key, name, value) {
            var self = Remote;

            wrapper.appendChild(self.createConfigLabel(key, name));
            var input = self.createConfigInput(key, value);
            input.type = "checkbox";
            wrapper.appendChild(input);
        },
        position: function(wrapper, key, name, value) {
            var self = Remote;

            wrapper.appendChild(self.createConfigLabel(key, name));
            var select = document.createElement("select");
            select.className = "config-input input-spacing";
            select.id = key;
            for (var i = 0; i < self.validPositions.length; i++) {
                var option = document.createElement("option");
                option.value = self.validPositions[i];
                option.innerHTML = self.formatPosition(self.validPositions[i]);
                if (self.validPositions[i] === value) {
                    option.selected = "selected";
                }
                select.appendChild(option);
            }
            wrapper.appendChild(select);
        }
    },

    appendObjectGUI: function(outerWrapper, path, name, dataToEdit) {
        var type = typeof dataToEdit;
        if (path === "<root>/position") {
            type = "position";
        }
        if (this.createConfigElement[type]) {
            // recursion stop
            this.createConfigElement[type](outerWrapper, path, name, dataToEdit);
            return;
        }

        var wrapper = document.createElement("div");
        wrapper.id = path;
        wrapper.className = "indent";
        if (Array.isArray(dataToEdit)) {
            // array
            wrapper.appendChild(this.createSymbolText("fa fa-fw fa-list-ol", name));
            for (var i = 0; i < dataToEdit.length; i++) {
                var newName = "#" + i;
                this.appendObjectGUI(wrapper, path + "/" + newName, newName, dataToEdit[i]);
            }
        } else {
            // object
            if (path !== "<root>") {
                wrapper.appendChild(this.createSymbolText("fa fa-fw fa-list-ul", name));
            }
            // // do not indent config object?
            // if (path === "<root>/config") {
            //     wrapper.className = "";
            // }
            for (var key in dataToEdit) {
                if (dataToEdit.hasOwnProperty(key)) {
                    this.appendObjectGUI(wrapper, path + "/" + key, key, dataToEdit[key]);
                }
            }            
        }
        if (path === "<root>") {
            // overwrite css classes on root element        
            wrapper.className = "flex-fill small";
        } else {
            wrapper.appendChild(this.createSymbolText("fa fa-fw fa-plus", this.translate("ADD_ENTRY")));
        }
        outerWrapper.appendChild(wrapper);
    },

    appendConfigMenu: function(index, wrapper) {
        var self = this;

        var menuElement = self.createSymbolText("small fa fa-fw fa-navicon", self.translate("MENU"), function (event) {
            var elements = document.getElementsByClassName("config-menu");
            for (var i = 0; i < elements.length; i++) {
                var element = elements[i];
                if (self.hasClass(element, "hidden")) {
                    element.className = element.className.replace("hidden", "");
                } else {
                    element.className = element.className + " hidden";
                }
            }
        });
        menuElement.className += " fixed-size";
        wrapper.appendChild(menuElement);

        var menuDiv = document.createElement("div");
        menuDiv.className = "fixed-size hidden config-menu";

        var help = self.createSymbolText("fa fa-fw fa-question-circle", self.translate("HELP"), function (event) {
            // load readme
            console.log("ToDo Helplink");
        });
        menuDiv.appendChild(help);
        var undo = self.createSymbolText("fa fa-fw fa-undo", self.translate("RESET"), function (event) {
            self.createConfigPopup(index);
        });
        menuDiv.appendChild(undo);
        var save = self.createSymbolText("fa fa-fw fa-save", self.translate("SAVE"), function (event) {
            // load readme
            console.log("ToDo Save");
        });
        menuDiv.appendChild(save);

        wrapper.appendChild(menuDiv);

        var line = document.createElement("header");
        line.className = "header";
        wrapper.appendChild(line);
    },

    createConfigPopup: function(index) {
        var self = this;
        if (typeof index === "string") {
            index = parseInt(index);
        }

        var moduleData = this.savedData["config"].modules;
        var data = moduleData[index];

        self.currentConfig = data;

        var wrapper = this.getPopupContent();

        var name = document.createElement("div");
        name.innerHTML = self.formatName(data.module);
        name.className = "bright title medium";
        wrapper.appendChild(name);

        var identifier = document.createElement("div");
        identifier.innerHTML = "#" + (index + 1);
        identifier.className = "dimmed subtitle xsmall";
        wrapper.appendChild(identifier);

        self.appendConfigMenu(index, wrapper);

        self.appendObjectGUI(wrapper, "<root>", "", self.currentConfig);
        // disable input for module name
        document.getElementById("<root>/module").disabled = true;
        document.getElementById("<root>/module").className += " disabled";

        var inputs = document.getElementsByClassName("config-input");
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener("focus", function (event) {
                var label = event.currentTarget.previousSibling;
                label.className = label.className + " focused-label";
            }, false);
            inputs[i].addEventListener("focusout", function (event) {
                var label = event.currentTarget.previousSibling;
                label.className = label.className.replace(" focused-label", "");
            }, false);
            inputs[i].addEventListener("blur", function (event) {
                var label = event.currentTarget.previousSibling;
                label.className = label.className.replace(" focused-label", "");
            }, false);
        }

        this.showPopup();
    },

    loadConfigModules: function() {
        var self = this;

        console.log("Loading modules in config...");

        this.loadList("config-modules", "config", function (parent, configData) {
            var moduleData = configData.modules;
            for (var i = 0; i < moduleData.length; i++) {
                var moduleBox = self.createSymbolText("fa fa-fw fa-pencil", self.formatName(moduleData[i].module), function(event) {
                    var i = event.currentTarget.id.replace("edit-module-", "");
                    self.createConfigPopup(i);
                });
                moduleBox.className = "button module-line";
                moduleBox.id = "edit-module-" + i;
                parent.appendChild(moduleBox);
            }
        });
    },

    createAddingPopup: function(index) {
        var self = this;
        if (typeof index === "string") {
            index = parseInt(index);
        }

        var data = this.savedData["modulesAvailable"][index];
        var wrapper = this.getPopupContent();

        var name = document.createElement("div");
        name.innerHTML = data.name;
        name.className = "bright title";
        wrapper.appendChild(name);

        var author = document.createElement("div");
        author.innerHTML = self.translate("BY") + " " + data.author;
        author.className = "subtitle";
        wrapper.appendChild(author);

        var desc = document.createElement("div");
        desc.innerHTML = data.desc;
        desc.className = "small flex-fill";
        wrapper.appendChild(desc);

        var footer = document.createElement("div");
        footer.className = "fixed-size";

        if (data.installed) {
            var add = self.createSymbolText("fa fa-fw fa-plus", self.translate("ADD_THIS"), function (event) {
                console.log("ToDo");
            });
            footer.appendChild(add);
        }

        if (data.installed) {
            var statusElement = self.createSymbolText("fa fa-fw fa-check-circle", self.translate("INSTALLED"));
            footer.appendChild(statusElement);
        } else {
            var statusElement = self.createSymbolText("fa fa-fw fa-download", self.translate("DOWNLOAD"), function (event) {
                self.install(data.url, index);
            });
            statusElement.id = "download-button";
            footer.appendChild(statusElement);
        }

        var githubElement = self.createSymbolText("fa fa-fw fa-github", self.translate("CODE_LINK"), function (event) {
            window.open(data.url, "_blank");
        });
        footer.appendChild(githubElement);

        wrapper.appendChild(footer);

        this.showPopup();
    },

    loadModulesToAdd: function() {
        var self = this;

        console.log("Loading modules to add...");

        this.loadList("add-module", "modulesAvailable", function (parent, modules) {
            for (var i = 0; i < modules.length; i++) {
                var symbol = "fa fa-fw fa-cloud";
                if (modules[i].installed) {
                    symbol = "fa fa-fw fa-check-circle";
                }

                var moduleBox = self.createSymbolText(symbol, modules[i].name, function (event) {
                    var index = event.currentTarget.id.replace("install-module-", "");
                    self.createAddingPopup(index);
                });
                moduleBox.className = "button module-line";
                moduleBox.id = "install-module-" + i;
                parent.appendChild(moduleBox);
            }
        });
    }
};

var buttons = {
    // navigation buttons
    "power-button": function() {
        window.location.hash = "power-menu";
    },
    "edit-button": function() {
        window.location.hash = "edit-menu";
    },
    "settings-button": function() {
        window.location.hash = "settings-menu";
    },
    "mirror-link-button": function() {
        window.open("/", "_blank");
    },
    "back-button": function() {
        if (window.location.hash === "#add-module-menu") {
            window.location.hash = "settings-menu";
            return;
        }
        window.location.hash = "main-menu";
    },

    // settings menu buttons
    "brightness-reset": function() {
        var element = document.getElementById("brightness-slider");
        element.value = 100;
        Remote.getWithStatus("action=BRIGHTNESS&value=100");
    },

    // edit menu buttons
    "show-all-button": function() {
        var parent = document.getElementById("visible-modules-results");
        var buttons = parent.children;
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].className = buttons[i].className.replace("toggled-off", "toggled-on");
            Remote.showModule(buttons[i].id);
        }
    },
    "hide-all-button": function() {
        var parent = document.getElementById("visible-modules-results");
        var buttons = parent.children;
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].className = buttons[i].className.replace("toggled-on", "toggled-off");
            Remote.hideModule(buttons[i].id);
        }
    },

    // power menu buttons
    "shut-down-button": function() {
        Remote.getWithStatus("action=SHUTDOWN");
    },
    "restart-button": function() {
        Remote.getWithStatus("action=REBOOT");
    },
    "restart-mm-button": function() {
        Remote.getWithStatus("action=RESTART");
    },
    "monitor-on-button": function() {
        Remote.getWithStatus("action=MONITORON");
    },
    "monitor-off-button": function() {
        Remote.getWithStatus("action=MONITOROFF");
    },

    // config menu buttons
    "add-module": function() {
        window.location.hash = "add-module-menu";
    },

    // main menu
    "save-button": function() {
        Remote.getWithStatus("action=SAVE");
    },

    "close-popup": function() {
        Remote.closePopup();
    }
}

Remote.loadTranslations();
Remote.loadButtons(buttons);
Remote.loadOtherElements();

Remote.setStatus("none");

if (window.location.hash) {
    Remote.showMenu(window.location.hash.substring(1));
} else {
    Remote.showMenu("main-menu");
}

window.onhashchange = function() {
    if (window.location.hash) {
        Remote.showMenu(window.location.hash.substring(1));
    } else {
        Remote.showMenu("main-menu");
    }
}

// loading successful, remove error message
var loadError = document.getElementById("load-error");
loadError.parentNode.removeChild(loadError);
