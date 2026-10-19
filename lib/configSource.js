/**
 * Reads and edits MagicMirror's config.js as *source text*.
 *
 * The file is parsed with acorn only to learn where each value sits. Edits replace,
 * insert or delete just those character ranges, so everything else in the file --
 * comments, formatting, functions, settings nothing else understands -- is left
 * exactly as it was. Ported from MMM-ConfigEditor's lib/config-source.js.
 */

const acorn = require('acorn')

const PARSE_OPTIONS = { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true }
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u

/**
 * Parse config.js source text into an acorn AST.
 * @param {string} source - Full config.js source text
 * @returns {object} Acorn Program node
 */
function parse(source) {
  return acorn.parse(source, PARSE_OPTIONS)
}

/**
 * Find the object literal assigned to `config` (let/const/var config = {...} or config = {...}).
 * @param {object} ast - Acorn Program node
 * @returns {object} The ObjectExpression node for the config object
 */
function findConfigObject(ast) {
  let found = null
  const visit = (node) => {
    if (!node || typeof node !== 'object' || found) return
    if (node.type === 'VariableDeclarator' && node.id?.name === 'config' && node.init?.type === 'ObjectExpression') {
      found = node.init
      return
    }
    if (node.type === 'AssignmentExpression' && node.left?.name === 'config' && node.right?.type === 'ObjectExpression') {
      found = node.right
      return
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) for (const item of child) visit(item)
      else if (child && typeof child.type === 'string') visit(child)
    }
  }
  visit(ast)
  if (!found) throw new Error('Couldn\'t find `let config = { ... }` in config.js.')
  return found
}

/**
 * Get the string key name of an object property node, or null if it can't be determined safely.
 * @param {object} property - Property AST node
 * @returns {string|null} Key name, or null for computed/method/non-plain properties
 */
