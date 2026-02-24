# Configuration

All configuration options for MMM-Remote-Control.

## Basic Setup

```js
{
    module: 'MMM-Remote-Control',
    position: 'bottom_left',  // Optional: shows IP address on mirror
    config: {
        customCommand: {},      // See Custom Commands
        showModuleApiMenu: true,
        secureEndpoints: true,
        // customMenu: "custom_menu.json",
        // apiKey: "",
        // classes: {}
    }
},
```

## Config Options

### showModuleApiMenu

Show the module control menu in the web interface.

```js
config: {
    showModuleApiMenu: true,  // Default: true
},
```

### apiKey

Protect your API with an authentication key. See [API Documentation](../../API/README.md) for details.

```js
config: {
    apiKey: 'your-secret-api-key',
},
```

### secureEndpoints

When no `apiKey` is set, some dangerous endpoints (shutdown, install modules) are blocked by default. Set to `false` to allow all endpoints without authentication.

```js
config: {
    secureEndpoints: true,  // Default: true
},
```

### customCommand

Override default shell commands. See [Custom Commands](custom-commands.md) and [Monitor Control](monitor-control.md).

```js
config: {
    customCommand: {
        shutdownCommand: 'sudo shutdown -h now',
        rebootCommand: 'sudo reboot',
        monitorOnCommand: 'vcgencmd display_power 1',
        monitorOffCommand: 'vcgencmd display_power 0',
        monitorStatusCommand: 'vcgencmd display_power -1',
    },
},
```

### customMenu

Load a custom menu from a JSON file. See [Custom Menus](custom-menus.md).

```js
config: {
    customMenu: "custom_menu.json",
},
```

### classes

Group modules to show/hide together. See [Classes](classes.md).

```js
config: {
    classes: {
        "Day Mode": {
            show: ["clock", "weather"],
            hide: ["screensaver"],
        },
    },
},
```

## Position

Setting a `position` displays the mirror's IP address on screen. You can hide it later from the module menu.

```js
{
    module: 'MMM-Remote-Control',
    position: 'bottom_left',  // or comment out to hide
    config: {}
},
```
