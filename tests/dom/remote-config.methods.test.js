const { test, describe, before } = require('node:test')
const assert = require('node:assert/strict')

let Remote

before(async () => {
  const { setupRemote } = await import('./setup.mjs')
  Remote = await setupRemote()
})

function makeSlider(value) {
  const properties = {}

  return {
    value: String(value),
    min: String(0),
    max: String(100),
    style: { setProperty: (k, v) => { properties[k] = v } },
    _props: properties,
  }
}

describe('hasForcedType', () => {
  test('root-level path (1 slash) -> forcedType true', () => {
    assert.equal(Remote.hasForcedType('<root>/position'), true)
    assert.equal(Remote.hasForcedType('<root>/port'), true)
  })

  test('nested path (2 slashes) -> forcedType false', () => {
    assert.equal(Remote.hasForcedType('<root>/config/key'), false)
  })

  test('deeply nested path -> forcedType false', () => {
    assert.equal(Remote.hasForcedType('<root>/a/b/c'), false)
  })

  test('no slash -> forcedType false', () => {
    assert.equal(Remote.hasForcedType('noslash'), false)
  })
})

describe('getTypeAsString', () => {
  test('null -> \'null\'', () => {
    assert.equal(Remote.getTypeAsString(null, '<root>/key'), 'null')
  })

  test('undefined -> \'undefined\'', () => {
    assert.equal(Remote.getTypeAsString(undefined, '<root>/key'), 'undefined')
  })

  test('array -> \'array\'', () => {
    assert.equal(Remote.getTypeAsString([1, 2, 3], '<root>/key'), 'array')
  })

  test('path \'<root>/position\' -> \'position\' regardless of value', () => {
    assert.equal(Remote.getTypeAsString('top_left', '<root>/position'), 'position')
    assert.equal(Remote.getTypeAsString(42, '<root>/position'), 'position')
  })

  test('string value -> \'string\'', () => {
    assert.equal(Remote.getTypeAsString('hello', '<root>/key'), 'string')
  })

  test('number value -> \'number\'', () => {
    assert.equal(Remote.getTypeAsString(42, '<root>/key'), 'number')
  })

  test('boolean value -> \'boolean\'', () => {
    assert.equal(Remote.getTypeAsString(true, '<root>/key'), 'boolean')
  })

  test('plain object -> \'object\'', () => {
    assert.equal(Remote.getTypeAsString({ a: 1 }, '<root>/key'), 'object')
  })
})

describe('config schema helpers', () => {
  test('suggests missing default and schema properties with their values', () => {
    const previousSchema = Remote.currentConfigSchema,
      previousDefaults = Remote.currentConfigDefaults
    Remote.currentConfigSchema = {
      type: 'object',
      properties: {
        fromSchema: { type: 'boolean', default: true },
        existing: { type: 'number' },
      },
    }
    Remote.currentConfigDefaults = {
      fromDefaults: { enabled: true },
      existing: 1,
    }

    try {
      const path = '<root>/config'
      assert.deepEqual(Remote.getSuggestedConfigKeys(path, { existing: 2 }), ['fromDefaults', 'fromSchema'])
      assert.deepEqual(Remote.getNewConfigValue(path, 'fromDefaults', 'string'), { enabled: true })
      assert.equal(Remote.getNewConfigValue(path, 'fromSchema', 'string'), true)
      assert.equal(Remote.getTypeAsString(undefined, `${path}/fromSchema`), 'boolean')
    }
    finally {
      Remote.currentConfigSchema = previousSchema
      Remote.currentConfigDefaults = previousDefaults
    }
  })

  test('enum controls preserve boolean values when reading the editor', () => {
    const previousSchema = Remote.currentConfigSchema,
      previousDefaults = Remote.currentConfigDefaults,
      previousTranslate = Remote.translate
    Remote.currentConfigSchema = {
      type: 'object',
      properties: { enabled: { type: 'boolean', enum: [false, true] } },
    }
    Remote.currentConfigDefaults = {}
    Remote.translate = key => key
    const editor = Remote.createObjectGUI('<root>', '', {
      module: 'example',
      config: { enabled: true },
    })
    document.body.append(editor)

    try {
      const select = document.getElementById('<root>/config/enabled')
      select.value = '0'
      const result = Remote.getModuleConfigFromUI()
      assert.equal(result.config.enabled, false)
      assert.equal(typeof result.config.enabled, 'boolean')
    }
    finally {
      editor.remove()
      Remote.currentConfigSchema = previousSchema
      Remote.currentConfigDefaults = previousDefaults
      Remote.translate = previousTranslate
    }
  })

  test('adds array items using the schema item enum', () => {
    const previousSchema = Remote.currentConfigSchema,
      previousDefaults = Remote.currentConfigDefaults,
      previousTranslate = Remote.translate,
      items = [true]
    Remote.currentConfigSchema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'boolean', enum: [false, true] } },
      },
    }
    Remote.currentConfigDefaults = { items: [] }
    Remote.translate = key => key
    const editor = Remote.createObjectGUI('<root>', '', {
      module: 'example',
      config: { items },
    })
    document.body.append(editor)

    try {
      document.getElementById('<root>/config/items').querySelector(':scope > .button').click()
      assert.deepEqual(items, [true, false])
      assert.equal(document.getElementById('<root>/config/items/#1').tagName.toLowerCase(), 'select')
    }
    finally {
      editor.remove()
      Remote.currentConfigSchema = previousSchema
      Remote.currentConfigDefaults = previousDefaults
      Remote.translate = previousTranslate
    }
  })

  test('clones object templates from module default arrays', () => {
    const previousSchema = Remote.currentConfigSchema,
      previousDefaults = Remote.currentConfigDefaults,
      previousTranslate = Remote.translate,
      template = { enabled: true },
      items = []
    Remote.currentConfigSchema = {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { enabled: { type: 'boolean' } } } } },
    }
    Remote.currentConfigDefaults = { items: [template] }
    Remote.translate = key => key
    const editor = Remote.createObjectGUI('<root>', '', {
      module: 'example',
      config: { items },
    })
    document.body.append(editor)

    try {
      document.getElementById('<root>/config/items').querySelector(':scope > .button').click()
      assert.deepEqual(items[0], template)
      assert.notEqual(items[0], template)
    }
    finally {
      editor.remove()
      Remote.currentConfigSchema = previousSchema
      Remote.currentConfigDefaults = previousDefaults
      Remote.translate = previousTranslate
    }
  })
})

