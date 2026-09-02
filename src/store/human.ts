import { createRowId, createWidgetId } from '../model/ids'
import { parseRowValues, validateValue } from '../model/fields'
import { KANBAN_UNGROUPED, placeRowInColumn } from '../model/kanbanOrder'
import { autoPlace } from '../model/layout'
import { LIMITS } from '../model/limits'
import type {
  Actor,
  Field,
  GridPosition,
  Row,
  Widget,
} from '../model/types'
import { createWidget, defaultConfig, defaultDataset } from '../model/widgets'
import { useBoardStore } from './boardStore'
import { mutate } from './mutate'

/** Widget types a human can create without an agent; the rest need bound fields first. */
export const HUMAN_WIDGET_TYPES = ['note', 'checklist', 'table'] as const
export type HumanWidgetType = (typeof HUMAN_WIDGET_TYPES)[number]

const HUMAN_WIDGET_TITLES: Record<HumanWidgetType, string> = {
  note: 'New note',
  checklist: 'New checklist',
  table: 'New table',
}

export const BOARD_TITLE_MAX = 60
export const WIDGET_TITLE_MAX = 80

const now = () => new Date().toISOString()

function widgetById(widgetId: string): Widget | undefined {
  return useBoardStore.getState().document.widgets.find((widget) => widget.id === widgetId)
}

function stamp(widget: Widget, actor: Actor, timestamp: string) {
  widget.updatedAt = timestamp
  widget.lastModifiedBy = actor
}

function samePosition(left: GridPosition, right: GridPosition): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.w === right.w &&
    left.h === right.h
  )
}

/**
 * Persist the grid layout after a human drag or resize. The grid compacts and
 * pushes neighbours while one widget moves, so every widget whose position
 * changed is written in the same command; otherwise the stored board (what
 * the agent reads) drifts from what the human sees on screen.
 */
export function humanApplyLayout(
  layout: Array<GridPosition & { widgetId: string }>,
  primaryWidgetId: string,
  action: 'move' | 'resize',
): boolean {
  const widgets = useBoardStore.getState().document.widgets
  const primary = widgets.find((widget) => widget.id === primaryWidgetId)
  if (!primary) return false
  const next = new Map(
    layout.map(({ widgetId, x, y, w, h }) => [widgetId, { x, y, w, h }]),
  )
  const changed = widgets.filter((widget) => {
    const position = next.get(widget.id)
    return position !== undefined && !samePosition(widget.position, position)
  })
  if (changed.length === 0) return false
  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: action === 'move' ? 'move_widget' : 'resize_widget',
      summary: `${action === 'move' ? 'Moved' : 'Resized'} “${primary.title}”`,
    },
    (draft) => {
      for (const widget of draft.widgets) {
        const position = next.get(widget.id)
        if (!position || samePosition(widget.position, position)) continue
        widget.position = position
        stamp(widget, 'human', timestamp)
      }
    },
  )
  return true
}

export function humanAddWidget(
  type: HumanWidgetType,
): { ok: true; widgetId: string } | { ok: false; message: string } {
  const widgets = useBoardStore.getState().document.widgets
  if (widgets.length >= LIMITS.widgetsPerBoard) {
    return {
      ok: false,
      message: `The board already has ${LIMITS.widgetsPerBoard} widgets.`,
    }
  }
  const widgetId = createWidgetId()
  const title = HUMAN_WIDGET_TITLES[type]
  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: 'add_widget',
      summary: `Added ${type} “${title}”`,
    },
    (draft) => {
      draft.widgets.push(
        createWidget({
          id: widgetId,
          type,
          title,
          position: autoPlace(draft.widgets, type),
          config: defaultConfig(type),
          dataset: defaultDataset(type),
          createdAt: timestamp,
          updatedAt: timestamp,
          lastModifiedBy: 'human',
        }),
      )
    },
  )
  return { ok: true, widgetId }
}

export function humanRenameBoard(
  title: string,
): { ok: true } | { ok: false; message: string } {
  const next = title.trim()
  if (!next) return { ok: false, message: 'Give the board a name.' }
  if (next.length > BOARD_TITLE_MAX) {
    return {
      ok: false,
      message: `Keep the name to ${BOARD_TITLE_MAX} characters.`,
    }
  }
  if (next === useBoardStore.getState().document.title) return { ok: true }
  mutate(
    {
      actor: 'human',
      action: 'rename_board',
      summary: `Renamed board to “${next}”`,
    },
    (draft) => {
      draft.title = next
    },
  )
  return { ok: true }
}

export function humanRenameWidget(
  widgetId: string,
  title: string,
): { ok: true } | { ok: false; message: string } {
  const widget = widgetById(widgetId)
  if (!widget) return { ok: false, message: 'This widget is no longer on the board.' }
  const next = title.trim()
  if (!next) return { ok: false, message: 'Give the widget a name.' }
  if (next.length > WIDGET_TITLE_MAX) {
    return {
      ok: false,
      message: `Keep the name to ${WIDGET_TITLE_MAX} characters.`,
    }
  }
  if (next === widget.title) return { ok: true }
  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: 'update_widget',
      summary: `Renamed “${widget.title}” to “${next}”`,
    },
    (draft) => {
      const target = draft.widgets.find(
        (candidate) => candidate.id === widgetId,
      )
      if (!target) return
      target.title = next
      stamp(target, 'human', timestamp)
    },
  )
  return { ok: true }
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

export function humanMoveKanbanCard(
  widgetId: string,
  rowId: string,
  groupField: Field,
  column: string,
  index: number,
  summary: string,
): { ok: true; changed: boolean } | { ok: false; message: string } {
  const widget = widgetById(widgetId)
  if (!widget || widget.type !== 'kanban' || !widget.dataset) {
    return { ok: false, message: 'This widget is not a kanban.' }
  }
  if (column !== KANBAN_UNGROUPED) {
    const result = validateValue(groupField, column)
    if (!result.ok) return { ok: false, message: result.message }
  }
  const placed = placeRowInColumn(
    widget.dataset.rows,
    rowId,
    groupField.key,
    column,
    index,
  )
  if (!placed) return { ok: true, changed: false }

  const timestamp = now()
  mutate(
    {
      actor: 'human',
      action: 'update_rows',
      summary,
    },
    (draft) => {
      const target = draft.widgets.find((candidate) => candidate.id === widgetId)
      if (!target || target.type !== 'kanban' || !target.dataset) return
      const next = placeRowInColumn(
        target.dataset.rows,
        rowId,
        groupField.key,
        column,
        index,
      )
      if (!next) return
      const moved = next.find((candidate) => candidate._id === rowId)
      if (moved) moved._updatedAt = timestamp
      target.dataset.rows = next
      stamp(target, 'human', timestamp)
    },
  )
  return { ok: true, changed: true }
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
