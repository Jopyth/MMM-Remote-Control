// main javascript file for the remote control page

var Remote = {
    savedData : {},

    loadButtons: function(buttons) {
        for (var key in buttons) {
            if (buttons.hasOwnProperty(key)) {
                var element = document.getElementById(key);

                element.addEventListener("click", buttons[key], false);
            }
        }
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

    getPopupContent: function() {
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

    get: function(route, params, callback) {
        var http = new XMLHttpRequest();
        var url = route + "?" + params;
        http.open("GET", url, true);

        //Send the proper header information along with the request
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

        http.onreadystatechange = function() {
            if(http.readyState == 4 && http.status == 200) {
                if (callback)
                {
                    callback(http.responseText);
                }
            }
        }
        http.send(null);
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

    loadConfigModules: function() {
        var self = this;

        this.loadList("config-modules", "modules", function (parent, moduleData) {
            for (var i = 0; i < moduleData.length; i++) {
                var moduleBox = document.createElement("div");
                moduleBox.className = "button module-line";
                moduleBox.id = moduleData[i].identifier;

                var symbol = document.createElement("span");
                symbol.className = "fa fa-fw fa-pencil";
                moduleBox.appendChild(symbol);

                var text = document.createElement("span");
                text.className = "text";
                text.innerHTML = " " + self.formatName(moduleData[i].name);
                moduleBox.appendChild(text);

                parent.appendChild(moduleBox);
            }
        });
    },

    createAddingPopup: function(index) {
        var data = this.savedData["modulesAvailable"][index];
        var wrapper = this.getPopupContent();

        var name = document.createElement("div");
        name.innerHTML = data.name;
        name.className = "bright margin-right";
        wrapper.appendChild(name);

        var author = document.createElement("div");
        author.innerHTML = "by " + data.author;
        author.className = "align-right";
        wrapper.appendChild(author);

        var desc = document.createElement("div");
        desc.innerHTML = data.desc;
        desc.className = "small";
        wrapper.appendChild(desc);

        var desc = document.createElement("div");
        wrapper.appendChild(desc);

        var status = document.createElement("div");
        var symbol = document.createElement("span");
        var text = document.createElement("span");
        if (data.installed) {
            symbol.className = "fa fa-fw fa-check-circle";
            text.innerHTML = " Installed";
        } else {
            symbol.className = "fa fa-fw fa-download";
            text.innerHTML = " Download";
            status.className = "button";
            status.addEventListener("click", function (event) {
                self.install(data.url);
            }, false);
        }
        status.appendChild(symbol);
        status.appendChild(text);
        wrapper.appendChild(status);

        var githubElement = document.createElement("div");
        githubElement.className = "button";
        var ghSymbol = document.createElement("span");
        ghSymbol.className = "fa fa-fw fa-github";
        githubElement.appendChild(ghSymbol);
        var ghText = document.createElement("span");
        ghText.innerHTML = " View Code";
        githubElement.appendChild(ghText);
        wrapper.appendChild(githubElement);
        githubElement.addEventListener("click", function (event) {
            window.open(data.url, "_blank");
        }, false);

        this.showPopup();
    },

    loadModulesToAdd: function() {
        var self = this;

        this.loadList("add-module", "modulesAvailable", function (parent, modules) {
            for (var i = 0; i < modules.length; i++) {
                var moduleBox = document.createElement("div");
                moduleBox.className = "button module-line";
                moduleBox.id = "install-module-" + i;

                var symbol = document.createElement("span");
                if (modules[i].installed) {
                    symbol.className = "fa fa-fw fa-check-circle";
                } else {
                    symbol.className = "fa fa-fw fa-cloud";
                }
                moduleBox.appendChild(symbol);

                var name = document.createElement("span");
                name.innerHTML = " " + modules[i].name;
                moduleBox.appendChild(name);

                parent.appendChild(moduleBox);

                moduleBox.addEventListener("click", function (event) {
                    var index = event.currentTarget.id.replace("install-module-", "");
                    self.createAddingPopup(index);
                }, false);
            }
        });
    }
};

var buttons = {
    // navigation buttons
    "power-button": function () {
        window.location.hash = "power-menu";
    },
    "edit-button": function () {
        window.location.hash = "edit-menu";
    },
    "settings-button": function () {
        window.location.hash = "settings-menu";
    },
    "mirror-link-button": function () {
        window.open("/", "_blank");
    },
    "back-button": function () {
        if (window.location.hash === "#add-module-menu") {
            window.location.hash = "settings-menu";
            return;
        }

        window.location.hash = "main-menu";
    },

    // settings menu buttons
    "brightness-reset": function () {
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
    "shut-down-button": function () {
        Remote.getWithStatus("action=SHUTDOWN");
    },
    "restart-button": function () {
        Remote.getWithStatus("action=REBOOT");
    },
    "restart-mm-button": function () {
        Remote.getWithStatus("action=RESTART");
    },
    "monitor-on-button": function () {
        Remote.getWithStatus("action=MONITORON");
    },
    "monitor-off-button": function () {
        Remote.getWithStatus("action=MONITOROFF");
    },

    // config menu buttons
    "add-module": function () {
        window.location.hash = "add-module-menu";
    },

    // main menu
    "save-button": function () {
        Remote.getWithStatus("action=SAVE");
    },

    "close-popup": function () {
        Remote.closePopup();
    }
}

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
