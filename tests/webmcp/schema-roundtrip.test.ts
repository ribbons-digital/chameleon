import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'
import { toDraft7Schema } from '../../src/webmcp/makeTool'
import { DescribeInput, GetActivityLogInput } from '../../src/webmcp/tools/describe'
import {
  AddWidgetInput,
  RemoveWidgetInput,
  UpdateWidgetInput,
} from '../../src/webmcp/tools/widgets'
import { DAY2_STATIC_TOOLS } from '../../src/webmcp/tools'

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
})

const cases = [
  {
    name: 'describe_current_state',
    schema: DescribeInput,
    accept: [{}, { include_sample_rows: false }, { include_sample_rows: true }],
    reject: [{ include_sample_rows: 'yes' }, { extra: true }],
  },
  {
    name: 'get_activity_log',
    schema: GetActivityLogInput,
    accept: [
      {},
      { limit: 5 },
      { actor: 'human', since_seq: 2 },
      { actor: 'agent', limit: 100 },
    ],
    reject: [{ limit: 0 }, { actor: 'robot' }, { since_seq: -1 }],
  },
  {
    name: 'add_widget',
    schema: AddWidgetInput,
    accept: [
      { type: 'note', title: 'Welcome' },
      {
        type: 'table',
        title: 'Guests',
        fields: [{ key: 'name', label: 'Name', type: 'text' }],
        position: { x: 0, y: 0, w: 6, h: 4 },
        rationale: 'Need a guest list.',
      },
    ],
    reject: [
      { type: 'note' },
      { type: 'window', title: 'Nope' },
      { type: 'table', title: '' },
      {
        type: 'table',
        title: 'Bad field',
        fields: [{ key: 'Name', label: 'Name', type: 'text' }],
      },
    ],
  },
  {
    name: 'update_widget',
    schema: UpdateWidgetInput,
    accept: [
      { widgetId: 'w_abcdef' },
      { widgetId: 'w_x8Kd2q', title: 'Renamed', position: { x: 1, y: 2, w: 4, h: 4 } },
    ],
    reject: [{ widgetId: 'widget-1' }, { widgetId: 'w_ab' }],
  },
  {
    name: 'remove_widget',
    schema: RemoveWidgetInput,
    accept: [{ widgetId: 'w_welcome' }, { widgetId: 'w_first_steps', rationale: 'Cleanup' }],
    reject: [{ widgetId: 'welcome' }, {}],
  },
] as const

function hasRef(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if ('$ref' in value) return true
  return Object.values(value).some(hasRef)
}

const UNREGISTERED_TOOL_NAMES = [
  'bind_data',
  'create_form_tool',
  'remove_minted_tool',
  'add_rows',
  'update_rows',
  'delete_rows',
  'read_widget_data',
  'set_layout',
  'set_theme',
]

describe('schema round-trip', () => {
  it('publishes inline Draft-7 schemas for every Day 2 tool', () => {
    for (const tool of DAY2_STATIC_TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' })
      expect(hasRef(tool.inputSchema)).toBe(false)
    }
  })

  it('does not advertise tools that are not registered', () => {
    for (const tool of DAY2_STATIC_TOOLS) {
      const published = `${tool.description}\n${JSON.stringify(tool.inputSchema)}`
      for (const name of UNREGISTERED_TOOL_NAMES) {
        expect(published, `${tool.name} mentions ${name}`).not.toContain(name)
      }
      expect(published.toLowerCase(), `${tool.name} mentions row tools`).not.toContain(
        'row tools',
      )
      expect(published.toLowerCase(), `${tool.name} mentions undo tool`).not.toContain(
        'undo tool',
      )
    }
  })

  for (const testCase of cases) {
    it(`accepts and rejects the same inputs as Zod for ${testCase.name}`, () => {
      const json = toDraft7Schema(testCase.schema)
      expect(hasRef(json)).toBe(false)
      const validate = ajv.compile(json)

      for (const input of testCase.accept) {
        const zodResult = testCase.schema.safeParse(input)
        expect(zodResult.success, `zod should accept ${JSON.stringify(input)}`).toBe(
          true,
        )
        expect(validate(input), `ajv should accept ${JSON.stringify(input)}`).toBe(
          true,
        )
      }

      for (const input of testCase.reject) {
        const zodResult = testCase.schema.safeParse(input)
        expect(zodResult.success, `zod should reject ${JSON.stringify(input)}`).toBe(
          false,
        )
        expect(validate(input), `ajv should reject ${JSON.stringify(input)}`).toBe(
          false,
        )
      }
    })
  }
})