function keyName(property) {
  if (property.type !== 'Property' || property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  return property.key.type === 'Literal' ? String(property.key.value) : null
}

/**
 * Describe a path for error messages, e.g. `.modules[2].config`.
 * @param {Array<string|number>} path - Path steps (strings are keys, numbers are array indexes)
 * @returns {string} Human-readable path description
 */
function describe(path) {
  return path.map(step => (typeof step === 'number' ? `[${step}]` : `.${step}`)).join('') || '(root)'
}

/**
 * Walk from the root config object down a path to the AST node at that position.
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path steps (strings are keys, numbers are array indexes)
 * @returns {object} The AST node at that path
 */
function locate(source, path) {
  let node = findConfigObject(parse(source))
  for (const step of path) {
    if (typeof step === 'number') {
      if (node.type !== 'ArrayExpression' || step >= node.elements.length || node.elements[step] === null) throw new Error(`No item ${step} at ${describe(path)}`)
      node = node.elements[step]
    }
    else {
      if (node.type !== 'ObjectExpression') throw new Error(`Not an object at ${describe(path)}`)
      const property = node.properties.find(candidate => keyName(candidate) === step)
      if (!property) throw new Error(`No setting "${step}" at ${describe(path)}`)
      node = property.value
    }
  }
  return node
}

/**
 * Locate the member (property or array element) at `path`, alongside its parent and list.
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path to the member (last step is the member itself)
 * @returns {{parent: object, member: object, index: number, list: Array<object>}} Parent node, the member node, its index, and the list it belongs to
 */
function locateProperty(source, path) {
  const parent = locate(source, path.slice(0, -1))
  const key = path.at(-1)
  if (typeof key === 'number') {
    if (parent.type !== 'ArrayExpression') throw new Error(`Not a list at ${describe(path)}`)
    return { parent, member: parent.elements[key], index: key, list: parent.elements }
  }
  const index = parent.properties.findIndex(property => keyName(property) === key)
  return { parent, member: parent.properties[index], index, list: parent.properties }
}

/**
 * Get the leading whitespace of the line containing `position`.
 * @param {string} source - Full config.js source text
 * @param {number} position - Character offset
 * @returns {string} Leading whitespace of that line
 */
function indentOf(source, position) {
  const lineStart = source.lastIndexOf('\n', position - 1) + 1
  return (/^[ \t]*/u).exec(source.slice(lineStart))[0]
}

/**
 * Guess the file's preferred indentation unit by majority vote over its code lines.
 * @param {string} source - Full config.js source text
 * @returns {string} Preferred indentation unit (tab or spaces)
 */
function indentUnit(source) {
  let tabs = 0
  let twoSpace = 0
  let fourSpace = 0
  for (const line of source.split('\n')) {
    if ((/^\t+\S/u).test(line)) tabs++
    else if ((/^ {4}(?! *\*)\S/u).test(line) || ((/^ {4}( {4})*\S/u).test(line) && !(/^ +\*/u).test(line))) fourSpace++
    else if ((/^ {2}\S/u).test(line) && !(/^ +\*/u).test(line)) twoSpace++
  }
  if (tabs >= twoSpace && tabs >= fourSpace) return '\t'
  return fourSpace >= twoSpace ? ' '.repeat(4) : '  '
}

/**
 * Normalize indentation inside the config object while preserving its detected style.
 * @param {string} source - Full config.js source text
 * @returns {string} Source with consistent indentation inside config
 */
function normalizeIndentation(source) {
  const config = findConfigObject(parse(source))
  const unit = indentUnit(source)
  const rootIndent = indentOf(source, config.start)
  const lineStarts = [0]
  let position = 0
  for (const character of source) {
    position += character.length
    if (character === '\n') lineStarts.push(position)
  }
  const lineOf = (position) => {
    let low = 0
    let high = lineStarts.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (lineStarts[middle] <= position) low = middle + 1
      else high = middle
    }
    return low - 1
  }

  const templateLines = new Set()
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'TemplateElement') {
      for (let line = lineOf(node.start) + 1; line <= lineOf(node.end); line++) templateLines.add(line)
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) visit(item)
      }
      else if (child && typeof child.type === 'string') visit(child)
    }
  }
  visit(config)

  const events = []
  const configText = source.slice(config.start, config.end)
  const tokenizer = acorn.tokenizer(configText, {
    ...PARSE_OPTIONS,
    onComment: (_block, _text, start) => {
      events.push({ kind: 'comment', start: config.start + start })
    },
  })
  let token = tokenizer.getToken()
  while (token.type.label !== 'eof') {
    events.push({ kind: 'token', label: token.type.label, start: config.start + token.start })
    token = tokenizer.getToken()
  }
  events.sort((left, right) => left.start - right.start)

  const depthByLine = new Map()
  let depth = 0
  for (const event of events) {
    if (event.kind === 'token' && ['}', ']', ')'].includes(event.label)) depth = Math.max(0, depth - 1)
    const line = lineOf(event.start)
    if (!depthByLine.has(line)) depthByLine.set(line, depth)
    if (event.kind === 'token' && ['{', '[', '(', '${'].includes(event.label)) depth++
  }

  const firstLine = lineOf(config.start)
  const lastLine = lineOf(config.end)
  let result = source
  for (let line = lastLine; line >= firstLine; line--) {
    const depthForLine = depthByLine.get(line)
    if (line === firstLine || depthForLine === undefined || templateLines.has(line)) continue
    const start = lineStarts[line]
    const end = lineStarts[line + 1] ?? source.length
    const text = result.slice(start, end)
    const leading = (/^[ \t]*/u).exec(text)[0]
    if (leading.length === text.length) continue
    const desired = rootIndent + unit.repeat(depthForLine)
    if (leading !== desired) result = splice(result, start, start + leading.length, desired)
  }
  return result
}

/**
 * Render a string value as a quoted JS string literal, matching the file's quote style.
 * @param {string} value - Raw string value
 * @param {string} source - Full config.js source text (used to detect quote style)
 * @returns {string} Quoted source text
 */
function quoteString(value, source) {
  const quote = source.includes('\'') && !source.includes('"') ? '\'' : '"'
  const body = JSON.stringify(value).slice(1, -1)
  return quote === '"' ? `"${body}"` : `'${body.replaceAll(String.raw`\"`, '"').replaceAll('\'', String.raw`\'`)}'`
}

