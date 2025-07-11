# MMM-Remote-Control Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [3.2.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.0...v3.2.1) - 2025-07-11

### Changed

- chore: update dependencies

## [3.2.0](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.13...v3.2.0) - 2025-05-30

## Added

- style: add transition effect for brightness and temperature change

## Changed

- chore: add missing "type" field in `package.json`
- chore: update dependencies
- refactor: replace `git checkout` with `git switch` for branch/tag navigation
- style: simplify range input CSS

## Fixed

- fix: add onerror handling for CSS file loading due to path changes in MagicMirror 2.32.0

## [3.1.13](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.12...v3.1.13) - 2025-05-24

## Changed

- chore: switch stale workflow schedule to twice a week
- chore: update dependencies
- refactor: use `fs.constants.F_OK` for file access checks

## [3.1.12](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.11...v3.1.12) - 2025-05-20

### Fixed

- docs: correct config file path
- fix: ignore `settings.json` to prevent merge conflicts. This was accidentally removed in commit 6d7c85b12c8dce2ec772f9a9b1892b098576872f.
- fix: set `brightness` and `temp` for saving into `settings.json` and offering in API

### Changed

- refactor: centralize config path retrieval in `combineConfig` and `answerPost`

## [3.1.11](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.10...v3.1.11) - 2025-05-18

### Fixed

- fix: support Express v4 and v5 - to fix issue #340
  - The issue was introduced in 3.1.9, when the module was updated to be compatible with Express v5.
  - Since the new route definitions are not compatible with Express v4, the module will now check the version of Express and use the appropriate route definitions.

## [3.1.10](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.9...v3.1.10) - 2025-05-18

### Changed

- chore: re-add Prettier config (was removed in 3.1.9, but caused issues in GitHub actions)
- chore: update devDependencies
- docs: move images to own directory
- docs: update screenshots and add screenshot heading to README

## [3.1.9](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.8...v3.1.9) - 2025-05-17

### Changed

- chore: review linter setup
- chore: update devDependencies
- chore: update log messages for module default retrieval outputs
- docs: update URL to own wiki
- refactor: replace `body-parser` with express's built-in body parsing
- refactor: update route definitions and improve response handling to be compatible with express v5 (without this MMM-Remote-Control would not work with the next release of MagicMirror²)
- refactor: update scripts to use `node --run`

### Fixed

- fix: replace not working discussions URL with forum URL

## [3.1.8](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.7...v3.1.8) - 2025-04-27

### Changed

