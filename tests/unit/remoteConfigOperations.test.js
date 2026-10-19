const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

describe('remote config operation builder', () => {
  test('creates only changed module setting operations', async () => {
    const { Remote } = await import('../../remote/remote.mjs')
    await import('../../remote/remote-config.mjs')

    const operations = []
    Remote.appendConfigDiff(
      ['modules', 0],
      {
        module: 'clock',
        position: 'top_left',
        config: { showWeek: false, untouched: 5 },
      },
      {
        module: 'clock',
        position: 'top_right',
        config: { showWeek: true, added: 'value' },
      },
      operations,
    )

    assert.deepEqual(operations, [
      { op: 'set', path: ['modules', 0, 'position'], value: 'top_right' },
      { op: 'remove', path: ['modules', 0, 'config', 'untouched'] },
      { op: 'set', path: ['modules', 0, 'config', 'showWeek'], value: true },
      { op: 'add', path: ['modules', 0, 'config'], key: 'added', value: 'value' },
    ])
  })
})
