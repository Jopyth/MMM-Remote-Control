const assert = require('node:assert/strict')
const { describe, test, beforeEach, afterEach } = require('node:test')
const path = require('node:path')
const ModuleLib = require('node:module')

// Ensure shims resolve like other tests
globalThis.process ||= {}
const shimDir = path.resolve(__dirname, '../shims')
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : '')
if (typeof ModuleLib._initPaths === 'function') ModuleLib._initPaths()

const helperFactory = require('../../node_helper.js')

const originalLoad = ModuleLib._load
const originalResolveFilename = ModuleLib._resolveFilename
const moduleOverrides = new Map()

function setModuleValue(filePath, value) {
  moduleOverrides.set(path.resolve(filePath), { type: 'value', value })
}

function setModuleError(filePath, error) {
  moduleOverrides.set(path.resolve(filePath), { type: 'error', error })
}

const BASE_CONFIG_SOURCE = 'let config = {};\n\nif (typeof module !== "undefined") { module.exports = config; }\n'

function freshHelper() {
  const helper = Object.assign({}, helperFactory)
  helper.__responses = []
  helper.sendResponse = (_res, error, payload) => {
    helper.__responses.push({ error, payload })
    return !error
  }
  helper.thisConfig = {}
  helper.configOnHd = {}
  helper.configData = { moduleData: [] }
  return helper
}