- refactor: choose installation command depending on the existence of `package-lock.json` and `package.json` This also fixes a problem that occurred with modules with `package.json` but without `package-lock.json` during installation with `npm ci`.
- refactor: don't save `header` to config file if not set
- refactor: get module defaults also from browser to handle bundled modules better (this will fix [#331](https://github.com/Jopyth/MMM-Remote-Control/issues/331))
- chore: update devDependencies

### Fixed

- fix: get default config while adding a module
- fix: don't save module position if not set. Since MM meanwhile checks the position values, an error message appears without this fix.

## [3.1.7](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.6...v3.1.7) - 2025-04-27

### Changed

- refactor: replace jQuery with vanilla JavaScript
- refactor: reorder `#alert` styles to remove rule from stylelint config
- chore: replace `npm install` with `npm ci --omit=dev` for less update issues and improved performance
- chore: update devDependencies

## [3.1.6](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.5...v3.1.6) - 2025-04-13

### Changed

- refactor: replace XMLHttpRequest by fetch
- chore: update English and German translations
- chore: more detailed logging
- chore: update dependencies
- chore: update ESLint configuration to use new import plugin structure
- chore: adjust ESLint rules
- docs: rephrase introduction in README

## [3.1.5](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.4...v3.1.5) - 2025-03-26

### Fixed

- fix: Refactor `setBrightness` and `setTemp`. To fix #322.

### Changed

- refactor: var -> let
- chore: Update devDependencies
- chore: Update modules.json.template

## [3.1.4](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.3...v3.1.4) - 2025-03-22

### Fixed

- fix: Prevent merge conflicts with `modules.json` while updating MMM-Remote-Control via `git pull` (#323)

### Changed

- chore: Update devDependencies
- chore: Refactor error logging in node_helper.js to include module context
- chore: Update bug report template to reflect new version placeholders

## [3.1.3](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.2...v3.1.3) - 2025-03-20

### Fixed

- fix: Only remove `classesButton` when it's there. There was a console error when returning to the main menu from a sub page.

### Changed

- chore: Remove unused `background-color` from `MMM-Remote-Control.css`
- chore: Use vw and vh instead of 100% in `MMM-Remote-Control.css`

## [3.1.2](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.1...v3.1.2) - 2025-03-11

### Fixed

- Fix temperature overlay to fit fullscreen

## Changed

- Update dependencies
- Remove old remote-control-overlay definition
- Simplify stylelint-prettier configuration

## [3.1.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.0...v3.1.1) - 2025-03-09

### Changed

- Handle cspell issues
- Refactor setBrightness Use filter instead an overlay
- Optimize slider - Allow 0 for brightness - Set default to center
- Handle linter warnings
- Refactor

## [3.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v3.0.1...v3.1.0) - 2025-03-09

### Added

- Added Color Temperature changing feature (#296) by @Andoramb

## [3.0.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.0.0...v3.0.1) - 2025-03-09

### Fixed

- Solve issue when not using standard config file (#320) by @dangherve

### Changed

- chore: Add @stylistic/eslint-plugin and handle linter issues
- chore: Replace eslint-plugin-import with eslint-plugin-import-x
- chore: Update devDependencies

## [3.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.4...v3.0.0) - 2025-03-04

There shouldn't be any breaking changes in this release. But since there are a some changes, which could lead to unexpected behavior, we decided to bump the major version.

### Fixed

- Fix action endpoint for modules #292

### Changed

- Use npm package for jQuery, showdown and swagger-ui (and switch to current versions)
- Update dependencies
- Handle some linter issues
- Drop Google fonts for API page

### Added

- Add compare links to CHANGELOG
- Add Code of Conduct

## [2.5.4](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.3...v2.5.4) - 2025-03-03

### Added

- Add prettier, markdownlint and stylelint to CI

### Changed

- Update dependencies

### Fixed

- Fix linting and formatter issues

## [2.5.3](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.2...v2.5.3) - 2025-01-20

### Fixed

- Fix `download_modules.js` script to automatically download the modules list from the MagicMirror² wiki. This will fix #301.

### Changed

- Replace `node-fetch` by internal fetch API
- Replace old python 2 script `download_modules.py` by JavaScript script, you can run it with `npm run download_modules` to download the modules list from the MagicMirror² wiki.
- Update `uuid`. This will fix #318.

## [2.5.2](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.1...v2.5.2) - 2025-01-18

### Fixed

- Fixed an issue with bundled modules (reported in #302) - the defaults of some bundled modules could not be read.
- Fixed/Updated some URLs.

### Changed

- Replaced `lodash` with built-in JavaScript functions.
- Format and handle some linting issues in `node_helper.js`.
- Switch LICENSE file to markdown for better readability.
- Update `devDependencies`.

## [2.5.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.0...v2.5.1) - 2024-12-17

### Fixed

- An error in the installation script. (Since MagicMirror² v2.27.0, the string used as TEST_STRING in `installer.sh` has changed and the installer script was not able to detect the MagicMirror² directory.)

## [2.5.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.4.0...v2.5.0) - 2024-11-20

### Added

- Added a spell checker and fixed problems that were found (#308).
- Added JavaScript linting (for the start with soft rules) (#310).
- Added GitHub workflow for linting and spell checking on every push and pull request (#310).
- Added Turkish language (#305)

## [2.4.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.8...v2.4.0) - 2024-10-08

### Fixed

- Module fixing. Thanks @khassel (#307)

## [2.3.8](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.7...v2.3.8) - 2023-10-03

### Added

- `node-fetch` now added to package.json (#293)

### Fixed

- Module name lookup now working as expected (#289)
- QOL Code Cleaning (#287)

## [2.3.7](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.6...v2.3.7) - 2022-10-13

### Added

- Header name to identify instances of modules (#283)

### Fixed

- API now grabs a single module, instead of every instance of the module (#282)

## [2.3.6](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.5...v2.3.6) - 2021-08-01

### Fixed

- API now updates the modules list

## [2.3.5](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.4...v2.3.5) - 2021-07-08

### Added

- Simplified Chinese translation
- 'PM2 not installed' warning

## [2.3.4](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.3...v2.3.4) - 2021-04-21

### Added

- Now you can use MANAGE_CLASSES to use them between modules, instead of just the API

### Fixed

- Classes now detects when you're using identifiers and names in the same action (#259)

## [2.3.3](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.2...v2.3.3) - 2021-04-05

### Changed

- `request` is deprecated inside MM package. Now using `node-fetch` (#257)

## [2.3.2](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.1...v2.3.2) - 2021-02-19

### Fixed

- `value` now travels along with the payload when slide or input it's used on Custom Menus. (#251)

### Changed

- If you use slide or input, and you add a string payload, it'll now be available in the `string` object of the payload.

## [2.3.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.0...v2.3.1) - 2020-12-29

### Fixed

- `Find` it's not defined inside some Electron instances (#242 and #235)
- `undefined` modules generated by the `disabled` tag are now handled. (MagicMirrorOrg/MagicMirror#2382)

## [2.3.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.2.2...v2.3.0) - 2020-12-23

### Added

- Custom Shell Commands for everyone! (#159)
- Custom Menus: User Input Field (#181) and Sliders

### Fixed

- "TV is off" now detected (#234)
- Toggle and Status Monitor working as expected (#234)

### Changed

- Now the system used for turn on and off the screen will be `vcgencmd` (#227 and more)

## [2.2.2](https://github.com/jopyth/MMM-Remote-Control/compare/v2.2.1...v2.2.2) - 2020-11-24

### Fixed

- Module Installation now working
- iframe now working (#161)

## [2.2.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.2.0...v2.2.1) - 2020-11-18

### Fixed

- Module Identifier now working as expected (#229)
- Update Installation seems to work

## [2.2.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.1.0...v2.2.0) - 2020-11-16

### Fixed

- Default values now removed from backup (#12)
- Custom Menus now works as expected
- API working, not well implemented in the past
- API userPresence now working as expected

### Added

- Updates now show if there's an update available every day (#52)
- Templates for issues and PRs, and also stale for auto management of issues.
- Close Dev Tools (#119)
- Undo Config Implementation (Beta)
- Classes to show, hide or toggle multiple modules at once (#34)
- Classes and saves API
- Changelog of every module updated
- [Showdown](https://github.com/showdownjs/showdown) implemented in order to show changelog markdown.
- secureEndpoint config to bypass the non-apikey limitation. This could be dangerous, use it with caution.
- Added POST support for Monitor API (#200)
- Added endpoint to edit config file (#206)
- Endpoint /api/docs now shows you the documentation available for the API. You can test your mirror right there!

### Changed

- **[lodash](https://lodash.com/) required**. Do `npm install` on the Remote Control module.
- Alert button don't show up when Alert module isn't active
- The way monitor turn on and off (#225)
- Now hide, show or toggle modules also accept arrays
- /api/test can be reach without any apiKey
- /api/modules/installed and /available are now /api/module/installed and /available
- ApiKey required in order to change substantial things on the Mirror
- Some Endpoints are gonna be deprecated in the future. You can see those inside /api/docs, in the Legacy menu.

### Removed

- /api/modules it's no longer available, you can use /api/module instead.
- Postman collection deprecated ~ (Sorry n.n)

## [2.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.0.1...v2.1.0) - 2020-11-01

Hello! Ezequiel here. Just wanted to say thanks for trust in me, in the past days I made a lot of changes into the code, adding some functions that'll surely be in a future release, and also putting everything together in my fork. I answered almost every issue raised, and tried to help every person that use this module. Today, I'm glad to be able to share everything I learned to all of you. I apologize for some fast and uncommented commits, I just thought that some things needed to be fixed ASAP.
See you in future commits, issues and PRs :D

### Fixed

- A typo in `es` translation
- A few typos in README.md (#134 and #149) and API/README.md (#179)
- Delayed commands should now work (#190)
- Typo on remote_action (#184)
- IP now showing (#194)
- MM restart button don't just stop anymore (#126)
- Saving config should work as expected now (#153)
- installer.sh now detects where's the node installation (#222)

### Added

- Danish translation (#157)
- Italian translation (#162)
- Port now showing according to config.js (#98)
- Custom commands for shutdown and reboot

### Changed

- Overwrite of local changes when updating from a repository
- Now requires MagicMirror² version 2.12

## [2.0.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.0.0...v2.0.1) - 2020-10-28

**Huge thanks to [@ezeholz](https://github.com/ezeholz)** who has offered to maintain the module from now on!
Credit for this (and future) versions and releases goes to @ezeholz (unless noted otherwise).

Now requires MagicMirror² version 2.7.

### Fixed

- Path to font awesome icons
- A few typos in `ca` and `es` translations
- Updates to `remote.html` to support new `basePath` feature in MM `config.js`, [follow up to this MM issue](https://github.com/MagicMirrorOrg/MagicMirror/issues/1973), related to #185

## [2.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.5...v2.0.0) - 2019-02-21

Huge shout out to [shbatm](https://github.com/shbatm) for his work on this new major version, which brings a new API, custom menus and commands and lots of other stuff:

### Added

- REST API interface for controlling all aspects of the MagicMirror² from HTTP RESTful-style GET and POST calls, based on principles from [MMM-Api](https://github.com/juzim/MMM-Api)
  - Full API Documentation at [API/README.md](API/README.md)
- Live daily updates of `modules.json` from the MagicMirror² wiki, based on principles from [MMM-Remote-Control-Repository](https://github.com/eouia/MMM-Remote-Control-Repository).
- Incorporated some features found in [MMM-OnScreenMenu](https://github.com/shbatm/MMM-OnScreenMenu) that were not originally in this module.
  - Monitor (Connected Screen) On-Off Status and Toggle
  - Delayed calls ("DELAYED" Query option and `.../delay` API paths)
  - If using Electron: Open Dev Tools, Minimize, Toggle Fullscreen
- Configuration Option to send custom shell commands to use. Currently, only custom monitor on/off/status commands are supported.
- Module Control menu - Automatically generated from the API to control the different modules you have installed, based on their `notificationReceived` function.
- Custom menu items. See [Custom Menu Items in README](README.md#custom-menu-items)
- Norsk bokmål translation

### Changed

- Updates to `remote.html` and the `node_helper.js` to use direct SocketIO communication back and forth instead of separate HTTP calls.
  - Future framework for following PM2 logs and more live update options.
- General clean-up and standardization of status reporting for GET and POST calls, to original URLs and to new API URLs.
- Updated to ES2015 (ES Version 6) function calls in most locations.
- Added USER_PRESENCE controls from [AgP42](https://github.com/AgP42)
- Added/updated french translations from [BKeyport](https://github.com/Bkeyport) and [Mysh3ll](https://github.com/Mysh3ll)
- Added SHOW/HIDE/TOGGLE ALL modules option per request from [Rene1709](https://github.com/Rene1709)

### Upcoming Changes

- Add additional MMM-OnScreenMenu features:
  - Moving modules' positions
- PM2 Log Follower / Terminal Window
- Added Notification Echo option to config to echo all Module Notifications to the remote's DevTools console for debugging.
- Allow for text input in the Module Controls menu to be able to provide a notification payload.

## [1.1.5](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.4...v1.1.5) - 2018-05-14

### Added

- French translation

### Fixed

- Updated documentation to new MagicMirror² version
- Fix error on updating MagicMirror²

## [1.1.4](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.3...v1.1.4) - 2017-09-17

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

## [1.1.3](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.2...v1.1.3) - 2017-04-23

### Added

- Portuguese translation
- Indonesian translation
- Support for iOS Icon and Webapp

### Changed

- Installation no longer needs a temporary file

### Fixed

- Icon paths adapted to changes in [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) 2.1.0

## [1.1.2](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.1...v1.1.2) - 2017-02-01

**Note:** Since version 1.1.0 this module uses (new) dependencies, check the [Updating section in the README.md](README.md#update).

### Added

- Swedish translation

### Changed

- Installation process updated in [README.md](README.md#Installation)
- Automatic installer/updater includes hint to restart [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)

### Fixed

- Issues with not applying shown and hidden status correctly to modules
- Issues where lockstrings were missing
- Modules sometimes did not show correctly in the UI as hidden or shown:
  - This is due to a bug in [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)
  - PR [#659](https://github.com/MagicMirrorOrg/MagicMirror/pull/659) to fix this was made in the project, will be released in the next version

## [1.1.1](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.0...v1.1.1) - 2017-01-26

### Changed

- Updated internal list of available modules

## [1.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v1.0.0...v1.1.0) - 2017-01-26

### Added

- First version of installer script
- Menu to send Alerts and/or Notifications to your mirror
- Menu to update your MagicMirror² installation and your modules (through `git pull`)
- Menu to change the `config.js`
  - Modules can be installed, added, removed, configured
  - There will be backups of the five last versions of the `config.js` in the `config` folder
  - Some of these parts are hidden behind an "experimental" warning, do **not** ignore that warning
- NOTIFICATION action, see [README.md](README.md#notification-request) for details

### Changed

- Menu structure
  - Old "Edit" and "Settings" are now under "Edit view"
- Smaller font sizes in lists

### Fixed

- Issues coming from disabled modules since MM version 2.1.0

## [1.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v0.1.0...v1.0.0) - 2016-10-24 - First Official Release

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
- Internal changes in preparation for MagicMirror² version `2.1.0`

## [0.1.0](https://github.com/Jopyth/MMM-Remote-Control/releases/tag/v0.1.0) - 2016-09-30

Initial release of the Remote Control module.
