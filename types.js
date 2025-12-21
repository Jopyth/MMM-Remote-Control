/**
 * @file Central type definitions for MMM-Remote-Control
 * @module types
 * @description
 * This file contains JSDoc type definitions used throughout the codebase.
 * Import these types in your files with:
 * @example
 * // @typedef {import('./types').ModuleData} ModuleData
 */

/**
 * Module metadata from 3rd-party-modules repository
 * @typedef {object} ModuleData
 * @property {string} name - Module display name
 * @property {string} id - GitHub repository identifier (e.g., "author/repo")
 * @property {string} url - GitHub repository URL
 * @property {string} maintainer - Module maintainer/author
 * @property {string} [description] - Module description
 * @property {string} [category] - Module category (e.g., "Weather", "Calendar")
 * @property {string[]} [keywords] - Search keywords
 * @property {number} [stars] - GitHub stars count
 * @property {string} [image] - Preview image URL
 * @property {string} [lastCommit] - Last commit date (ISO 8601)
 * @property {string} [license] - License type (e.g., "MIT", "GPL-3.0")
 * @property {boolean} [installed] - Whether module is installed locally
 * @property {boolean} [isDefaultModule] - Whether module is a MagicMirror default
 * @property {boolean} [hasChangelog] - Whether module has a changelog
 * @property {object} [defaultConfig] - Default configuration object
 */

/**
 * MagicMirror configuration data
 * @typedef {object} ConfigData
 * @property {string} [address] - Server address
 * @property {number} [port] - Server port
 * @property {string} [language] - Display language
 * @property {string} [timeFormat] - Time format (12/24)
 * @property {string} [units] - Unit system (metric/imperial)
 * @property {ModuleConfig[]} modules - Module configurations
 * @property {object} [electronOptions] - Electron-specific options
 * @property {string[]} [ipWhitelist] - IP whitelist for access control
 */

/**
 * Module configuration entry
 * @typedef {object} ModuleConfig
 * @property {string} module - Module name
 * @property {string} [position] - Display position
 * @property {string} [header] - Module header text
 * @property {object} [config] - Module-specific configuration
 * @property {string[]} [classes] - CSS classes
 * @property {boolean} [disabled] - Whether module is disabled
 */

/**
 * Backup metadata
 * @typedef {object} BackupInfo
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} filename - Backup filename
 * @property {number} size - File size in bytes
 * @property {string} [description] - Optional backup description
 */

/**
 * API response structure
 * @typedef {object} ApiResponse
 * @property {boolean} success - Whether the operation succeeded
 * @property {object | Array | string | number | boolean} [data] - Response data (type varies by endpoint)
 * @property {string} [message] - Error or info message
 * @property {object} [query] - Original query parameters
 */

/**
 * Socket notification payload
 * @typedef {object} NotificationPayload
 * @property {string} notification - Notification type
 * @property {object | Array | string | number | boolean | null} [payload] - Notification data
 */

/**
 * Git operation result
 * @typedef {object} GitResult
 * @property {boolean} success - Whether git operation succeeded
 * @property {string} [stdout] - Command stdout
 * @property {string} [stderr] - Command stderr
 * @property {number} [code] - Exit code
 * @property {string} [error] - Error message
 */

/**
 * Module installation options
 * @typedef {object} InstallOptions
 * @property {string} url - Git repository URL
 * @property {number} [index] - Installation index in modules array
 * @property {boolean} [skipNpmInstall] - Skip npm install after clone
 */

module.exports = {};