describe('answerPost config persistence', () => {
  const originalFs = {}
  const fs = require('node:fs')
  const configManager = require('../../lib/configManager.js')
  let originalSaveConfigWithBackup

  beforeEach(() => {
    // Store original methods
    originalFs.stat = fs.promises.stat
    originalFs.statSync = fs.statSync
    originalFs.copyFile = fs.promises.copyFile
    originalFs.writeFile = fs.promises.writeFile
    originalFs.readFile = fs.promises.readFile

    // Store original configManager method
    originalSaveConfigWithBackup = configManager.saveConfigWithBackup

    ModuleLib._load = function (request, parent, isMain) {
      const resolved = path.isAbsolute(request)
        ? path.resolve(request)
        : originalResolveFilename(request, parent, isMain)
      const normalized = path.resolve(resolved)
      if (moduleOverrides.has(normalized)) {
        const entry = moduleOverrides.get(normalized)
        if (entry.type === 'error') {
          throw entry.error
        }
        return entry.value
      }
      return originalLoad(request, parent, isMain)
    }
    moduleOverrides.clear()
  })

  afterEach(() => {
    // Restore original methods
    fs.promises.stat = originalFs.stat
    fs.statSync = originalFs.statSync
    fs.promises.copyFile = originalFs.copyFile
    fs.promises.writeFile = originalFs.writeFile
    fs.promises.readFile = originalFs.readFile

    // Restore configManager
    if (originalSaveConfigWithBackup) {
      configManager.saveConfigWithBackup = originalSaveConfigWithBackup
    }

    for (const [filePath] of moduleOverrides) {
      delete require.cache[filePath]
    }
    moduleOverrides.clear()
    ModuleLib._load = originalLoad
  })

  test('rotates oldest backup and writes new config', async () => {
    const helper = freshHelper()
    helper.validateConfigSource = async () => {}
    // The actual path configManager will resolve to
    const expectedConfigPath = path.resolve(__dirname, '../../../../config/config.js')

    const mtimeBySlot = Object.fromEntries(Array.from(
      { length: configManager.BACKUP_HISTORY_SIZE - 1 },
      (_, index) => [index + 1, new Date(Date.UTC(2025, 9, 7, 12) + index * 1000)],
    ))
    mtimeBySlot[3] = new Date('2025-10-01T12:00:00Z')
    fs.promises.stat = async (filePath) => {
      const match = (/backup(\d+)$/u).exec(filePath)
      if (!match) throw Object.assign(new Error('unexpected'), { code: 'ENOENT' })
      const slot = Number(match[1])
      if (Object.hasOwn(mtimeBySlot, slot)) {
        return { mtime: mtimeBySlot[slot] }
      }
      const error_ = new Error('missing')
      error_.code = 'ENOENT'
      throw error_
    }

    let written
    fs.promises.readFile = async () => BASE_CONFIG_SOURCE
    fs.promises.copyFile = async (source, destination) => {
      assert.equal(source, expectedConfigPath)
      assert.equal(destination, path.resolve('config/config.js.backup3'))
    }
    fs.promises.writeFile = async (target, contents) => {
      written = { target, contents }
    }

    const payload = { modules: [], foo: 'bar' }

    const responsePromise = new Promise((resolve) => {
      helper.sendResponse = (_res, error, data) => {
        helper.__responses.push({ error, data })
        resolve({ error, data })
        return !error
      }
    })

    await helper.answerPost({ data: 'config' }, { body: payload }, {})

    const { error, data } = await responsePromise
    assert.equal(error, undefined)
    assert.equal(written.target, expectedConfigPath)
    assert.match(written.contents, /modules: \[\]/u)
    assert.match(written.contents, /foo: "bar"/u)
    assert.equal(data.backup, path.resolve('config/config.js.backup3'))
    assert.deepEqual(data.data, payload)
  })

  test('aborts when no backup slot available', async () => {
    const helper = freshHelper()

    fs.promises.stat = async () => {
      throw new Error('stat failed')
    }

    const responses = []
    helper.sendResponse = function (_res, error, payload) {
      responses.push({ error, payload })
      return !error
    }

    await helper.answerPost({ data: 'config' }, { body: {} }, {})

    assert.equal(responses.length, 1)
    assert.ok(responses[0].error instanceof Error)
    assert.match(String(responses[0].error), /Backing up config failed/)
  })

  test('propagates write errors', async () => {
    const helper = freshHelper()
    helper.validateConfigSource = async () => {}

    fs.promises.stat = async () => {
      const error_ = new Error('missing')
      error_.code = 'ENOENT'
      throw error_
    }

    const writeError = new Error('disk full')
    fs.promises.readFile = async () => BASE_CONFIG_SOURCE
    fs.promises.copyFile = async () => {
      // Copy succeeds
    }
    fs.promises.writeFile = async () => {
      throw writeError
    }

    const responsePromise = new Promise((resolve) => {
      helper.sendResponse = function (_res, error, data) {
        resolve({ error, data })
        return !error
      }
    })

    await helper.answerPost({ data: 'config' }, { body: { foo: 'bar' } }, {})

    const { error, data } = await responsePromise
    assert.equal(error, writeError)
    assert.equal(data.query.data, 'config_update')
    assert.equal(data.backup, path.resolve('config/config.js.backup1'))
  })

  test('NEW_CONFIG applies explicit source operations', async () => {
    const helper = freshHelper()
    helper.validateConfigSource = async () => {}
    const expectedConfigPath = path.resolve(__dirname, '../../../../config/config.js')
    fs.promises.stat = async () => {
      const error = new Error('missing')
      error.code = 'ENOENT'
      throw error
    }
    fs.promises.readFile = async () => BASE_CONFIG_SOURCE
    fs.promises.copyFile = async () => {}
    let written
    fs.promises.writeFile = async (target, contents) => {
      written = { target, contents }
    }
    helper.sendSocketNotification = (notification, payload) => {
      helper.__responses.push({ notification, payload })
    }

    helper.socketNotificationReceived('NEW_CONFIG', {
      config: { modules: [], foo: 'bar' },
      operations: [{ op: 'add', path: [], key: 'foo', value: 'bar' }],
    })
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(written.target, expectedConfigPath)
    assert.match(written.contents, /foo: "bar"/u)
    assert.match(written.contents, /if \(typeof module !== "undefined"\)/u)
    assert.equal(helper.__responses[0].error, undefined)
    assert.equal(helper.__responses[0].payload.query.data, 'config_update')
  })

  test('rejects invalid config before backup or overwrite', async () => {
    const helper = freshHelper()
    const expectedConfigPath = path.resolve(__dirname, '../../../../config/config.js')
    const originalSource = BASE_CONFIG_SOURCE
    fs.promises.stat = async () => {
      const error = new Error('missing')
      error.code = 'ENOENT'
      throw error
    }
    fs.promises.readFile = async () => originalSource
    let hasBackup = false
    let wasConfigWritten = false
    fs.promises.copyFile = async () => {
      hasBackup = true
    }
    fs.promises.writeFile = async (target) => {
      if (target === expectedConfigPath) wasConfigWritten = true
    }
    helper.validateConfigSource = async () => {
      throw new Error('Config has invalid syntax')
    }

    const responsePromise = new Promise((resolve) => {
      helper.sendResponse = (_res, error, payload) => {
        resolve({ error, payload })
      }
    })
    await helper.answerPost({ data: 'config' }, { body: { foo: 'bar' } }, {})
    const { error, payload } = await responsePromise

    assert.match(error.message, /invalid syntax/u)
    assert.equal(hasBackup, false)
    assert.equal(wasConfigWritten, false)
    assert.equal(payload.backup, undefined)
  })

  test('loads candidate config in a subprocess and removes temporary file', async () => {
    const helper = freshHelper()
    const temporaryDirectory = await fs.promises.mkdtemp(path.join(require('node:os').tmpdir(), 'mmm-config-validation-'))
    const configPath = path.join(temporaryDirectory, 'config.js')
    try {
      await fs.promises.writeFile(configPath, 'let config = {};')
      await helper.validateConfigSource(configPath, 'let config = {};')
      await assert.rejects(helper.validateConfigSource(configPath, 'let config = {;'), /SyntaxError/u)
      assert.deepEqual(await fs.promises.readdir(temporaryDirectory), ['config.js'])
    }
    finally {
      await fs.promises.rm(temporaryDirectory, { recursive: true, force: true })
    }
  })

  test('UNDO_CONFIG restores backup when timestamp matches', () => {
    const helper = freshHelper()
    let answerArguments
    helper.answerPost = (query, request, res) => {
      answerArguments = { query, req: request, res }
    }

    const targetTime = new Date('2025-10-09T10:00:00Z')
    fs.statSync = (filePath) => {
      const match = (/backup(\d+)$/u).exec(filePath)
      if (!match) {
        const error = new Error('missing')
        error.code = 'ENOENT'
        throw error
      }
      if (Number(match[1]) === 4) {
        return { mtime: targetTime }
      }
      const error = new Error('missing')
      error.code = 'ENOENT'
      throw error
    }

    const restoredConfig = { modules: [{ module: 'newsfeed' }] }
    setModuleValue('config/config.js.backup4', restoredConfig)

    helper.socketNotificationReceived('UNDO_CONFIG', targetTime.toISOString())

    assert.ok(answerArguments)
    assert.deepEqual(answerArguments.query, { data: 'config' })
    assert.deepEqual(answerArguments.req.body, restoredConfig)
    assert.deepEqual(answerArguments.res, { isSocket: true })
  })

  test('UNDO_CONFIG falls back when timestamp not found', () => {
    const helper = freshHelper()
    let answerArguments
    helper.answerGet = (query, res) => {
      answerArguments = { query, res }
    }

    helper.socketNotificationReceived('UNDO_CONFIG', new Date('2025-10-01T12:00:00Z').toISOString())

    assert.ok(answerArguments)
    assert.deepEqual(answerArguments.query, { data: 'saves' })
    assert.deepEqual(answerArguments.res, { isSocket: true })
  })

  test('UNDO_CONFIG surfaces load errors', () => {
    const helper = freshHelper()

    const time = new Date('2025-10-05T09:00:00Z')
    fs.statSync = (filePath) => {
      const match = (/backup(\d+)$/u).exec(filePath)
      if (!match) {
        const error = new Error('missing')
        error.code = 'ENOENT'
        throw error
      }
      if (Number(match[1]) === 2) {
        return { mtime: time }
      }
      const error = new Error('missing')
      error.code = 'ENOENT'
      throw error
    }

    setModuleError('config/config.js.backup2', new Error('invalid'))

    assert.throws(() => {
      helper.socketNotificationReceived('UNDO_CONFIG', time.toISOString())
    }, /invalid/)
  })
})
