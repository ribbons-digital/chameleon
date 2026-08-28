import { createRowId } from '../model/ids'
import { parseRowValues, validateValue } from '../model/fields'
import type { Actor, Field, Row, Widget } from '../model/types'
import { useBoardStore } from './boardStore'
import { mutate } from './mutate'

const now = () => new Date().toISOString()

function widgetById(widgetId: string): Widget | undefined {
  return useBoardStore.getState().document.widgets.find((widget) => widget.id === widgetId)
}

function stamp(widget: Widget, actor: Actor, timestamp: string) {
  widget.updatedAt = timestamp
  widget.lastModifiedBy = actor
}

export function humanDeleteWidget(widgetId: string): void {
  const widget = widgetById(widgetId)
  if (!widget) return
  mutate(
    {
      actor: 'human',
      action: 'remove_widget',
      summary: `Removed “${widget.title}”`,
    },
    (draft) => {
      draft.widgets = draft.widgets.filter((candidate) => candidate.id !== widgetId)
      draft.mintedTools = draft.mintedTools.filter((tool) => tool.widgetId !== widgetId)
    },
  )
}

export function humanAddBlankRow(widgetId: string): { ok: true; rowId: string } | { ok: false; message: string } {
  const widget = widgetById(widgetId)
  if (!widget || widget.type === 'note' || !widget.dataset) {
    return { ok: false, message: 'This widget has no dataset.' }
  }
  const rowId = createRowId()
  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: 'add_rows',
      summary: `Added a row to “${widget.title}”`,
    },
    (draft) => {
      const target = draft.widgets.find((candidate) => candidate.id === widgetId)
      if (!target || target.type === 'note' || !target.dataset) return
      target.dataset.rows.push({
        _id: rowId,
        _createdAt: timestamp,
        _updatedAt: timestamp,
        _createdBy: 'human',
      })
      stamp(target, 'human', timestamp)
    },
  )
  return { ok: true, rowId }
}

export function humanAddRow(
  widgetId: string,
  values: Record<string, unknown>,
  summary?: string,
): { ok: true; rowId: string } | { ok: false; message: string } {
  const widget = widgetById(widgetId)
  if (!widget || widget.type === 'note' || !widget.dataset) {
    return { ok: false, message: 'This widget has no dataset.' }
  }
  const parsed = parseRowValues(widget.dataset.fields, values, {
    index: 0,
    partial: false,
  })
  if (!parsed.ok) {
    return { ok: false, message: parsed.issues[0]?.issue ?? 'Invalid row.' }
  }
  const rowId = createRowId()
  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: 'add_rows',
      summary: summary ?? `Added a row to “${widget.title}”`,
    },
    (draft) => {
      const target = draft.widgets.find((candidate) => candidate.id === widgetId)
      if (!target || target.type === 'note' || !target.dataset) return
      target.dataset.rows.push({
        _id: rowId,
        _createdAt: timestamp,
        _updatedAt: timestamp,
        _createdBy: 'human',
        ...parsed.values,
      })
      stamp(target, 'human', timestamp)
    },
  )
  return { ok: true, rowId }
}

export function humanUpdateCell(
  widgetId: string,
  rowId: string,
  field: Field,
  value: unknown,
  summary?: string,
): { ok: true } | { ok: false; message: string } {
  const widget = widgetById(widgetId)
  if (!widget || widget.type === 'note' || !widget.dataset) {
    return { ok: false, message: 'This widget has no dataset.' }
  }
  const result = validateValue(field, value)
  if (!result.ok) return { ok: false, message: result.message }
  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: 'update_rows',
      summary: summary ?? `Edited “${widget.title}”`,
    },
    (draft) => {
      const target = draft.widgets.find((candidate) => candidate.id === widgetId)
      if (!target || target.type === 'note' || !target.dataset) return
      const row = target.dataset.rows.find((candidate) => candidate._id === rowId)
      if (!row) return
      if (result.value === undefined) delete row[field.key]
      else row[field.key] = result.value
      row._updatedAt = timestamp
      stamp(target, 'human', timestamp)
    },
  )
  return { ok: true }
}

export function humanDeleteRow(widgetId: string, rowId: string): void {
  const widget = widgetById(widgetId)
  if (!widget || widget.type === 'note' || !widget.dataset) return
  const row = widget.dataset.rows.find((candidate) => candidate._id === rowId)
  const label =
    row && typeof row.text === 'string'
      ? row.text
      : row && typeof row.title === 'string'
        ? row.title
        : 'a row'
  mutate(
    {
      actor: 'human',
      action: 'delete_rows',
      summary: `Removed ${label} from “${widget.title}”`,
    },
    (draft) => {
      const target = draft.widgets.find((candidate) => candidate.id === widgetId)
      if (!target || target.type === 'note' || !target.dataset) return
      target.dataset.rows = target.dataset.rows.filter((candidate) => candidate._id !== rowId)
      stamp(target, 'human', now())
    },
  )
}

export function formatCell(field: Field, row: Row): string {
  const value = row[field.key]
  if (value === undefined || value === null || value === '') return ''
  if (field.type === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
