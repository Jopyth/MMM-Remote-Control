// main javascript file for the remote control page

var Remote = {
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

    loadModuleButtons: function() {
        var self = this;

        var buttons = document.getElementsByClassName("edit-button");
        for (var i = 0; i < buttons.length; i++) {
            self.loadToggleButton(buttons[i], function (toggledOn, event) {
                if (toggledOn) {
                    self.showModule(event.currentTarget.id);
                } else {
                    self.hideModule(event.currentTarget.id);
                }
            });
        }
    },

    loadBrightnessSlider: function() {
        var self = this;

        var element = document.getElementById("brightness-slider");

        element.addEventListener("change", function(event) {
            self.getWithStatus("action=BRIGHTNESS&value=" + element.value);
        }, false);
    },

    showMenu: function(newMenu) {
        var allMenus = document.getElementsByClassName("menu-element");

        for (var i = 0; i < allMenus.length; i++) {
            var button = allMenus[i];

            button.style.display = 'none';
        }

        var currentMenu = document.getElementsByClassName(newMenu);

        for (var i = 0; i < currentMenu.length; i++) {
            var button = currentMenu[i];

            button.style.display = 'block';
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

        self.setStatus('loading');
        self.get(params, function (response) {
            if (callback) {
                callback(response);
            } else {
                var result = JSON.parse(response);
                if (result.status === "success") {
                    self.setStatus('success');
                } else {
                    self.setStatus('error');
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

    get: function(params, callback) {
        var http = new XMLHttpRequest();
        var url = "remote?" + params;
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
    }
};

var buttons = {
    // navigation buttons
    'power-button': function () {
        window.location.hash = 'power-menu';
    },
    'edit-button': function () {
        window.location.hash = 'edit-menu';
    },
    'settings-button': function () {
        window.location.hash = 'settings-menu';
    },
    'mirror-link-button': function () {
        window.open("/", "_blank");
    },
    'back-button': function () {
        window.location.hash = 'main-menu';
    },

    // settings menu buttons
    'brightness-reset': function () {
        var element = document.getElementById("brightness-slider");
        element.value = 100;
        Remote.getWithStatus("action=BRIGHTNESS&value=100");
    },

    // edit menu buttons
    'show-all-button': function() {
        var buttons = document.getElementsByClassName("edit-button");
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].className = buttons[i].className.replace("toggled-off", "toggled-on");
            Remote.showModule(buttons[i].id);
        }
    },
    'hide-all-button': function() {
        var buttons = document.getElementsByClassName("edit-button");
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].className = buttons[i].className.replace("toggled-on", "toggled-off");
            Remote.hideModule(buttons[i].id);
        }
    },

    // power menu buttons
    'shut-down-button': function () {
        Remote.getWithStatus("action=SHUTDOWN");
    },
    'restart-button': function () {
        Remote.getWithStatus("action=REBOOT");
    },
    'restart-mm-button': function () {
        Remote.getWithStatus("action=RESTART");
    },
    'monitor-on-button': function () {
        Remote.getWithStatus("action=MONITORON");
    },
    'monitor-off-button': function () {
        Remote.getWithStatus("action=MONITOROFF");
    },

    // main menu
    'save-button': function () {
        Remote.getWithStatus("action=SAVE");
    }
}

Remote.loadButtons(buttons);
Remote.loadModuleButtons();
Remote.loadBrightnessSlider();

Remote.setStatus('none');

if (window.location.hash) {
    Remote.showMenu(window.location.hash.substring(1));
} else {
    Remote.showMenu('main-menu');
}

window.onhashchange = function() {
    if (window.location.hash) {
        Remote.showMenu(window.location.hash.substring(1));
    } else {
        Remote.showMenu('main-menu');
    }
}
