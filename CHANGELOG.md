## [1.1.5] - 2018-02-27
### Added
- Support for [MMM-Glance](https://github.com/eouia/MMM-Glance)

# MMM Remote Control Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
