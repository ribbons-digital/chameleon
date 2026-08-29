import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'
import { toDraft7Schema } from '../../src/webmcp/makeTool'
import {
  DescribeInput,
  GetActivityLogInput,
  ReadWidgetDataInput,
} from '../../src/webmcp/tools/describe'
import {
  AddRowsInput,
  BindDataInput,
  DeleteRowsInput,
  UpdateRowsInput,
} from '../../src/webmcp/tools/data'
import {
  SetLayoutInput,
  SetThemeInput,
} from '../../src/webmcp/tools/layout'
import {
  CreateFormToolInput,
  RemoveMintedToolInput,
} from '../../src/webmcp/tools/mint'
import { UndoInput } from '../../src/webmcp/tools/undo'
import {
  AddWidgetInput,
  RemoveWidgetInput,
  UpdateWidgetInput,
} from '../../src/webmcp/tools/widgets'
import { STATIC_TOOLS } from '../../src/webmcp/tools'
import { ERROR_HINTS } from '../../src/webmcp/result'

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
    name: 'read_widget_data',
    schema: ReadWidgetDataInput,
    accept: [{ widgetId: 'w_abcdef' }, { widgetId: 'w_x8Kd2q', limit: 10, offset: 2 }],
    reject: [{ widgetId: 'welcome' }, { widgetId: 'w_abcdef', limit: 0 }],
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
  {
    name: 'bind_data',
    schema: BindDataInput,
    accept: [
      {
        widgetId: 'w_abcdef',
        fields: [{ key: 'name', label: 'Name', type: 'text' }],
      },
    ],
    reject: [{ widgetId: 'w_abcdef', fields: [] }, { widgetId: 'bad' }],
  },
  {
    name: 'add_rows',
    schema: AddRowsInput,
    accept: [{ widgetId: 'w_abcdef', rows: [{ name: 'Ada' }] }],
    reject: [{ widgetId: 'w_abcdef', rows: [] }, { widgetId: 'w_abcdef' }],
  },
  {
    name: 'update_rows',
    schema: UpdateRowsInput,
    accept: [
      {
        widgetId: 'w_abcdef',
        patches: [{ rowId: 'r_one', set: { name: 'Ada' } }],
      },
    ],
    reject: [{ widgetId: 'w_abcdef', patches: [] }],
  },
  {
    name: 'delete_rows',
    schema: DeleteRowsInput,
    accept: [{ widgetId: 'w_abcdef', rowIds: ['r_one'] }],
    reject: [{ widgetId: 'w_abcdef', rowIds: [] }],
  },
  {
    name: 'set_layout',
    schema: SetLayoutInput,
    accept: [
      {
        items: [
          { widgetId: 'w_abcdef', x: 0, y: 0, w: 6, h: 4 },
        ],
      },
    ],
    reject: [{ items: [] }, { items: [{ widgetId: 'bad' }] }],
  },
  {
    name: 'set_theme',
    schema: SetThemeInput,
    accept: [{}, { boardTitle: 'Health', theme: 'matcha', mode: 'dark' }],
    reject: [{ theme: 'ocean' }, { density: 'dense' }],
  },
  {
    name: 'create_form_tool',
    schema: CreateFormToolInput,
    accept: [
      {
        widgetId: 'w_abcdef',
        toolName: 'log_reading',
        description:
          'Records one health reading. Example: log a reading of 104.',
      },
    ],
    reject: [
      { widgetId: 'w_abcdef', toolName: 'Bad Name', description: 'Long enough description.' },
      { widgetId: 'w_abcdef', toolName: 'log_ok', description: 'short' },
    ],
  },
  {
    name: 'remove_minted_tool',
    schema: RemoveMintedToolInput,
    accept: [{ toolName: 'log_reading' }],
    reject: [{ toolName: 'x' }, { toolName: 'Bad Name' }],
  },
  {
    name: 'undo',
    schema: UndoInput,
    accept: [{}, { steps: 3 }],
    reject: [{ steps: 0 }, { steps: 11 }],
  },
] as const

function hasRef(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if ('$ref' in value) return true
  return Object.values(value).some(hasRef)
}

describe('schema round-trip', () => {
  it('publishes inline Draft-7 schemas for every static tool', () => {
    for (const tool of STATIC_TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' })
      expect(hasRef(tool.inputSchema)).toBe(false)
    }
  })

  it('registers every static tool name exactly once', () => {
    const registered = new Set(STATIC_TOOLS.map((tool) => tool.name))
    expect(registered.size).toBe(STATIC_TOOLS.length)
    expect(registered).toEqual(
      new Set([
        'describe_current_state',
        'read_widget_data',
        'get_activity_log',
        'add_widget',
        'update_widget',
        'remove_widget',
        'bind_data',
        'add_rows',
        'update_rows',
        'delete_rows',
        'set_layout',
        'set_theme',
        'create_form_tool',
        'remove_minted_tool',
        'undo',
      ]),
    )
    expect(ERROR_HINTS.NAME_TAKEN).toContain('remove_minted_tool')
    expect(ERROR_HINTS.WIDGET_NOT_FOUND).toContain('describe_current_state')
    expect(ERROR_HINTS.ROW_NOT_FOUND).toContain('read_widget_data')
    expect(ERROR_HINTS.NO_FIELDS_BOUND).toContain('bind_data')
    expect(ERROR_HINTS.NO_FIELDS_BOUND).toContain('add_rows')
    expect(ERROR_HINTS.LIMIT_EXCEEDED).toContain('remove_widget')
    expect(ERROR_HINTS.LIMIT_EXCEEDED).toContain('delete_rows')
    expect(ERROR_HINTS.TOOL_NOT_FOUND).toContain('describe_current_state')
    expect(Object.values(ERROR_HINTS).join('\n')).not.toMatch(/\u2014/)
  })

  it('steers pipelines to kanban and empty widgets to add_rows', () => {
    const byName = Object.fromEntries(
      STATIC_TOOLS.map((tool) => [tool.name, tool.description]),
    )
    expect(byName.add_widget).toMatch(/pipeline/i)
    expect(byName.add_widget).toMatch(/kanban/)
    expect(byName.add_widget).toMatch(/add_rows/)
    expect(byName.add_widget).toMatch(/No rows yet/)
    expect(byName.add_widget).toMatch(/No items yet/)
    expect(byName.add_widget).toMatch(/groupByField/)
    expect(byName.add_widget).toMatch(/config\.markdown/)
    expect(byName.add_widget).toMatch(/\bnext\b/)
    expect(byName.describe_current_state).toMatch(/unfinished/)
    expect(byName.bind_data).toMatch(/add_rows/)
    expect(byName.bind_data).toMatch(/No rows yet/)
    expect(byName.bind_data).toMatch(/checklist/)
    expect(byName.add_rows).toMatch(/No rows yet/)
    expect(byName.add_rows).toMatch(/No items yet/)
    expect(byName.add_rows).toMatch(/note/)
    expect(byName.update_widget).toMatch(/add_rows/)
    expect(byName.describe_current_state).toMatch(/add_rows/)
    expect(byName.add_widget).toMatch(/create_form_tool/)
    expect(byName.create_form_tool).toMatch(/REQUIRED/)
    expect(byName.add_rows).toMatch(/create_form_tool/)
    expect(byName.describe_current_state).toMatch(/create_form_tool/)
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
