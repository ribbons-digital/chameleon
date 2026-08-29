import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import {
  addRows,
  bindData,
  deleteRows,
  updateRows,
} from '../../src/webmcp/tools/data'
import { readWidgetData } from '../../src/webmcp/tools/describe'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

async function addTable() {
  await executeTool(addWidget, {
    type: 'table',
    title: 'Guests',
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
  return useBoardStore.getState().document.widgets[0].id
}

describe('bind_data', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('replaces fields and migrates rows', async () => {
    const widgetId = await addTable()
    await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'Ada', rsvp: 'yes' }],
    })
    const result = await executeTool(bindData, {
      widgetId,
      fields: [
        { key: 'name', label: 'Full name', type: 'text', required: true },
        { key: 'seats', label: 'Seats', type: 'number' },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.migratedRowCount).toBe(1)
    expect(result.next).toMatch(/add_rows/)
    expect(result.next).not.toMatch(/create_form_tool/)
    const table = useBoardStore.getState().document.widgets[0]
    expect(table.type).toBe('table')
    if (table.type !== 'table') return
    expect(table.dataset.fields.map((field) => field.key)).toEqual(['name', 'seats'])
    expect(table.dataset.rows[0].name).toBe('Ada')
    expect(table.dataset.rows[0].rsvp).toBeUndefined()
  })

  it('rejects note and checklist widgets', async () => {
    await executeTool(addWidget, { type: 'note', title: 'Hello' })
    const noteId = useBoardStore.getState().document.widgets[0].id
    const note = await executeTool(bindData, {
      widgetId: noteId,
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
    })
    expect(note.ok).toBe(false)
    expect((note.error as { code: string }).code).toBe('WRONG_WIDGET_TYPE')

    resetBoard(emptyBoard())
    await executeTool(addWidget, { type: 'checklist', title: 'Prep' })
    const checklistId = useBoardStore.getState().document.widgets[0].id
    const checklist = await executeTool(bindData, {
      widgetId: checklistId,
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
    })
    expect(checklist.ok).toBe(false)
    expect((checklist.error as { code: string }).code).toBe('WRONG_WIDGET_TYPE')
  })

  it('rejects kanban schemas that break groupByField', async () => {
    await executeTool(addWidget, {
      type: 'kanban',
      title: 'Jobs',
      fields: [
        { key: 'title', label: 'Role', type: 'text', required: true },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: ['applied', 'interview'],
        },
      ],
      config: { groupByField: 'status', cardTitleField: 'title' },
    })
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(bindData, {
      widgetId,
      fields: [{ key: 'title', label: 'Role', type: 'text', required: true }],
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('FIELD_NOT_FOUND')
  })

  it('requires create_form_tool after binding a form', async () => {
    await executeTool(addWidget, { type: 'form', title: 'Blood sugar log' })
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(bindData, {
      widgetId,
      fields: [
        { key: 'reading', label: 'Reading', type: 'number', required: true },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.next).toMatch(/create_form_tool/)
    expect(result.next).not.toMatch(/add_rows on /)
  })

  it('steers binding a blood sugar table toward a form and mint', async () => {
    await executeTool(addWidget, { type: 'table', title: 'Blood Sugar Log' })
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(bindData, {
      widgetId,
      fields: [
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
          action: 'create_form_tool',
        }),
      ]),
    )
  })
})

describe('add_rows / update_rows / delete_rows', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('adds coerced rows and reads them back', async () => {
    const widgetId = await addTable()
    const added = await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'Ada', rsvp: ' yes ' }],
    })
    expect(added.ok).toBe(true)
    expect(added.rowCount).toBe(1)
    expect(added.unfinished).toEqual([])
    const read = await executeTool(readWidgetData, { widgetId })
    expect(read.ok).toBe(true)
    expect(read.total).toBe(1)
    expect((read.rows as Array<Record<string, unknown>>)[0].rsvp).toBe('yes')
  })

  it('returns NO_FIELDS_BOUND when a table has no schema', async () => {
    await executeTool(addWidget, { type: 'table', title: 'Empty' })
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'Ada' }],
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('NO_FIELDS_BOUND')
  })

  it('does not apply any patches when update_rows is invalid', async () => {
    const widgetId = await addTable()
    await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'Ada', rsvp: 'yes' }],
    })
    const rowId = useBoardStore.getState().document.widgets[0].dataset?.rows[0]._id
    const result = await executeTool(updateRows, {
      widgetId,
      patches: [
        { rowId, set: { name: 'Grace' } },
        { rowId, set: { rsvp: 'nope' } },
      ],
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('INVALID_ROWS')
    expect(useBoardStore.getState().document.widgets[0].dataset?.rows[0].name).toBe(
      'Ada',
    )
  })

  it('returns ROW_NOT_FOUND for unknown row ids', async () => {
    const widgetId = await addTable()
    await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'Ada', rsvp: 'yes' }],
    })
    const missing = await executeTool(updateRows, {
      widgetId,
      patches: [{ rowId: 'r_missing', set: { name: 'Grace' } }],
    })
    expect(missing.ok).toBe(false)
    expect((missing.error as { code: string }).code).toBe('ROW_NOT_FOUND')
    expect((missing.error as { hint: string }).hint).toContain('read_widget_data')
  })

  it('updates and deletes rows', async () => {
    const widgetId = await addTable()
    await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'Ada', rsvp: 'yes' }],
    })
    const rowId = useBoardStore.getState().document.widgets[0].dataset?.rows[0]._id as string
    const updated = await executeTool(updateRows, {
      widgetId,
      patches: [{ rowId, set: { rsvp: 'maybe' } }],
    })
    expect(updated.ok).toBe(true)
    const removed = await executeTool(deleteRows, { widgetId, rowIds: [rowId] })
    expect(removed.ok).toBe(true)
    expect(removed.rowCount).toBe(0)
  })

  it('adds checklist items without bind_data', async () => {
    await executeTool(addWidget, { type: 'checklist', title: 'Prep' })
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const result = await executeTool(addRows, {
      widgetId,
      rows: [{ text: 'Buy flowers', done: false }],
    })
    expect(result.ok).toBe(true)
    expect(useBoardStore.getState().document.widgets[0].dataset?.rows).toHaveLength(1)
  })
})
