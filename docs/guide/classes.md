# Classes

Group modules together to show, hide, or toggle them with a single action.

## Configuration

```js
config: {
    classes: {
        "Day Mode": {
            show: ["clock", "weather", "calendar"],
            hide: ["screensaver"],
        },
        "Night Mode": {
            show: ["clock"],
            hide: ["weather", "calendar", "newsfeed"],
        },
        "Toggle News": {
            toggle: ["newsfeed"],
        },
    },
},
```

## Properties

| Property | Description                                |
| -------- | ------------------------------------------ |
| `show`   | Array of module names to show              |
| `hide`   | Array of module names to hide              |
| `toggle` | Array of module names to toggle visibility |

## Usage

### Via Web Interface

Classes appear as buttons in the Remote Control web interface.

### Via API

```bash
curl http://your-mirror:8080/api/classes/Day%20Mode
```

### Via Notification

```js
this.sendNotification("REMOTE_ACTION", {
  action: "CLASS",
  className: "Day Mode"
});
```

## Examples

### Presentation Mode

Hide everything except a specific module:

```js
classes: {
    "Presentation": {
        hide: ["clock", "weather", "calendar", "newsfeed"],
        show: ["MMM-Slides"],
    },
    "Normal": {
        show: ["clock", "weather", "calendar", "newsfeed"],
        hide: ["MMM-Slides"],
    },
}
```

### Privacy Mode

Quick toggle for sensitive information:

```js
classes: {
    "Privacy": {
        hide: ["calendar", "email", "MMM-Todoist"],
    },
    "Show All": {
        show: ["calendar", "email", "MMM-Todoist"],
    },
}
```

## Module Names

Use the module name as defined in your `config.js`. For default modules, this is typically lowercase (e.g., `clock`, `weather`, `calendar`). For third-party modules, use the full name (e.g., `MMM-Todoist`).

You can also use the module identifier (e.g., `module_2_calendar`) for more precise control when you have multiple instances of the same module.
