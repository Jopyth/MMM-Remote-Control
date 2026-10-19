const assert = require('node:assert/strict')
const { describe, test } = require('node:test')
const configSource = require('../../lib/configSource.js')

const SAMPLE = `/* leading comment */
let config = {
  address: "localhost", // keep local
  port: 8080,
  // modules section
  modules: [
    {
      module: "clock",
      position: "top_left"
    },
    {
      module: "calendar",
      position: "top_right",
      config: {
        interval: 5 * 60 * 1000
      }
    }
  ]
};

if (typeof module !== "undefined") { module.exports = config; }
`

describe('configSource', () => {
  test('setValue replaces only the targeted value', () => {
    const next = configSource.setValue(SAMPLE, ['port'], { kind: 'number', value: 9000 })
    assert.match(next, /port: 9000/)
    assert.match(next, /address: "localhost", \/\/ keep local/)
    assert.match(next, /\/\* leading comment \*\//)
  })

  test('setValue leaves sibling code expressions untouched', () => {
    const next = configSource.setValue(SAMPLE, ['modules', 0, 'position'], { kind: 'string', value: 'top_right' })
    assert.match(next, /module: "clock",\s*\n\s*position: "top_right"/)
    assert.match(next, /interval: 5 \* 60 \* 1000/)
  })

  test('addProperty inserts a new top-level setting', () => {
    const next = configSource.addProperty(SAMPLE, [], 'timeFormat', { kind: 'number', value: 24 })
    assert.match(next, /timeFormat: 24/)
    configSource.parse(next)
  })

  test('addProperty refuses to duplicate an existing key', () => {
    assert.throws(() => configSource.addProperty(SAMPLE, [], 'port', { kind: 'number', value: 1 }), /already set/)
  })

  test('addItem appends a new module to the array', () => {
    const next = configSource.addItem(SAMPLE, ['modules'], {
      kind: 'object',
      children: [{ key: 'module', node: { kind: 'string', value: 'weather' } }],
    })
    assert.match(next, /module: "weather"/)
    configSource.parse(next)
  })

  test('remove drops a module entry and keeps the rest intact', () => {
    const next = configSource.remove(SAMPLE, ['modules', 0])
    assert.doesNotMatch(next, /module: "clock"/)
    assert.match(next, /module: "calendar"/)
    configSource.parse(next)
  })

  test('moveItem reorders modules while preserving their source text', () => {
    const next = configSource.moveItem(SAMPLE, ['modules'], 0, 1)
    const clockIndex = next.indexOf('module: "clock"')
    const calendarIndex = next.indexOf('module: "calendar"')
    assert.ok(calendarIndex < clockIndex)
    assert.match(next, /interval: 5 \* 60 \* 1000/)
  })

  test('applyOps applies several operations in sequence', () => {
    const next = configSource.applyOps(SAMPLE, [
      { op: 'set', path: ['port'], value: { kind: 'number', value: 9000 } },
      { op: 'remove', path: ['modules', 0] },
      { op: 'add', path: [], key: 'timeFormat', value: { kind: 'number', value: 24 } },
    ])
    assert.match(next, /port: 9000/)
    assert.doesNotMatch(next, /module: "clock"/)
    assert.match(next, /timeFormat: 24/)
  })

  test('applyOps accepts ordinary JSON values', () => {
    const next = configSource.applyOps(SAMPLE, [
      { op: 'set', path: ['port'], value: 9000 },
      { op: 'add', path: [], key: 'timeFormat', value: 24 },
    ])
    assert.match(next, /port: 9000/)
    assert.match(next, /timeFormat: 24/)
  })

  test('applyOps normalizes indentation to the file preferred style', () => {
    const source = `let config = {
  address: "localhost",
      port: 8080,
  modules: [
    {
      module: "clock"
    }
  ],
  foo: true,
  bar: true
}`
    const next = configSource.applyOps(source, [])
    assert.match(next, /\n\u{20}{2}port: 8080,/u)
    assert.match(next, /\n\u{20}{4}\{\n\u{20}{6}module: "clock"\n\u{20}{4}\}/u)
  })

  test('applyOps preserves multiline template contents', () => {
    const source = [
      'let config = {',
      '  first: true,',
      '    port: 8080,',
      '    html: `<section>',
      '      keep this indentation',
      '    </section>`,',
      '  last: true',
      '}',
    ].join('\n')
    const next = configSource.applyOps(source, [])
    assert.ok(next.includes('  port: 8080,'))
    assert.ok(next.includes('  html: `<section>\n      keep this indentation\n    </section>`,'))
  })
})