/**
 * Convert a JSON-compatible value into a render-tree node.
 * @param {unknown} value - Value to convert
 * @returns {object} Render-tree node
 */
function toTree(value) {
  if (value === null || value === undefined) return { kind: 'null' }
  if (typeof value === 'string') return { kind: 'string', value }
  if (typeof value === 'number') return { kind: 'number', value }
  if (typeof value === 'boolean') return { kind: 'boolean', value }
  return Array.isArray(value) ? { kind: 'array', items: value.map(item => toTree(item)) } : { kind: 'object', children: Object.entries(value).map(([key, child]) => ({ key, node: toTree(child) })) }
}

/**
 * Accept either a render-tree node or a regular JSON-compatible value.
 * @param {object|unknown} value - Value to normalize
 * @returns {object} Render-tree node
 */
function normalizeTree(value) {
  return value && typeof value === 'object' && typeof value.kind === 'string' ? value : toTree(value)
}

/**
 * Render an editable-tree value as JavaScript source.
 * Tree shape: { kind: "string"|"number"|"boolean"|"null"|"object"|"array"|"code", value?, children?, items?, code? }
 * @param {object} value - Editable-tree value to render
 * @param {string} source - Full config.js source text (used for style detection)
 * @param {string} indent - Current indentation prefix
 * @returns {string} Rendered source text for the value
 */
function generate(value, source, indent) {
  const unit = indentUnit(source)
  switch (value.kind) {
    case 'string': return quoteString(value.value ?? '', source)
    case 'number': {
      const number = Number(value.value)
      if (!Number.isFinite(number)) throw new TypeError(`"${value.value}" isn't a number.`)
      return String(number)
    }
    case 'boolean': return value.value ? 'true' : 'false'
    case 'null': return 'null'
    case 'code': {
      const code = String(value.code ?? '').trim()
      if (!code) throw new Error('A code value can\'t be empty.')
      try {
        acorn.parseExpressionAt(`(${code})`, 0, PARSE_OPTIONS)
      }
      catch (error) {
        throw new Error(`Not valid JavaScript: ${code} (${error.message})`, { cause: error })
      }
      return code
    }
    case 'array': {
      const items = value.items || []
      if (items.length === 0) return '[]'
      const simple = items.every(item => ['string', 'number', 'boolean', 'null'].includes(item.kind))
      const parts = items.map(item => generate(item, source, indent + unit))
      return simple && parts.join(', ').length < 70 ? `[${parts.join(', ')}]` : `[\n${parts.map(part => indent + unit + part).join(',\n')}\n${indent}]`
    }
    case 'object': {
      const children = (value.children || []).filter(child => !child.opaque)
      if (children.length === 0) return '{}'
      const lines = children.map(child => `${indent + unit}${IDENTIFIER_PATTERN.test(child.key) ? child.key : quoteString(child.key, source)}: ${generate(child.node, source, indent + unit)}`)
      return `{\n${lines.join(',\n')}\n${indent}}`
    }
    default:
      throw new Error(`Unknown value type "${value.kind}".`)
  }
}

/**
 * Replace a character range of `source` with `text`.
 * @param {string} source - Full source text
 * @param {number} start - Range start offset
 * @param {number} end - Range end offset
 * @param {string} text - Replacement text
 * @returns {string} Updated source text
 */
function splice(source, start, end, text) {
  return source.slice(0, start) + text + source.slice(end)
}

/**
 * Replace the value at `path`.
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path to the value to replace
 * @param {object} value - Editable-tree value to render in its place
 * @returns {string} Updated source text
 */
function setValue(source, path, value) {
  if (path.length === 0) throw new Error('Can\'t replace the whole config.')
  const node = locate(source, path)
  return splice(source, node.start, node.end, generate(value, source, indentOf(source, node.start)))
}

/**
 * Position of the next non-whitespace, non-comment character at or after `position`.
 * @param {string} source - Full source text
 * @param {number} position - Starting offset
 * @param {number} limit - Offset not to scan past
 * @returns {number} Offset of the next meaningful character
 */
