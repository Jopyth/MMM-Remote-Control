## MagicMirror Remote Control API

## Introduction

The MMM-Remote-Control Module for MagicMirror² implements a RESTful(-ish) API to control the Magic Mirror using the existing functionality built-in to MMM-Remote-Control, as well as the notifications commands built into most modules.  In addition, the API creates a basic framework which allows for each module to expand or customize their own API by a simple notificiation.

This expansion was developed by [shbatm](https://github.com/shbatm) using [juzim's MMM-Api](https://github.com/juzim/MMM-Api) and of-course, [jopyth's MMM-Remote-Control](https://github.com/jopyth/MMM-Remote-Control).

Modified by [ezeholz](https://github.com/ezeholz) in the 2.2.0+, in the efford of making a more simplified version for everyone to use it.

## Overview

This extension exposes the `/api` URL from your MagicMirror² installation. Just like using the regular MMM-Remote-Control module, make sure your configuration listens on more than just `localhost`.

All URLs will be of the form: `http://magicmirrorip:8080/api/{your command}` and depending on the command, either `GET` or `POST` methods are accepted.

### Basic examples for showing an Alert on the screen

```bash
$ curl -X GET http://magicmirrorip:8080/api/module/alert/showalert?message=Hello&timer=2000
```

```bash
$ curl -X POST http://magicmirrorip:8080/api/module/alert/showalert \
  -H 'content-type: application/json' \
  -d '{ 
    "title": "Hello World!", 
    "message": "Alert Successfully Shown!", 
    "timer": 2000
    }'
```

### Basic examples of sending a Module Notification

```bash
$ curl -X GET http://magicmirrorip:8080/api/notification/HELLO_WORLD
```

```bash
$ curl -X POST http://magicmirrorip:8080/api/notification/HELLO_WORLD \
  -H 'content-type: application/json' \
  -d '{ 
    "mypayload": "Hello World!", 
    "somthingelse": "Wooo!"
    }'
```

## Authentication

Providing an API key is recommended; however, remains optional. If you wish to use an API key to authenticate, add an `apiKey:` option to the config section for this module.

If you ran the `installer.sh` script when you installed the module, a non-canoical UUID is generated for you to use; you can use this unique code, or use any string you wish.

### Example Config Section
```js
{
    module: 'MMM-Remote-Control'
    config: {
        apiKey: 'bc2e979db92f4741afad01d5d18eb8e2'
    }
},
```

### Passing your API key

The API Key can be passed in one of two ways, either as part of the query string at the end of the URL:
```bash
$ curl -X GET http://magicmirrorip:8080/api/module/alert/showalert?message=Hello&timer=2000&apiKey=bc2e979db92f4741afad01d5d18eb8e2
```

It can also be passed as an Authorization Header:
```bash
$ curl -X POST http://magicmirrorip:8080/api/module/alert/showalert \
  -H 'content-type: application/json' \
  -H 'Authorization: apiKey bc2e979db92f4741afad01d5d18eb8e2' \
  -d '{ 
    "title": "Hello World!", 
    "message": "Alert Successfully Shown!", 
    "timer": 2000
    }'
```

***For convenience, the remainder of the examples omit the API Key***

## Secure Endpoints
Since 2.2.0, and in a way to prevent malicious actions on your mirror, a new config was added. This config allow you to, in case you don't use an apikey or never use the API at all, prevent some endpoints to work without an apikey.
As usual, this option can be disabled, but this will expose your Mirror to potentials hackers, so it's up to you to turn it off.

```js
{
    module: 'MMM-Remote-Control'
    config: {
        secureEndpoints: true
    }
},
```

By default, secureEndpoints it's true, defending commands like shutdown or install modules when no apikey it's present.
Setting secureEndpoints to false allow every endpoint to be reachable externally, even without an apikey. (Just like the old times)

## Methods

There are three general categories of API commands:

**1. MMM-Remote-Control Internal Commands** -- these are used to call the existing commands that MMM-Remote-Control already exposes.  For example, to turn off the monitor ("MONITOROFF"):

```bash
            $ curl -X GET http://magicmirrorip:8080/api/monitor/off
```

**2. External APIs (Guessed)** -- when this module first loads, it parses all of the installed modules' source code and checks for any custom notifications that are used.  From this basic search, it tries to "guess" notification actions that may be valid, without them being explicitly defined anywhere else.  For example, the "alert" command examples above are not defined within this module, the 'alert' module just looks for a notification, "SHOW_ALERT"--this is exposed as a `/module/alert/showalert` action in the External API processor.  Full credit to this idea goes to `juzim` from the MMM-Api module.

**3. External APIs (Explicit)** -- these commands are developed when a module loads and sends a "REGISTER_API" notification with command details to this module. These commands will overwrite any "guessed" commands and can provide a way for a module to define its own API, but still use the same routes already in place.

### 1. MMM-Remote-Control Internal Commands

The majority of MMM-Remote-Control's abilities are extended to the API (this is a fundamental reason for "extending" this module instead of creating a new one for the API).

Review the API documentation online [here](https://ezeholz.github.io/MMM-Remote-Control/)

Or check it in your own installation using http://ip-of-your-mirror:8080/api/docs

### 2. External APIs (Guessed)

As discussed above, these methods are guessed based on your currently installed modules. To see what actions are available on your particular installation:

| Method | URL | Description |
| ------ | --- | ------- |
| GET | /api/module | Return a list of all external API actions registered.
| GET | /api/module/:moduleName | Returns registered API actions for a given module<br>`:moduleName`: Name or Identifier for an installed & activated module.

- *NOTE:* Just because an action appears in this list, does not necessarily mean it is valid and the related module will do what you want. Consult each modules' README for details on what notifications can be used and how.

#### Example:

```bash
$ curl -X GET http://magicmirrorip:8080/api/module/newsfeed
```

#### Returns:

```json
{
    "success": true,
    "module": "newsfeed",
    "path": "newsfeed",
    "actions": {
        "newsitems": {
            "notification": "NEWS_ITEMS"
        },
        "articlenext": {
            "notification": "ARTICLE_NEXT"
        },
        "articleprevious": {
            "notification": "ARTICLE_PREVIOUS"
        },
        "articlemoredetails": {
            "notification": "ARTICLE_MORE_DETAILS"
        },
        "articlescrollup": {
            "notification": "ARTICLE_SCROLL_UP"
        },
        "articlelessdetails": {
            "notification": "ARTICLE_LESS_DETAILS"
        },
        "articletogglefull": {
            "notification": "ARTICLE_TOGGLE_FULL"
        }
    },
    "guessed": true
}
```

| Parameter | Description |
| :-: | -- |
| `"success"` | Result of the GET call
| `"module"` | Module name
| `"path"` | API path to use.  All lower case, with "MMM-" and "-"s removed (e.g. MMM-Remote-Control's path if it had one would be `/api/module/remotecontrol/`). Can be customized for explicit External APIs.
| `"actions"` | The list of actions registered, along with the respective notifications that they will call.<br>For example, `GET /api/module/newsfeed/articlenext` will send a `"ARTICLE_NEXT"` notification to the `newsfeed` module
| `"guessed"` | Whether or not the API actions were guessed (not all are reliable) or if they were explicitly provided by the module.

### 3. External APIs (Explicit) - Extending Another Module with this API

For module developers, you can extend the API to accomodate your needs by sending a "REGISTER_API" module notification. Below is an example and details.

If correctly formated, any details sent here will override the "guessed" action by #2 above.

```js
let payload = {
  module: this.name, 
  path: "modulename", 
  actions: {   
    actionName: { 
        method: "GET", 
        notification: "NOTIFICATION_TO_SEND", 
        payload: ObjectToSend, 
        prettyName: "Action Name"
    },
    anotherActionName: { 
        method: "POST", 
        notification: "NOTIFICATION_TO_SEND"
    }
  }
};
this.sendNotification("REGISTER_API", payload);
```

| Parameter | Description |
| :-: | - |
| `module` | Actual Name of your Module (e.g. "MMM-Your-Module-Name, or just use `this.name`)
| `path` | Path to use in the API (e.g. `path: "mymodulename"`) translates to `/api/module/mymodulename`
| `actions` | An `Object` defining the actions you want to expose. See below for details.
| `actionName` | The name for your action (e.g. called from `/api/module/mymodulename/actionName`).
| `method` | *Optional:* The HTTP Method to use.<br>Valid options are: `"GET"` or `"POST"`. If `method` is not provided in an action, then both `"GET"` or `"POST"` methods will be treated as valid.
| `notification` | The notification to send to your module. When the API receives a valid action, it passes a Module Notification to your module. It is your responsibility to do something with that notification to make the action work.
| `prettyName` | *Optional:* You can specify a Formatted Name to use in dynamic menus, like the MMM-Remote-Control Module Control menu, otherwise one will be guessed based on the Notification text.
| `payload` | *Optional:* If you always want the module to send the same `payload`, you can provide an `Object` here. It will be merged into the `payload` sent with the notification, which will also include:<br>1. URL Parameter, if used. See notes on `payload` Object below.<br>2. Query String, if used. API key will be removed.<br>3. Request body, if `POST` method is used and a body sent.<br>4. Finally, this parameter.

#### About the `payload` Object 

Your module will be sent a `payload` with the notification, depending on the request details, and if you provided a `payload` Object to send. It is a merged object, containing one or more of the following inputs.

1. URL Parameter. (e.g. `/api/module/mymodulename/action/:p`, where `:p` is the parameter). If nothing else below is passed or provided, this will be returned as a string. If anything else below is sent, this will be provided at `payload.param` in the notification's `payload` Object.
2. Query String. Anything passed to the query string, except the API Key (if used) will be passed through `payload`. For example, `/api/module/mymodulename/action?param1=Something&param2=Else` will be passed in `payload` as `{ param1: "Something", param2: "Else" }`
3. `POST` Body. Same as query string above.
4. Custom Payload. Any `Object` provided with the `payload:` key when you send the initial "REGISTER_API" notification.

The response sent by the API will include the `payload` Object it sent to your module in the response body for debugging purposes.
