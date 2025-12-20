# Custom Menus

Create custom menu buttons for the Remote Control web interface.

## Setup

1. Copy `custom_menu.example.json` from the module directory to your MagicMirror `config/` directory
2. Rename it (e.g., `custom_menu.json`)
3. Add the filename to your config:

```js
config: {
    customMenu: "custom_menu.json",
},
```

## Menu Structure

```json
{
  "id": "custom",
  "type": "menu",
  "icon": "id-card-o",
  "text": "%%TRANSLATE:CUSTOM_MENU%%",
  "items": [
    {
      "id": "custom-item-1",
      "type": "item",
      "icon": "dot-circle-o",
      "text": "Menu Item 1",
      "action": "NOTIFICATION",
      "content": {
        "notification": "NOTIFICATION_TEXT_1",
        "payload": "This notification requires a string payload"
      }
    }
  ]
}
```

## Properties

| Property  | Description                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| `id`      | Unique identifier. For `type: "menu"`, determines the submenu container.          |
| `type`    | `"menu"`, `"item"`, `"button"`, `"slider"`, or `"input"`                          |
| `icon`    | [FontAwesome](https://fontawesome.com/v4/icons/) icon name (without `fa-` prefix) |
| `text`    | Display text. Use `%%TRANSLATE:KEY%%` for translations.                           |
| `items`   | Array of child items (for `type: "menu"`)                                         |
| `action`  | Action to execute (see below)                                                     |
| `content` | Action parameters                                                                 |

## Types

### menu

A submenu containing other items:

```json
{
   "id": "my-menu",
   "type": "menu",
   "icon": "cog",
   "text": "Settings",
   "items": [...]
}
```

### item / button

A clickable button that triggers an action:

```json
{
  "id": "refresh-btn",
  "type": "item",
  "icon": "refresh",
  "text": "Refresh Mirror",
  "action": "REFRESH"
}
```

### slider

A slider input (since v2.3.0):

```json
{
  "id": "brightness-slider",
  "type": "slider",
  "icon": "sun-o",
  "text": "Brightness",
  "action": "BRIGHTNESS",
  "content": {
    "min": 10,
    "max": 200,
    "step": 10
  }
}
```

### input

A text input field (since v2.3.0):

```json
{
  "id": "alert-input",
  "type": "input",
  "icon": "comment",
  "text": "Enter message...",
  "action": "NOTIFICATION",
  "content": {
    "notification": "SHOW_ALERT"
  }
}
```

## Actions

### Built-in Actions

Use Remote Control actions directly:

```json
{
  "action": "MONITOROFF"
}
```

```json
{
  "action": "BRIGHTNESS",
  "content": { "value": 50 }
}
```

### Send Notifications

Send notifications to any module:

```json
{
  "action": "NOTIFICATION",
  "content": {
    "notification": "SHOW_ALERT",
    "payload": {
      "message": "Hello World!",
      "timer": 3000
    }
  }
}
```

## Translations

Use `%%TRANSLATE:KEY%%` in your text and add the translation to the files in the `translations/` directory:

```json
{
  "text": "%%TRANSLATE:MY_BUTTON%%"
}
```

In `translations/en.json`:

```json
{
  "MY_BUTTON": "My Button"
}
```

## Example: Complete Custom Menu

```json
[
  {
    "id": "scenes",
    "type": "menu",
    "icon": "image",
    "text": "Scenes",
    "items": [
      {
        "id": "scene-day",
        "type": "item",
        "icon": "sun-o",
        "text": "Day Mode",
        "action": "NOTIFICATION",
        "content": {
          "notification": "REMOTE_ACTION",
          "payload": { "action": "BRIGHTNESS", "value": 100 }
        }
      },
      {
        "id": "scene-night",
        "type": "item",
        "icon": "moon-o",
        "text": "Night Mode",
        "action": "NOTIFICATION",
        "content": {
          "notification": "REMOTE_ACTION",
          "payload": { "action": "BRIGHTNESS", "value": 30 }
        }
      }
    ]
  }
]
```
