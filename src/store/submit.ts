import { parseRowValues, type RowIssue } from '../model/fields'
import { createRowId } from '../model/ids'
import { LIMITS } from '../model/limits'
import type { Actor, DataSet, Row, Widget } from '../model/types'
import { useBoardStore } from './boardStore'
import { mutate } from './mutate'

type AppendRowsErrorCode =
  | 'WIDGET_NOT_FOUND'
  | 'WRONG_WIDGET_TYPE'
  | 'NO_FIELDS_BOUND'
  | 'INVALID_ROWS'
  | 'LIMIT_EXCEEDED'

export type AppendRowsResult =
  | { ok: true; rowIds: string[]; rowCount: number }
  | {
      ok: false
      code: AppendRowsErrorCode
      message: string
      details?: unknown
    }

function findWidget(widgetId: string): Widget | undefined {
  return useBoardStore
    .getState()
    .document.widgets.find((widget) => widget.id === widgetId)
}

function isLogWidget(
  widget: Widget,
): widget is Widget & { type: 'form' | 'table'; dataset: DataSet } {
  return widget.type === 'form' || widget.type === 'table'
}

function normalizedTitle(title: string): string {
  return title.trim().toLowerCase()
}

function fieldKeys(fields: DataSet['fields']): string[] {
  return fields.map((field) => field.key)
}

function typesByKey(fields: DataSet['fields']): Map<string, string> {
  return new Map(fields.map((field) => [field.key, field.type]))
}

function schemasCompatible(left: DataSet, right: DataSet): boolean {
  const leftKeys = fieldKeys(left.fields)
  const rightKeys = fieldKeys(right.fields)
  if (leftKeys.length === 0 || rightKeys.length === 0) return false
  const leftTypes = typesByKey(left.fields)
  const rightTypes = typesByKey(right.fields)
  const overlap = leftKeys.filter((key) => rightKeys.includes(key))
  if (overlap.length === 0) return false
  for (const key of overlap) {
    if (leftTypes.get(key) !== rightTypes.get(key)) return false
  }
  const sameSet =
    leftKeys.length === rightKeys.length && overlap.length === leftKeys.length
  if (sameSet) return true
  const leftSubset = leftKeys.every((key) => rightKeys.includes(key))
  const rightSubset = rightKeys.every((key) => leftKeys.includes(key))
  if (!leftSubset && !rightSubset) return false
  return overlap.length >= 2
}

function pickSiblingValues(
  fields: DataSet['fields'],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(values, field.key)) {
      next[field.key] = values[field.key]
    }
  }
  return next
}

function logSiblings(widget: Widget, widgets: Widget[]): Widget[] {
  if (!isLogWidget(widget)) return []
  const title = normalizedTitle(widget.title)
  return widgets.filter((candidate) => {
    if (candidate.id === widget.id || !isLogWidget(candidate)) return false
    if (candidate.dataset.fields.length === 0) return false
    if (normalizedTitle(candidate.title) === title) return true
    const formAndTable =
      (widget.type === 'form' && candidate.type === 'table') ||
      (widget.type === 'table' && candidate.type === 'form')
    return (
      formAndTable && schemasCompatible(widget.dataset, candidate.dataset)
    )
  })
}

export function appendRows(
  widgetId: string,
  rows: Record<string, unknown>[],
  actor: Actor,
  summary: string,
  rationale?: string,
): AppendRowsResult {
  const widget = findWidget(widgetId)
  if (!widget) {
    return {
      ok: false,
      code: 'WIDGET_NOT_FOUND',
      message: `No widget has id "${widgetId}".`,
    }
  }
  if (widget.type === 'note') {
    return {
      ok: false,
      code: 'WRONG_WIDGET_TYPE',
      message: 'Note widgets have no dataset. Edit config.markdown instead.',
    }
  }
  if (widget.dataset.fields.length === 0) {
    return {
      ok: false,
      code: 'NO_FIELDS_BOUND',
      message: `Widget "${widget.title}" has no field schema yet. Call bind_data first to define its fields.`,
    }
  }
  if (widget.dataset.rows.length + rows.length > LIMITS.rowsPerWidget) {
    return {
      ok: false,
      code: 'LIMIT_EXCEEDED',
      message: `A widget can hold at most ${LIMITS.rowsPerWidget} rows.`,
      details: {
        limit: 'rowsPerWidget',
        maximum: LIMITS.rowsPerWidget,
      },
    }
  }

  const parsedRows: Record<string, unknown>[] = []
  const issues: RowIssue[] = []
  for (const [index, values] of rows.entries()) {
    const parsed = parseRowValues(widget.dataset.fields, values, {
      index,
      partial: false,
    })
    if (parsed.ok) {
      parsedRows.push(parsed.values)
    } else {
      issues.push(...parsed.issues)
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      code: 'INVALID_ROWS',
      message: 'One or more rows failed field validation.',
      details: issues,
    }
  }

  const rowIds: string[] = []
  const timestamp = new Date().toISOString()
  const siblings = logSiblings(
    widget,
    useBoardStore.getState().document.widgets,
  )
  mutate(
    {
      actor,
      action: 'add_rows',
      summary,
      rationale,
    },
    (draft) => {
      const target = draft.widgets.find(
        (candidate) => candidate.id === widgetId,
      )
      if (!target || target.type === 'note') return
      const makeRow = (values: Record<string, unknown>): Row => ({
        _id: createRowId(),
        _createdAt: timestamp,
        _updatedAt: timestamp,
        _createdBy: actor,
        ...values,
      })
      for (const values of parsedRows) {
        const row = makeRow(values)
        rowIds.push(row._id)
        target.dataset.rows.push(row)
      }
      target.updatedAt = timestamp
      target.lastModifiedBy = actor

      for (const sibling of siblings) {
        const live = draft.widgets.find(
          (candidate) => candidate.id === sibling.id,
        )
        if (!live || !isLogWidget(live)) continue
        if (live.dataset.rows.length + parsedRows.length > LIMITS.rowsPerWidget) {
          continue
        }
        for (const values of parsedRows) {
          const parsed = parseRowValues(
            live.dataset.fields,
            pickSiblingValues(live.dataset.fields, values),
            { index: 0, partial: false },
          )
          if (!parsed.ok) continue
          live.dataset.rows.push(makeRow(parsed.values))
        }
        live.updatedAt = timestamp
        live.lastModifiedBy = actor
      }
    },
  )

  const rowCount =
    findWidget(widgetId)?.dataset?.rows.length ?? widget.dataset.rows.length
  return { ok: true, rowIds, rowCount }
}

export function submitFormValues(
  widgetId: string,
  values: Record<string, unknown>,
  actor: Actor = 'human',
): AppendRowsResult {
  const widget = findWidget(widgetId)
  return appendRows(
    widgetId,
    [values],
    actor,
    `Submitted “${widget?.title ?? 'form'}”`,
  )
}
