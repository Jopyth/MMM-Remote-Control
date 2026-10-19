/**
 * Compatibility adapter for the legacy REST config endpoint, which still accepts
 * a complete config object. The browser editor sends explicit source operations.
 */

const configSource = require('./configSource.js')

/**
 * Clone config data without losing function references.
 * @param {unknown} value - Value to clone
 * @returns {unknown} Cloned value
 */
function safeClone(value) {
  if (value === null || typeof value !== 'object') return value
  return Array.isArray(value) ? value.map(item => safeClone(item)) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, safeClone(child)]))
}

/**
 * Compare values while handling functions by source text.
 * @param {unknown} left - First value
 * @param {unknown} right - Second value
 * @returns {boolean} Whether values are equivalent
 */
function isEqual(left, right) {
  if (left === right) return true
  if (typeof left === 'function' && typeof right === 'function') return left.toString() === right.toString()
  if (left === null || right === null || typeof left !== typeof right || (typeof left !== 'object')) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => isEqual(item, right[index]))
  }
  const leftEntries = Object.entries(left)
  const rightKeys = Object.keys(right)
  return leftEntries.length === rightKeys.length && leftEntries.every(([key, value]) => Object.hasOwn(right, key) && isEqual(value, right[key]))
}

/**
 * Create the minimal source operations for a legacy full-config request.
 * Arrays are replaced as values; the browser editor uses explicit element operations.
 * @param {Array<string|number>} path - Current location in the source config
 * @param {unknown} previous - Current runtime value
 * @param {unknown} next - Requested value
 * @param {Array<object>} operations - Operations to append
 * @returns {void}
 */
function diffValue(path, previous, next, operations) {
  if (typeof previous === 'function' || isEqual(previous, next)) return
  if (!previous) {
    operations.push({ op: 'set', path, value: next })
    return
  }
  if (!next) {
    operations.push({ op: 'set', path, value: next })
    return
  }
  if (typeof previous !== 'object') {
    operations.push({ op: 'set', path, value: next })
    return
  }
  if (typeof next !== 'object') {
    operations.push({ op: 'set', path, value: next })
    return
  }
  if (Array.isArray(previous)) {
    operations.push({ op: 'set', path, value: next })
    return
  }
  if (Array.isArray(next)) {
    operations.push({ op: 'set', path, value: next })
    return
  }
  for (const [key, value] of Object.entries(previous)) {
    if (typeof value === 'function') continue
    if (!Object.hasOwn(next, key)) operations.push({ op: 'remove', path: [...path, key] })
  }
  for (const [key, value] of Object.entries(next)) {
    if (Object.hasOwn(previous, key)) diffValue([...path, key], previous[key], value, operations)
    else operations.push({ op: 'add', path, key, value })
  }
}

/**
 * Adapt an operation to keys that are explicitly present in the source file.
 * @param {string} source - Current config.js text
 * @param {object} operation - Operation to adapt
 * @returns {object|null} Adapted operation, or null when a removal has no source target
 */
function adaptOperation(source, operation) {
  switch (operation.op) {
    case 'remove':
      try {
        configSource.locate(source, operation.path)
        return operation
      }
      catch {
        return null
      }
    case 'set':
      try {
        configSource.locate(source, operation.path)
        return operation
      }
      catch {
        return { op: 'add', path: operation.path.slice(0, -1), key: operation.path.at(-1), value: operation.value }
      }
    case 'add':
      try {
        configSource.locate(source, [...operation.path, operation.key])
        return { op: 'set', path: [...operation.path, operation.key], value: operation.value }
      }
      catch {
        return operation
      }
    default:
      return operation
  }
}

/**
 * Apply a legacy full-object update to config source text.
 * @param {string} source - Current config.js text
 * @param {object} previous - Previous config object
 * @param {object} next - Requested config object
 * @returns {string} Updated config.js text
 */
function applyConfigDiff(source, previous, next) {
  const operations = []
  diffValue([], previous, next, operations)
  const compatibleOperations = operations.map(operation => adaptOperation(source, operation)).filter(Boolean)
  return configSource.applyOps(source, compatibleOperations)
}

module.exports = { safeClone, applyConfigDiff }
