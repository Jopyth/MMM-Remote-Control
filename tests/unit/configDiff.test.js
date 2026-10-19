const assert = require('node:assert/strict')
const { describe, test } = require('node:test')
const configDiff = require('../../lib/configDiff.js')
const configSource = require('../../lib/configSource.js')

const SOURCE = `/* mirror config */
let config = {
  address: "localhost",
  port: 8080,
  modules: [
    {
      module: "clock",
      config: { interval: 5 * 60 * 1000 }
    }
  ]
};
`

function callback() {
  return 'ok'
}

describe('legacy config payload adapter', () => {
  test('updates changed plain values without rewriting unrelated source', () => {
    const next = configDiff.applyConfigDiff(
      SOURCE,
      { address: 'localhost', port: 8080 },
      { address: 'localhost', port: 9000, language: 'de' },
    )
    assert.match(next, /port: 9000/)
    assert.match(next, /language: "de"/)
    assert.match(next, /\/\* mirror config \*\//)
    assert.match(next, /interval: 5 \* 60 \* 1000/)
    configSource.parse(next)
  })

  test('leaves function-valued settings untouched when JSON dropped them', () => {
    const operationConfig = { callback: function callback() { return 'ok' } }
    const next = configDiff.applyConfigDiff(SOURCE, operationConfig, {})
    assert.equal(next, SOURCE)
  })

  test('safeClone preserves function references and copies nested objects', () => {
    const original = { nested: { callback } }
    const copy = configDiff.safeClone(original)
    assert.notEqual(copy, original)
    assert.notEqual(copy.nested, original.nested)
    assert.equal(copy.nested.callback, callback)
  })
})