function skipTrivia(source, position, limit) {
  let cursor = position
  while (cursor < limit) {
    if ((/\s/u).test(source[cursor])) cursor++
    else if (source.startsWith('//', cursor)) cursor = source.includes('\n', cursor) ? source.indexOf('\n', cursor) : limit
    else if (source.startsWith('/*', cursor)) cursor = source.indexOf('*/', cursor) + 2
    else break
  }
  return cursor
}

/**
 * Insert a new member (property or array item) into a container, matching its existing style.
 * @param {string} source - Full config.js source text
 * @param {object} container - The ObjectExpression or ArrayExpression AST node
 * @param {Array<object>} members - The container's existing properties or elements
 * @param {string} prefix - Text to place before the generated value (e.g. `key: `)
 * @param {object} value - Editable-tree value to render
 * @returns {string} Updated source text
 */
function insertMember(source, container, members, prefix, value) {
  const unit = indentUnit(source)
  const closeIndent = indentOf(source, container.end - 1)
  if (members.length === 0) {
    const inner = closeIndent + unit
    const text = `\n${inner}${prefix}${generate(value, source, inner)}\n${closeIndent}`
    return splice(source, container.start + 1, container.end - 1, text)
  }
  const last = members.at(-1)
  const multiline = source.slice(container.start, container.end).includes('\n')
  const indent = multiline ? indentOf(source, last.start) : ''
  const separator = multiline ? `\n${indent}` : ' '
  const item = `${prefix}${generate(value, source, indent)}`
  const next = skipTrivia(source, last.end, container.end - 1)
  if (source[next] === ',') {
    // Trailing-comma style: add after that comma (and after a same-line comment) and keep the style.
    let at = next + 1
    const rest = (/^[ \t]*\/\/[^\n]*/u).exec(source.slice(at))
    if (rest && multiline) at += rest[0].length
    return splice(source, at, at, `${separator}${item},`)
  }
  // No trailing comma: put the comma right after the last member; a same-line comment stays with it.
  const at = last.end
  const rest = (/^[ \t]*\/\/[^\n]*/u).exec(source.slice(at))
  return rest && multiline ? splice(source, at, at + rest[0].length, `,${rest[0]}${separator}${item}`) : splice(source, at, at, `,${separator}${item}`)
}

/**
 * Add `key: value` to the object at `path`.
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path to the target object
 * @param {string} key - Property name to add
 * @param {object} value - Editable-tree value to render
 * @returns {string} Updated source text
 */
function addProperty(source, path, key, value) {
  const object = locate(source, path)
  if (object.type !== 'ObjectExpression') throw new Error(`Not an object at ${describe(path)}`)
  if (!key || typeof key !== 'string') throw new Error('A setting needs a name.')
  if (object.properties.some(property => keyName(property) === key)) throw new Error(`"${key}" is already set here.`)
  const keyText = IDENTIFIER_PATTERN.test(key) ? key : quoteString(key, source)
  return insertMember(source, object, object.properties, `${keyText}: `, value)
}

/**
 * Append `value` to the array at `path` (or insert at `index`).
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path to the target array
 * @param {object} value - Editable-tree value to render
 * @param {number|null} index - Position to insert at, or null to append
 * @returns {string} Updated source text
 */
function addItem(source, path, value, index = null) {
  const array = locate(source, path)
  if (array.type !== 'ArrayExpression') throw new Error(`Not a list at ${describe(path)}`)
  if (index !== null && index < array.elements.length) {
    const before = array.elements[index]
    const indent = indentOf(source, before.start)
    const multiline = source.slice(array.start, array.end).includes('\n')
    const text = generate(value, source, indent) + (multiline ? `,\n${indent}` : ', ')
    return splice(source, before.start, before.start, text)
  }
  return insertMember(source, array, array.elements, '', value)
}

/**
 * Remove the property or array item at `path`.
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path to the member to remove
 * @returns {string} Updated source text
 */
