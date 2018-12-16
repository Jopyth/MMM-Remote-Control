## MagicMirror Remote Control API

## Description

The MMM-Remote-Control Module for MagicMirror² implements a RESTful(-ish) API to control the Magic Mirror using the existing functionality built-in to MMM-Remote-Control, as well as the notifications commands built into most modules.  In addition, the API creates a basic framework which allows for each module to expand or customize their own API by a simple notificiation.

This expansion was developed by [shbatm](https://github.com/shbatm) using [juzim's MMM-Api](https://github.com/juzim/MMM-Api) and of-course, [jopyth's MMM-Remote-Control](https://github.com/jopyth/MMM-Remote-Control).

## Basics

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

It can also be passed as an Authentication Header:
```bash
$ curl -X POST http://magicmirrorip:8080/api/module/alert/showalert \
  -H 'content-type: application/json' \
  -H 'Authentication: apiKey bc2e979db92f4741afad01d5d18eb8e2' \
  -d '{ 
    "title": "Hello World!", 
    "message": "Alert Successfully Shown!", 
    "timer": 2000
    }'
```

***For convenience, the remainder of the examples omit the API Key***

## Methods

There are three general categories of API commands:

**1. MMM-Remote-Control Internal Commands** -- these are used to call the existing commands that MMM-Remote-Control already exposes.  For example, to turn off the monitor ("MONITOROFF"):
            ```bash
            $ curl -X GET http://magicmirrorip:8080/api/monitor/off
            ```

**2. External APIs (Guessed)** -- when this module first loads, it parses all of the installed modules source code and checks for any custom notifications that are used.  From this basic search, it tries to "guess" notification actions that may be valid, without them being explicitly defined anywhere else.  For example, the "alert" command examples above are not defined within this module, the 'alert' module just looks for a notification, "SHOW_ALERT"--this is exposed as a `/module/alert/showalert` action in the External API processor.  Full credit to this idea goes to `juzim` from the MMM-Api module.

**3. External APIs (Explicit)** -- these commands are developed when a module loads and sends a "REGISTER_API" notification with command details to this module. These commands will overwrite any "guessed" commands and can provide a way for a module to define its own API, but still use the same routes already in place.

### 1. MMM-Remote-Control Internal Commands



### 2. External APIs (Guessed)

As discussed above, these methods are guessed based on your currently installed modules. To see what actions are available on your particular installation:

| Method | URL | Description |
| ------ | --- | ------- |
| GET | /api/module | Return a list of all external API actions registered.
| GET | /api/module/:moduleName | Returns registered API actions for a given module<br>`:moduleName`: Name or Identifier for an installed & activated module.

- *NOTE:* Just because an action appears in this list, does not necessarily mean it is valid and the related module will do what you want.  For the most part it works pretty well; however, at the moment, this also includes socket notifications (module internal notifications) as well, which won't do anything when called from the API.

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
| -- | -- |
| `"success"` | Result of the GET call
| `"module"` | Module name
| `"path"` | API path to use.  All lower case, with "MMM-" and "-"s removed (e.g. MMM-Remote-Control's path if it had one would be `/api/module/remotecontrol/`). Can be customized for explicit External APIs.
| `"actions"` | The list of actions registered, along with the respective notifications that they will call.<br>For example, `GET /api/module/newsfeed/articlenext` will send a `"ARTICLE_NEXT"` notification to the `newsfeed` module
| `"guessed"` | Whether or not the API actions were guessed (not all are reliable) or if they were explicitly provided by the module.

### 3. External APIs (Explicit) - Extending Another Module with this API

