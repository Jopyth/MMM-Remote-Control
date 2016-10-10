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

    loadEditButtons: function() {
        var self = this;

        var buttons = document.getElementsByClassName("edit-button");
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener("click", function (event) {
                if (self.hasClass(event.currentTarget, 'hidden-on-mirror'))
                {
                    self.getWithStatus("action=SHOW&module=" + event.currentTarget.id);
                    event.currentTarget.className = event.currentTarget.className.replace("hidden-on-mirror", 'shown-on-mirror');
                } else {
                    self.getWithStatus("action=HIDE&module=" + event.currentTarget.id);
                    event.currentTarget.className = event.currentTarget.className.replace("shown-on-mirror", 'hidden-on-mirror');
                }
            }, false);
        }
    },

    showMenu: function(newMenu) {
        var allMenus = document.getElementsByClassName("menu-button");

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
    'back-button': function () {
        window.location.hash = 'main-menu';
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
    'save-button': function () {
        Remote.getWithStatus("action=SAVE");
    }
}

Remote.loadButtons(buttons);
Remote.loadEditButtons();

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