function remove(source, path) {
  if (path.length === 0) throw new Error('Can\'t remove the whole config.')
  const { parent, member, index, list } = locateProperty(source, path)
  if (!member) throw new Error(`Nothing at ${describe(path)}`)
  if (list.length === 1) {
    return splice(source, parent.start + 1, parent.end - 1, '')
  }

  let start = member.start
  let end = member.end
  if (index < list.length - 1) {
    // Remove the member, its comma and a same-line comment; comments above the next
    // member belong to that member and stay.
    const comma = skipTrivia(source, member.end, list[index + 1].start)
    end = source[comma] === ',' ? comma + 1 : member.end
    const tail = (/^[ \t]*(\/\/[^\n]*)?\n?/u).exec(source.slice(end))
    end += tail[0].length
    // If the member started its own line, take that line's indentation too.
    const lineStart = source.lastIndexOf('\n', start - 1) + 1
    if ((/^[ \t]*$/u).test(source.slice(lineStart, start)) && tail[0].endsWith('\n')) start = lineStart
    if (end > list[index + 1].start) end = list[index + 1].start
  }
  else {
    // Last member: remove from the end of the previous one (its comma goes too).
    start = list[index - 1].end
    const next = skipTrivia(source, member.end, parent.end - 1)
    if (source[next] === ',') {
      // Keep a trailing comma on what becomes the new last member.
      start = skipTrivia(source, list[index - 1].end, member.start) + 1
      end = next + 1
    }
  }
  return splice(source, start, end, '')
}

/**
 * Move an array item from `from` to `to` within the array at `path`.
 * @param {string} source - Full config.js source text
 * @param {Array<string|number>} path - Path to the target array
 * @param {number} from - Current index of the item to move
 * @param {number} to - Destination index
 * @returns {string} Updated source text
 */
function moveItem(source, path, from, to) {
  const array = locate(source, path)
  if (array.type !== 'ArrayExpression') throw new Error(`Not a list at ${describe(path)}`)
  const elementsCount = array.elements.length
  if (from === to || from < 0 || from >= elementsCount || to < 0 || to >= elementsCount) return source
  const text = source.slice(array.elements[from].start, array.elements[from].end)
  // Re-insert the original source text untouched (keeps comments/formatting inside the item).
  const afterRemoval = remove(source, [...path, from])
  const arrayAfterRemoval = locate(afterRemoval, path)
  if (to >= arrayAfterRemoval.elements.length) {
    return insertMember(afterRemoval, arrayAfterRemoval, arrayAfterRemoval.elements, '', { kind: 'code', code: text })
  }
  const before = arrayAfterRemoval.elements[to]
  const indent = indentOf(afterRemoval, before.start)
  const multiline = afterRemoval.slice(arrayAfterRemoval.start, arrayAfterRemoval.end).includes('\n')
  return splice(afterRemoval, before.start, before.start, text + (multiline ? `,\n${indent}` : ', '))
}

/**
 * Apply one operation to source text.
 * @param {string} text - Current source text
 * @param {object} operation - Operation to apply
 * @returns {string} Updated source text
 */
function applyOperation(text, operation) {
  switch (operation.op) {
    case 'set': return setValue(text, operation.path, normalizeTree(operation.value))
    case 'add': return addProperty(text, operation.path, operation.key, normalizeTree(operation.value))
    case 'append': return addItem(text, operation.path, normalizeTree(operation.value), operation.index ?? null)
    case 'remove': return remove(text, operation.path)
    case 'move': return moveItem(text, operation.path, operation.from, operation.to)
    default: throw new Error(`Unknown operation "${operation.op}"`)
  }
}

/**
 * Apply a list of operations in order:
 *   { op: "set", path, value } | { op: "add", path, key, value } | { op: "append", path, value, index? }
 *   { op: "remove", path } | { op: "move", path, from, to }
 * @param {string} source - Full config.js source text
 * @param {Array<object>} operations - Operations to apply, in order
 * @returns {string} Updated source text
 */
function applyOps(source, operations) {
  let text = source
  for (const operation of operations) {
    text = applyOperation(text, operation)
    parse(text) // fail fast if an edit produced invalid code
  }
  text = normalizeIndentation(text)
  parse(text)
  return text
}

module.exports = { parse, findConfigObject, locate, generate, setValue, addProperty, addItem, remove, moveItem, applyOps }
