import { z } from 'zod'
import { fieldSchema, parseRowValues, type RowIssue } from '../../model/fields'
import { LIMITS } from '../../model/limits'
import { migrateRows, uniqueFieldKeys } from '../../model/migrate'
import type { Actor, ChartConfig, DataSet, Field, FormConfig, KanbanConfig, TableConfig, Widget } from '../../model/types'
import { validateConfig } from '../../model/widgets'
import { useBoardStore } from '../../store/boardStore'
import { mutate } from '../../store/mutate'
import { unfinishedWidgets } from '../../store/selectors'
import { appendRows } from '../../store/submit'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'
import { Rationale, WidgetId } from '../schemas'

export const BindDataInput = z
  .object({
    widgetId: WidgetId,
    fields: z.array(fieldSchema).min(1).max(LIMITS.fieldsPerDataset),
    rationale: Rationale,
  })
  .strict()

export const AddRowsInput = z
  .object({
    widgetId: WidgetId,
    rows: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(LIMITS.rowsPerMutation)
      .describe(
        'Objects keyed by this widget\'s field keys. Checklist keys: text, done, due, note. This is how you fill table/kanban/checklist data — do not put it in a note.',
      ),
    rationale: Rationale,
  })
  .strict()

export const UpdateRowsInput = z
  .object({
    widgetId: WidgetId,
    patches: z
      .array(
        z
          .object({
            rowId: z.string(),
            set: z
              .record(z.string(), z.unknown())
              .describe('Field key → new value. Pass null to clear a value.'),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.rowsPerMutation),
    rationale: Rationale,
  })
  .strict()

export const DeleteRowsInput = z
  .object({
    widgetId: WidgetId,
    rowIds: z.array(z.string()).min(1).max(LIMITS.rowsPerMutation),
    rationale: Rationale,
  })
  .strict()

function findWidget(widgetId: string): Widget | undefined {
  return useBoardStore.getState().document.widgets.find((widget) => widget.id === widgetId)
}

function writableDataset(
  widget: Widget,
): { ok: true; dataset: DataSet } | { ok: false; code: 'WRONG_WIDGET_TYPE'; message: string } {
  if (widget.type === 'note') {
    return {
      ok: false,
      code: 'WRONG_WIDGET_TYPE',
      message: 'Note widgets have no dataset. Edit config.markdown with update_widget instead.',
    }
  }
  return { ok: true, dataset: widget.dataset }
}

function stamp(widget: Widget, actor: Actor, now: string) {
  widget.updatedAt = now
  widget.lastModifiedBy = actor
}

function assignBoundConfig(
  widget: Exclude<Widget, { type: 'note' } | { type: 'checklist' }>,
  config: Widget['config'],
) {
  switch (widget.type) {
    case 'table':
      widget.config = config as TableConfig
      return
    case 'kanban':
      widget.config = config as KanbanConfig
      return
    case 'chart':
      widget.config = config as ChartConfig
      return
    case 'form':
      widget.config = config as FormConfig
      return
    default: {
      const _exhaustive: never = widget
      return _exhaustive
    }
  }
}

export const bindData = makeTool({
  name: 'bind_data',
  description:
    'Defines or replaces fields for a table, kanban, chart, or form; it never inserts rows. Existing rows migrate: kept keys survive, removed keys drop, and invalid select values clear. Form minted tools re-register with the new schema; call create_form_tool if none exists. Otherwise call add_rows next because "No rows yet" is unfinished. The checklist and note widgets reject this tool. Fields use snake_case keys and text|number|date|select|boolean|url types; select needs options.',
  input: BindDataInput,
  handler: (input) => {
    const widget = findWidget(input.widgetId)
    if (!widget) {
      return err('WIDGET_NOT_FOUND', `No widget has id "${input.widgetId}".`)
    }
    if (widget.type === 'note' || widget.type === 'checklist') {
      return err(
        'WRONG_WIDGET_TYPE',
        widget.type === 'note'
          ? 'Note widgets have no field schema. Put prose in config.markdown with update_widget; they have no rows.'
          : 'Checklist widgets have a fixed schema (text, done, due, note). Skip bind_data and call add_rows.',
      )
    }
    const duplicate = uniqueFieldKeys(input.fields)
    if (duplicate) {
      return err('INVALID_CONFIG', `Field key "${duplicate}" is duplicated.`, {
        duplicateKey: duplicate,
      })
    }
    const fields = input.fields as Field[]
    const validated = validateConfig(widget.type, widget.config, fields)
    if ('error' in validated) {
      return err(validated.error.code, validated.error.message, validated.error.details)
    }

    const previous = widget.dataset?.fields ?? []
    const remintedTools = useBoardStore
      .getState()
      .document.mintedTools.filter((tool) => tool.widgetId === input.widgetId)
      .map((tool) => tool.toolName)
    let migratedRowCount = 0
    const timestamp = new Date().toISOString()
    mutate(
      {
        actor: 'agent',
        action: 'bind_data',
        summary: `Bound ${fields.length} fields on “${widget.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        const target = draft.widgets.find((candidate) => candidate.id === input.widgetId)
        if (!target || target.type === 'note' || target.type === 'checklist') return
        const rows = migrateRows(target.dataset.rows, previous, fields)
        migratedRowCount = rows.length
        target.dataset = { fields: structuredClone(fields), rows }
        assignBoundConfig(target, validated.config)
        stamp(target, 'agent', timestamp)
        for (const record of draft.mintedTools) {
          if (record.widgetId !== input.widgetId) continue
          const prefix = record.description.replace(
            /(?: \(Schema updated \d{4}-\d{2}-\d{2}T[^)]+\.\))+$/,
            '',
          )
          record.description = `${prefix} (Schema updated ${timestamp}.)`
        }
      },
    )

    const next =
      widget.type === 'form'
        ? `RECOMMENDED next call: create_form_tool on ${input.widgetId}. This form now has a reusable submission signature.`
        : `REQUIRED next call: add_rows on ${input.widgetId}. bind_data only set columns. "No rows yet" means you are not done.`
    return ok({
      widgetId: input.widgetId,
      fields,
      migratedRowCount,
      remintedTool: remintedTools[0],
      next,
    })
  },
})

export const addRows = makeTool({
  name: 'add_rows',
  description:
    'REQUIRED after you add a table, kanban, checklist, or form. Fills that widget. Do not put the data in a note. "No rows yet" / "No items yet" means you skipped this call. Checklist keys: text, done, due, note (skip bind_data). Up to 50 rows; unknown keys rejected; values coerced where safe. Returns new row ids. Then check unfinished on the result — fill every remaining empty widget before you stop.',
  input: AddRowsInput,
  handler: (input) => {
    const widget = findWidget(input.widgetId)
    const added = appendRows(
      input.widgetId,
      input.rows,
      'agent',
      `Added ${input.rows.length} row${input.rows.length === 1 ? '' : 's'} to “${widget?.title ?? 'widget'}”`,
      input.rationale,
    )
    if (!added.ok) {
      return err(added.code, added.message, added.details)
    }
    const state = useBoardStore.getState()
    return ok({
      widgetId: input.widgetId,
      rowIds: added.rowIds,
      rowCount: added.rowCount,
      unfinished: unfinishedWidgets(state.document),
    })
  },
})

export const updateRows = makeTool({
  name: 'update_rows',
  description:
    'Applies partial patches to existing rows by row id (get ids from read_widget_data). Only the keys you pass change. Use this to move kanban cards (patch the group-by field), check off checklist items (patch done), or correct values. To add new data, use add_rows — not a note. Up to 50 patches per call. The call is atomic: if any patch is invalid, none apply.',
  input: UpdateRowsInput,
  handler: (input) => {
    const widget = findWidget(input.widgetId)
    if (!widget) {
      return err('WIDGET_NOT_FOUND', `No widget has id "${input.widgetId}".`)
    }
    const dataset = writableDataset(widget)
    if (!dataset.ok) {
      return err(dataset.code, dataset.message)
    }
    const byId = new Map(dataset.dataset.rows.map((row) => [row._id, row]))
    const missing = input.patches
      .map((patch) => patch.rowId)
      .filter((rowId) => !byId.has(rowId))
    if (missing.length > 0) {
      return err('ROW_NOT_FOUND', 'One or more rowIds do not exist in this widget.', {
        rowIds: [...new Set(missing)],
      })
    }

    const issues: RowIssue[] = []
    const prepared: Array<{ rowId: string; set: Record<string, unknown>; clear: string[] }> =
      []
    for (const [index, patch] of input.patches.entries()) {
      const clear: string[] = []
      const toValidate: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(patch.set)) {
        if (value === null) {
          clear.push(key)
          continue
        }
        toValidate[key] = value
      }
      const parsed = parseRowValues(dataset.dataset.fields, toValidate, {
        index,
        partial: true,
      })
      if (!parsed.ok) issues.push(...parsed.issues)
      else {
        for (const key of clear) {
          if (!dataset.dataset.fields.some((field) => field.key === key)) {
            issues.push({
              index,
              fieldKey: key,
              issue: `Unknown field key "${key}".`,
            })
          }
        }
        prepared.push({ rowId: patch.rowId, set: parsed.values, clear })
      }
    }
    if (issues.length > 0) {
      return err('INVALID_ROWS', 'One or more rows failed field validation.', issues)
    }

    const timestamp = new Date().toISOString()
    mutate(
      {
        actor: 'agent',
        action: 'update_rows',
        summary: `Updated ${prepared.length} row${prepared.length === 1 ? '' : 's'} in “${widget.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        const target = draft.widgets.find((candidate) => candidate.id === input.widgetId)
        if (!target || target.type === 'note' || !target.dataset) return
        const rows = new Map(target.dataset.rows.map((row) => [row._id, row]))
        for (const patch of prepared) {
          const row = rows.get(patch.rowId)
          if (!row) return
          for (const key of patch.clear) delete row[key]
          Object.assign(row, patch.set)
          row._updatedAt = timestamp
        }
        stamp(target, 'agent', timestamp)
      },
    )

    return ok({
      widgetId: input.widgetId,
      updatedRowIds: prepared.map((patch) => patch.rowId),
    })
  },
})

export const deleteRows = makeTool({
  name: 'delete_rows',
  description:
    'Deletes rows by id from one widget. Up to 50 per call. Deleted rows can be restored with undo. If you intend to clear an entire widget, pass all row ids from read_widget_data rather than deleting the widget itself.',
  input: DeleteRowsInput,
  handler: (input) => {
    const widget = findWidget(input.widgetId)
    if (!widget) {
      return err('WIDGET_NOT_FOUND', `No widget has id "${input.widgetId}".`)
    }
    const dataset = writableDataset(widget)
    if (!dataset.ok) {
      return err(dataset.code, dataset.message)
    }
    const known = new Set(dataset.dataset.rows.map((row) => row._id))
    const missing = input.rowIds.filter((rowId) => !known.has(rowId))
    if (missing.length > 0) {
      return err('ROW_NOT_FOUND', 'One or more rowIds do not exist in this widget.', {
        rowIds: [...new Set(missing)],
      })
    }

    const uniqueIds = [...new Set(input.rowIds)]
    mutate(
      {
        actor: 'agent',
        action: 'delete_rows',
        summary: `Removed ${uniqueIds.length} row${uniqueIds.length === 1 ? '' : 's'} from “${widget.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        const target = draft.widgets.find((candidate) => candidate.id === input.widgetId)
        if (!target || target.type === 'note' || !target.dataset) return
        const drop = new Set(uniqueIds)
        target.dataset.rows = target.dataset.rows.filter((row) => !drop.has(row._id))
        stamp(target, 'agent', new Date().toISOString())
      },
    )

    const rowCount =
      useBoardStore
        .getState()
        .document.widgets.find((candidate) => candidate.id === input.widgetId)?.dataset
        ?.rows.length ?? 0
    return ok({
      widgetId: input.widgetId,
      deletedCount: uniqueIds.length,
      rowCount,
    })
  },
})
