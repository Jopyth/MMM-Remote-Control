# MMM Remote Control Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

## [2.0.0] - 2019-02-21

Huge shoutout to [shbatm](https://github.com/shbatm) for his work on this new major version, which brings a new API, custom menus and commands and lots of other stuff:

### Added

- REST API interface for controlling all aspects of the MagicMirror from HTTP RESTful-style GET and POST calls, based on principles from [MMM-Api](https://github.com/juzim/MMM-Api)
    + Full API Documentation at [API/README.md](API/README.md)
- Live daily updates of `modules.json` from the MagicMirror wiki, based on principles from [MMM-Remote-Control-Repository](https://github.com/eouia/MMM-Remote-Control-Repository).  
- Incorporated some features found in [MMM-OnScreenMenu](https://github.com/shbatm/MMM-OnScreenMenu) that were not originally in this module.
    + Monitor (Connected Screen) On-Off Status and Toggle
    + Delayed calls ("DELAYED" Query option and `.../delay` API paths)
    + If using Electron: Open Dev Tools, Minimize, Toggle Fullscreen
- Configuration Option to send custom shell commands to use. Currently, only custom monitor on/off/status commands are supported.
- Module Control menu - Automatically generated from the API to control the different modules you have installed, based on their `notificationReceived` function.
- Custom menu items. See [Custom Menu Items in README](README.md#custom-menu-items)
- Norsk bokmål translation

### Changed

- Updates to `remote.html` and the `node_helper.js` to use direct SocketIO communication back and forth instead of separate HTTP calls.
    + Future framework for following PM2 logs and more live update options.
- General clean-up and standardization of status reporting for GET and POST calls, to original URLs and to new API URLs.
- Updated to ES2015 (ES Version 6) function calls in most locations.
- Added USER_PRESENCE controls from [AgP42](https://github.com/AgP42)
- Added/updated french translations from [BKeyport](https://github.com/Bkeyport) and [Mysh3ll](https://github.com/Mysh3ll)
- Added SHOW/HIDE/TOGGLE ALL modules option per request from [Rene1709](https://github.com/Rene1709)

### Upcoming Changes

- Add additional MMM-OnScreenMenu features:
    + Moving modules' positions
- PM2 Log Follower / Terminal Window
- Added Notification Echo option to config to echo all Module Notifications to the remote's DevTools console for debugging.
- Allow for text input in the Module Controls menu to be able to provide a notification payload.

## [1.1.5] - 2018-05-14

### Added
- French translation

### Fixed
- Updated documentation to new MagicMirror version
- Fix error on updating MagicMirror

## [1.1.4] - 2017-09-17

### Added
- Dutch translation
- Updating a module tries to install dependencies with `npm install`
- Module identifier is shown if a module is locked with lock strings
- Confirmation dialog before restart and shutdown

### Fixed
- Internal save file format and mistakenly hiding modules which were hidden by other modules
- Restart should work for new installations

### Changed
- German translation for power menu changed from "Ausschalten" to "Energieoptionen"

## [1.1.3] - 2017-04-23

### Added
- Portuguese translation
- Indonesian translation
- Support for iOS Icon and Webapp

### Changed
- Installation no longer needs a temporary file

### Fixed
- Icon paths adapted to changes in [Magic Mirror²](https://github.com/MichMich/MagicMirror) 2.1.0

## [1.1.2] - 2017-02-01

**Note:** Since version 1.1.0 this module uses (new) dependencies, check the [Updating section in the README.md](README.md#update).

### Added
- Swedish translation

### Changed
- Installation process updated in [README.md](README.md#Installation)
- Automatic installer/updater includes hint to restart [Magic Mirror²](https://github.com/MichMich/MagicMirror)

### Fixed
- Issues with not applying shown and hidden status correctly to modules
- Issues where lockstrings were missing
- Modules sometimes did not show correctly in the UI as hidden or shown:
    - This is due to a bug in [Magic Mirror²](https://github.com/MichMich/MagicMirror)
    - PR [#659](https://github.com/MichMich/MagicMirror/pull/659) to fix this was made in the project, will be released in the next version

## [1.1.1] - 2017-01-26
### Changed
- Updated internal list of available modules

## [1.1.0] - 2017-01-26
### Added
- First version of installer script
- Menu to send Alerts and/or Notifications to your mirror
- Menu to update your MagicMirror installation and your modules (through `git pull`)
- Menu to change the `config.js`
    - Modules can be installed, added, removed, configured
    - There will be backups of the five last versions of the `config.js` in the `config` folder
    - Some of these parts are hidden behind an "exprimental" warning, do **not** ignore that warning
- NOTIFICATION action, see [README.md](README.md#notification-request) for details

### Changed
- Menu structure
    - Old "Edit" and "Settings" are now under "Edit view"
- Smaller font sizes in lists

### Fixed
- Issues coming from disabled modules since MM version 2.1.0

## [1.0.0] - 2016-10-24
### Added
- Changelog
- New buttons in user interface
    - Hide/show all modules
    - Link to MagicMirror² homepage
    - Option to adapt brightness (making the mirror brighter than 100% can be limited to certain modules)
- Contributing hints
- Internal versioning of saved config (current version: 1)
- Added action `MODULE_DATA` to return module data in JSON format

### Changed
- Internal timeout for commands increased from 5 to 8 seconds
- Symbols for display on and off
- Internal changes in preparation for Magic Mirror version `2.1.0`

## [0.1.0] - 2016-09-30
### Initial release of the Remote Control module.
