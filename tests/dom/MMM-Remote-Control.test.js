const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { Window } = require('happy-dom')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

describe('MMM-Remote-Control.js module', () => {
  let window, Module

  before(() => {
    window = new Window({
      url: 'http://localhost:8080',
      settings: {
        disableJavaScriptFileLoading: true,
        disableJavaScriptEvaluation: false,
        disableCSSFileLoading: true,
      },
    })

    window.Module = {
      register: function (moduleName, moduleDefinition) {
        Module = moduleDefinition
      },
    }

    window.MM = {
      getModules: () => ({
        enumerate: () => {},
      }),
    }

    window.Log = {
      info: () => {},
      log: () => {},
      error: () => {},
      warn: () => {},
    }

    window.location = { hash: '' }
    window.globalThis = window

    const modulePath = path.join(__dirname, '../../MMM-Remote-Control.js')
    const moduleCode = fs.readFileSync(modulePath, 'utf8')
    const context = vm.createContext(window)
    vm.runInContext(moduleCode, context)
  })

  after(() => {
    window.close()
  })

  test('module is registered with Module.register', () => {
    assert.ok(Module, 'Module should be defined')
    assert.ok(Module.handleDefaultSettings, 'handleDefaultSettings should exist')
  })

  test('handleDefaultSettings handles missing lockStrings gracefully', () => {
    const payload = {
      settingsVersion: 1,
      moduleData: [
        { identifier: 'module_1', name: 'clock' },
        { identifier: 'module_2', name: 'calendar', lockStrings: ['lock1'] },
        { identifier: 'module_3', name: 'weather', lockStrings: undefined },
      ],
      brightness: 100,
      temp: 327,
      zoom: 100,
      backgroundColor: '',
      fontColor: '',
    }

    assert.doesNotThrow(() => {
      Module.handleDefaultSettings.call({
        identifier: 'MMM-Remote-Control',
        settingsVersion: 1,
        setBrightness: () => {},
        setTemp: () => {},
        setZoom: () => {},
        setBackgroundColor: () => {},
        setFontColor: () => {},
      }, payload)
    })
  })

  test('handleDefaultSettings handles non-array lockStrings', () => {
    const payload = {
      settingsVersion: 1,
      moduleData: [{ identifier: 'module_1', name: 'clock', lockStrings: 'not-an-array' }],
      brightness: 100,
      temp: 327,
      zoom: 100,
      backgroundColor: '',
      fontColor: '',
    }

    assert.doesNotThrow(() => {
      Module.handleDefaultSettings.call({
        identifier: 'MMM-Remote-Control',
        settingsVersion: 1,
        setBrightness: () => {},
        setTemp: () => {},
        setZoom: () => {},
        setBackgroundColor: () => {},
        setFontColor: () => {},
      }, payload)
    })
  })

  const getDom = (config, addresses) => {
    const notifications = []
    const wrapper = Module.getDom.call({
      config: { showQRCode: true, qrCodeSize: 150, qrCodePosition: 'above', hostname: '', ...config },
      addresses,
      port: '',
      qrCodeDataUrl: null,
      sendSocketNotification: (notification, payload) => {
        notifications.push({ notification, payload })
      },
    })
    return { wrapper, notifications }
  }

  test('getDom shows the IP address when no hostname is configured', () => {
    const { wrapper, notifications } = getDom({}, ['192.168.0.7'])
    assert.match(wrapper.textContent, /http:\/\/192\.168\.0\.7:8080\/remote\.html/)
    assert.equal(notifications[0].payload.url, 'http://192.168.0.7:8080/remote.html')
  })

  test('getDom shows the configured hostname instead of the IP address', () => {
    const { wrapper, notifications } = getDom({ hostname: 'mirror.local' }, ['192.168.0.7'])
    assert.match(wrapper.textContent, /http:\/\/mirror\.local:8080\/remote\.html/)
    assert.equal(notifications[0].payload.url, 'http://mirror.local:8080/remote.html')
  })

  test('getDom does not request a QR code for the placeholder address', () => {
    const { wrapper, notifications } = getDom({}, [])
    assert.match(wrapper.textContent, /ip-of-your-mirror/)
    assert.equal(notifications.length, 0)
  })
})
