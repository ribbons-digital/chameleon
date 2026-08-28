import { parseRowValues, type RowIssue } from '../model/fields'
import { createRowId } from '../model/ids'
import { LIMITS } from '../model/limits'
import type { Actor, Row, Widget } from '../model/types'
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
      for (const values of parsedRows) {
        const rowId = createRowId()
        const row: Row = {
          _id: rowId,
          _createdAt: timestamp,
          _updatedAt: timestamp,
          _createdBy: actor,
          ...values,
        }
        rowIds.push(rowId)
        target.dataset.rows.push(row)
      }
      target.updatedAt = timestamp
      target.lastModifiedBy = actor
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
