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

  test('creates root operations for changed general settings', async () => {
    const { Remote } = await import('../../remote/remote.mjs')
    await import('../../remote/remote-config.mjs')

    const operations = []
    Remote.appendConfigDiff(
      [],
      { address: 'localhost', port: 8080, ipWhitelist: ['127.0.0.1'] },
      { address: '0.0.0.0', port: 8080, ipWhitelist: ['127.0.0.1'] },
      operations,
    )

    assert.deepEqual(operations, [
      { op: 'set', path: ['address'], value: '0.0.0.0' },
    ])
  })

  test('renders global settings and saves changed fields as root operations', async () => {
    const { Window } = await import('happy-dom')
    const { Remote } = await import('../../remote/remote.mjs')
    await import('../../remote/remote-config.mjs')
    const window = new Window()
    const previousDocument = Reflect.get(globalThis, 'document')
    Reflect.set(globalThis, 'document', window.document)
    const container = document.createElement('div')
    container.id = 'general-config-settings'
    const saveButton = document.createElement('button')
    saveButton.id = 'save-config'
    document.body.append(container, saveButton)
    let notification
    Remote.generalConfigChanged = new Set()
    Remote.generalConfigOriginal = { address: 'localhost', port: 8080, ipWhitelist: ['127.0.0.1'] }
    Remote.savedData = { config: { ...Remote.generalConfigOriginal, modules: [] } }
    Remote.configModulesOriginal = []
    Remote.deletedModules = []
    Remote.sendSocketNotification = (name, payload) => {
      notification = { name, payload }
    }
    Remote.setStatus = () => {}

    try {
      Remote.renderGeneralConfigSettings(Remote.savedData.config)
      const address = document.querySelector('[data-config-key="address"]')
      const warning = document.querySelector('.general-config-warning')
      assert.equal(address.value, 'localhost')
      assert.equal(document.querySelector('[data-config-key="port"]').value, '8080')
      assert.equal(warning.hidden, true)

      address.value = '0.0.0.0'
      address.dispatchEvent(new window.Event('input'))
      assert.equal(warning.hidden, false)

      Remote.saveConfig()
      assert.equal(notification.name, 'NEW_CONFIG')
      assert.deepEqual(notification.payload.operations, [
        { op: 'set', path: ['address'], value: '0.0.0.0' },
      ])
    }
    finally {
      if (previousDocument === undefined) Reflect.deleteProperty(globalThis, 'document')
      else Reflect.set(globalThis, 'document', previousDocument)
      window.happyDOM.abort()
    }
  })
})
