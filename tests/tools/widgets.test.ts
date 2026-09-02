import { beforeEach, describe, expect, it } from 'vitest'
import { LIMITS } from '../../src/model/limits'
import { useBoardStore } from '../../src/store/boardStore'
import {
  addWidget,
  removeWidget,
  updateWidget,
} from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

describe('add_widget', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('creates a note with defaults and auto-placement', async () => {
    const result = await executeTool(addWidget, {
      type: 'note',
      title: 'Dinner vision',
      rationale: 'Capture the party concept.',
    })
    expect(result.ok).toBe(true)
    expect(result.stateVersion).toBe(1)
    expect(result.widgetId).toMatch(/^w_[a-zA-Z0-9_-]{6,}$/)
    expect(result.position).toEqual({ x: 0, y: 0, w: 5, h: 5 })
    const widget = useBoardStore.getState().document.widgets[0]
    expect(widget.type).toBe('note')
    expect(widget.dataset).toBeNull()
    expect(widget.config).toMatchObject({ markdown: '', variant: 'plain' })
  })

  it('creates a table with fields and stacks below existing widgets', async () => {
    await executeTool(addWidget, { type: 'note', title: 'Top' })
    const result = await executeTool(addWidget, {
      type: 'table',
      title: 'Guest list',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        {
          key: 'rsvp',
          label: 'RSVP',
          type: 'select',
          options: ['yes', 'no', 'maybe'],
        },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.position).toEqual({ x: 0, y: 5, w: 6, h: 6 })
    const table = useBoardStore.getState().document.widgets[1]
    expect(table.dataset?.fields.map((field) => field.key)).toEqual([
      'name',
      'rsvp',
    ])
    expect(table.dataset?.rows).toEqual([])
    expect(result.needsRows).toBe(true)
    expect(result.next).toMatch(/add_rows/)
  })

  it('tells the agent a pipeline table is the wrong type', async () => {
    const result = await executeTool(addWidget, {
      type: 'table',
      title: 'Application pipeline',
      fields: [
        { key: 'company', label: 'Company', type: 'text' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: ['applied', 'screen', 'onsite', 'offer'],
        },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.needsRows).toBe(true)
    expect(result.next).toMatch(/kanban/)
    expect(result.next).toMatch(/add_rows/)
  })

  it('requires add_rows immediately after a checklist', async () => {
    const result = await executeTool(addWidget, {
      type: 'checklist',
      title: 'This week',
    })
    expect(result.ok).toBe(true)
    expect(result.needsRows).toBe(true)
    expect(result.next).toMatch(/add_rows/)
    expect(result.next).toMatch(/Skip bind_data/)
  })

  it('honors an explicit position', async () => {
    const result = await executeTool(addWidget, {
      type: 'note',
      title: 'Placed',
      position: { x: 3, y: 2, w: 4, h: 4 },
    })
    expect(result.ok).toBe(true)
    expect(result.position).toEqual({ x: 3, y: 2, w: 4, h: 4 })
  })

  it('returns LIMIT_EXCEEDED at 24 widgets', async () => {
    for (let index = 0; index < LIMITS.widgetsPerBoard; index += 1) {
      const added = await executeTool(addWidget, {
        type: 'note',
        title: `Note ${index}`,
      })
      expect(added.ok).toBe(true)
    }
    const result = await executeTool(addWidget, { type: 'note', title: 'Overflow' })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('LIMIT_EXCEEDED')
    expect(useBoardStore.getState().document.widgets).toHaveLength(24)
  })

  it('returns FIELD_NOT_FOUND when table config points at a missing field', async () => {
    const result = await executeTool(addWidget, {
      type: 'table',
      title: 'Broken',
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
      config: { sort: { field: 'missing', dir: 'asc' } },
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('FIELD_NOT_FOUND')
  })

  it('returns INVALID_CONFIG for a malformed note config', async () => {
    const result = await executeTool(addWidget, {
      type: 'note',
      title: 'Too long',
      config: { variant: 'poster' },
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('INVALID_CONFIG')
    expect((result.error as { details?: unknown }).details).toBeTruthy()
  })

  it('requires create_form_tool immediately after a form with fields', async () => {
    const result = await executeTool(addWidget, {
      type: 'form',
      title: 'Blood sugar log',
      fields: [
        { key: 'reading', label: 'Reading', type: 'number', required: true },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.next).toMatch(/REQUIRED next call: create_form_tool/)
    expect(result.next).toMatch(/add_rows does not mint/)
  })

  it('steers a blood sugar table toward a form and create_form_tool', async () => {
    const result = await executeTool(addWidget, {
      type: 'table',
      title: 'Blood Sugar Log',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'glucose', label: 'Glucose', type: 'number', required: true },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.next).toMatch(/type=form/)
    expect(result.next).toMatch(/create_form_tool/)
    expect(result.unfinished).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Blood Sugar Log',
          type: 'table',
          action: 'create_form_tool',
        }),
      ]),
    )
  })

  it('requires bind_data then create_form_tool after an empty form', async () => {
    const result = await executeTool(addWidget, {
      type: 'form',
      title: 'Log New Reading',
    })
    expect(result.ok).toBe(true)
    expect(result.next).toMatch(/bind_data/)
    expect(result.next).toMatch(/create_form_tool/)
    expect(result.next).not.toMatch(/then add_rows/)
  })

  it('rejects invalid input', async () => {
    const result = await executeTool(addWidget, { type: 'note' })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('INVALID_INPUT')
  })
})

describe('update_widget', () => {
  beforeEach(async () => {
    resetBoard(emptyBoard())
    await executeTool(addWidget, {
      type: 'note',
      title: 'Menu',
      config: { markdown: 'Tacos', variant: 'plain' },
    })
  })

  it('updates title, config, and position', async () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(updateWidget, {
      widgetId,
      title: 'Dinner menu',
      config: { markdown: 'Tacos and salsa' },
      position: { x: 2, y: 1, w: 4, h: 5 },
      rationale: 'Human asked for a clearer title.',
    })
    expect(result.ok).toBe(true)
    const widget = useBoardStore.getState().document.widgets[0]
    expect(widget.title).toBe('Dinner menu')
    expect(widget.config).toMatchObject({
      markdown: 'Tacos and salsa',
      variant: 'plain',
    })
    expect(widget.position).toEqual({ x: 2, y: 1, w: 4, h: 5 })
  })

  it('clamps a position that would overflow the 12-column grid', async () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(updateWidget, {
      widgetId,
      position: { x: 10, y: 0, w: 6, h: 4 },
    })
    expect(result.ok).toBe(true)
    expect(result.position).toEqual({ x: 6, y: 0, w: 6, h: 4 })
    expect(useBoardStore.getState().document.widgets[0].position).toEqual({
      x: 6,
      y: 0,
      w: 6,
      h: 4,
    })
  })

  it('rejects a stale mutation before it can overwrite a newer change', async () => {
    const before = useBoardStore.getState()
    const widgetId = before.document.widgets[0].id
    const result = await executeTool(updateWidget, {
      widgetId,
      title: 'Stale agent title',
      expectedStateVersion: before.document.stateVersion - 1,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({
      code: 'STALE_STATE',
      details: {
        expectedStateVersion: before.document.stateVersion - 1,
        currentStateVersion: before.document.stateVersion,
      },
    })
    const after = useBoardStore.getState()
    expect(after.document.widgets[0].title).toBe('Menu')
    expect(after.commands).toHaveLength(before.commands.length)

    const retried = await executeTool(updateWidget, {
      widgetId,
      title: 'Fresh agent title',
      expectedStateVersion: after.document.stateVersion,
    })
    expect(retried.ok).toBe(true)
    expect(useBoardStore.getState().document.widgets[0].title).toBe(
      'Fresh agent title',
    )
  })

  it('clears a config key when patched to null', async () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    await executeTool(updateWidget, {
      widgetId,
      config: { markdown: 'Keep', variant: 'callout' },
    })
    const result = await executeTool(updateWidget, {
      widgetId,
      config: { variant: null },
    })
    expect(result.ok).toBe(true)
    expect(useBoardStore.getState().document.widgets[0].config).toMatchObject({
      markdown: 'Keep',
      variant: 'plain',
    })
  })

  it('returns WIDGET_NOT_FOUND', async () => {
    const result = await executeTool(updateWidget, {
      widgetId: 'w_missing1',
      title: 'Nope',
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('WIDGET_NOT_FOUND')
  })

  it('returns INVALID_CONFIG after merge', async () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(updateWidget, {
      widgetId,
      config: { variant: 'neon' },
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('INVALID_CONFIG')
  })

  it('returns NO_CHANGES when nothing is passed', async () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(updateWidget, { widgetId })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('NO_CHANGES')
  })
})

describe('remove_widget', () => {
  beforeEach(async () => {
    resetBoard(emptyBoard())
    await executeTool(addWidget, { type: 'table', title: 'RSVPs' })
  })

  it('deletes the widget and returns an empty unregisteredTools list', async () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(removeWidget, {
      widgetId,
      rationale: 'No longer needed.',
    })
    expect(result.ok).toBe(true)
    expect(result.removedWidgetId).toBe(widgetId)
    expect(result.unregisteredTools).toEqual([])
    expect(useBoardStore.getState().document.widgets).toHaveLength(0)
  })

  it('returns WIDGET_NOT_FOUND', async () => {
    const result = await executeTool(removeWidget, { widgetId: 'w_missing1' })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('WIDGET_NOT_FOUND')
  })
})