describe('createConfigInput', () => {
  test('creates input element with correct id and class', () => {
    const input = Remote.createConfigInput('my-key', 'my-value', false)
    assert.equal(input.tagName.toLowerCase(), 'input')
    assert.equal(input.id, 'my-key')
    assert.ok(input.classList.contains('config-input'))
  })

  test('sets value when omitValue is false', () => {
    const input = Remote.createConfigInput('k', 'hello', false)
    assert.equal(input.value, 'hello')
  })

  test('does not set value when omitValue is true', () => {
    const input = Remote.createConfigInput('k', 'hello', true)
    assert.equal(input.value, '')
  })

  test('creates select element when element param is \'select\'', () => {
    const select = Remote.createConfigInput('s', '', false, 'select')
    assert.equal(select.tagName.toLowerCase(), 'select')
    assert.equal(select.id, 's')
  })
})

describe('schema descriptions', () => {
  test('renders descriptions as visible helper text', () => {
    const label = Remote.createConfigLabel(
      '<root>/config/enabled',
      'enabled',
      'boolean',
      true,
      'fa-tag',
      { description: 'Enable the module feature' },
    )
    const description = label.querySelector('.config-description')

    assert.equal(description.textContent, 'Enable the module feature')
    assert.equal(description.title, '')
  })
})

describe('updateSliderThumbColor', () => {
  test('brightness at 0% -> dark thumb color', () => {
    const slider = makeSlider(0)
    Remote.updateSliderThumbColor(slider, 'brightness')
    assert.equal(slider._props['--thumb-color'], 'rgb(50, 50, 50)')
  })

  test('brightness at 100% -> bright white thumb', () => {
    const slider = makeSlider(100)
    Remote.updateSliderThumbColor(slider, 'brightness')
    assert.equal(slider._props['--thumb-color'], 'rgb(255, 255, 255)')
  })

  test('brightness also sets --track-gradient', () => {
    const slider = makeSlider(50)
    Remote.updateSliderThumbColor(slider, 'brightness')
    assert.ok(
      slider._props['--track-gradient'].startsWith('linear-gradient'),
      'track gradient should be set',
    )
  })

  test('temp at 0% -> cool blue thumb', () => {
    const slider = makeSlider(0)
    Remote.updateSliderThumbColor(slider, 'temp')
    assert.equal(slider._props['--thumb-color'], 'rgb(100, 181, 246)')
  })

  test('temp at 100% -> warm orange thumb', () => {
    const slider = makeSlider(100)
    Remote.updateSliderThumbColor(slider, 'temp')
    assert.equal(slider._props['--thumb-color'], 'rgb(255, 147, 41)')
  })

  test('unknown type -> no CSS properties set', () => {
    const slider = makeSlider(50)
    Remote.updateSliderThumbColor(slider, 'unknown-type')
    assert.equal(Object.keys(slider._props).length, 0)
  })
})
