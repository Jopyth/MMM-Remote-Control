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

    showMenu: function(newMenu) {
        var allMenus = document.getElementsByClassName("menu-button");

        for (var i = 0; i < allMenus.length; i++) {
            var button = allMenus[i];

            button.style.display = 'none';
        }

        var currentMenu = document.getElementsByClassName(newMenu);

        for (var i = 0; i < currentMenu.length; i++) {
            var button = currentMenu[i];

            button.style.display = '';
        }
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
            currentInfo.style.display = '';
        }
    },

    get: function(params, callback) {
        var http = new XMLHttpRequest();
        var url = "remote?" + params;
        http.open("GET", url, true);

        //Send the proper header information along with the request
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

        http.onreadystatechange = function() {//Call a function when the state changes.
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
        window.location.hash = 'module-menu';
    },
    'back-button': function () {
        window.location.hash = 'main-menu';
    },
    
    // power menu buttons
    'shut-down-button': function () {
        Remote.setStatus('loading');
        Remote.get("action=SHUTDOWN", function (){
            Remote.setStatus('success');
        });
    },
    'restart-button': function () {
        Remote.setStatus('loading');
        Remote.get("action=REBOOT", function (){
            Remote.setStatus('success');
        });
    }
}

Remote.loadButtons(buttons);

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
