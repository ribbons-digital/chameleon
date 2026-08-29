import { z } from 'zod'
import { fieldSchema } from '../../model/fields'
import { createWidgetId } from '../../model/ids'
import { autoPlace } from '../../model/layout'
import { LIMITS } from '../../model/limits'
import type { Field } from '../../model/types'
import {
  createWidget,
  defaultConfig,
  defaultDataset,
  mergeConfig,
  validateConfig,
} from '../../model/widgets'
import { mutate } from '../../store/mutate'
import { useBoardStore } from '../../store/boardStore'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'
import { Position, Rationale, WidgetId, WidgetTypeEnum } from '../schemas'

export const AddWidgetInput = z
  .object({
    type: WidgetTypeEnum,
    title: z.string().min(1).max(80),
    config: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Type-specific config. Kanban defaults: groupByField "status", cardTitleField "title" — pass those field keys, or override config to match. Notes: config.markdown for prose only.',
      ),
    fields: z
      .array(fieldSchema)
      .max(LIMITS.fieldsPerDataset)
      .optional()
      .describe(
        'Column schema at creation (same as bind_data). Prefer this when you already know the columns. Fields alone leave "No rows yet" — call add_rows next. For kanban include a select field matching config.groupByField (default key "status") plus a title field (default key "title").',
      ),
    position: Position.optional(),
    rationale: Rationale,
  })
  .strict()

function summaryForAdd(type: string, title: string): string {
  return `Added ${type} “${title}”`
}

export function nextAfterAdd(args: {
  type: string
  title: string
  widgetId: string
  fieldCount: number
}): { needsRows: boolean; next: string } {
  const { type, title, widgetId, fieldCount } = args
  if (type === 'note') {
    return {
      needsRows: false,
      next: 'Note created. Put prose in config.markdown only. Table, kanban, and checklist data belong in add_rows, not in this note.',
    }
  }
  if (type === 'checklist') {
    return {
      needsRows: true,
      next: `REQUIRED next call: add_rows on ${widgetId} with items keyed text/done/due/note. Skip bind_data. "No items yet" means you are not done.`,
    }
  }
  if (type === 'table' && /pipeline|funnel|status board/i.test(title)) {
    return {
      needsRows: true,
      next: `This is a pipeline. remove_widget ${widgetId} and add_widget type=kanban with a select field (key status, stage options) plus a title field, then add_rows. Do not leave a table showing "No rows yet".`,
    }
  }
  if (type !== 'checklist' && fieldCount === 0) {
    return {
      needsRows: true,
      next: `REQUIRED: bind_data on ${widgetId} to define fields, then add_rows. "No rows yet" means you are not done.`,
    }
  }
  if (type === 'form') {
    return {
      needsRows: true,
      next: `REQUIRED next call: create_form_tool on ${widgetId}. add_rows does not mint a tool and is not a substitute.`,
    }
  }
  return {
    needsRows: type !== 'chart',
    next: `REQUIRED next call: add_rows on ${widgetId} with real rows. "No rows yet" means you are not done.`,
  }
}

export const addWidget = makeTool({
  name: 'add_widget',
  description:
    'Creates one widget and returns widgetId plus required next. Repeated logs (blood sugar, applications) must be type=form, then create_form_tool. Pipeline/status board: kanban with a select groupByField, never table. Bind omitted fields for table, kanban, chart, or form. Checklist: skip bind_data, then add_rows with text/done/due/note. Notes: config.markdown only. "No rows yet" / "No items yet" means unfinished. Omit position to auto-place.',
  input: AddWidgetInput,
  handler: (input) => {
    const state = useBoardStore.getState()
    if (state.document.widgets.length >= LIMITS.widgetsPerBoard) {
      return err('LIMIT_EXCEEDED', 'The board already has 24 widgets.', {
        limit: 'widgetsPerBoard',
        maximum: LIMITS.widgetsPerBoard,
      })
    }

    const fields = input.fields as Field[] | undefined
    const validated = validateConfig(
      input.type,
      input.config ?? defaultConfig(input.type),
      fields,
    )
    if ('error' in validated) {
      return err(validated.error.code, validated.error.message, validated.error.details)
    }

    const widgetId = createWidgetId()
    const timestamp = new Date().toISOString()
    let position = autoPlace(
      state.document.widgets,
      input.type,
      input.position,
    )

    mutate(
      {
        actor: 'agent',
        action: 'add_widget',
        summary: summaryForAdd(input.type, input.title),
        rationale: input.rationale,
      },
      (draft) => {
        position = autoPlace(draft.widgets, input.type, input.position)
        const widget = createWidget({
          id: widgetId,
          type: input.type,
          title: input.title,
          position,
          config: validated.config,
          dataset: defaultDataset(input.type, fields),
          createdAt: timestamp,
          updatedAt: timestamp,
          lastModifiedBy: 'agent',
        })
        draft.widgets.push(widget)
      },
    )

    const created = defaultDataset(input.type, fields)
    const fieldCount = created?.fields.length ?? 0
    return ok({
      widgetId,
      position,
      ...nextAfterAdd({
        type: input.type,
        title: input.title,
        widgetId,
        fieldCount,
      }),
    })
  },
})

export const UpdateWidgetInput = z
  .object({
    widgetId: WidgetId,
    title: z.string().min(1).max(80).optional(),
    config: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Partial config patch, validated against the widget's type schema after merge.",
      ),
    position: Position.optional(),
    rationale: Rationale,
  })
  .strict()

export const updateWidget = makeTool({
  name: 'update_widget',
  description:
    "Updates a widget's title, config, and/or position. Only passed keys change. Config is merged per key; pass null to clear one. Use set_layout for coordinated moves, add_rows or update_rows for data, and bind_data for fields. Patch config.markdown for note prose only. Changing form config does not remint its tool because the field signature is unchanged.",
  input: UpdateWidgetInput,
  handler: (input) => {
    if (
      input.title === undefined &&
      input.config === undefined &&
      input.position === undefined
    ) {
      return err('NO_CHANGES', 'No title, config, or position was provided.')
    }

    const widget = useBoardStore
      .getState()
      .document.widgets.find((candidate) => candidate.id === input.widgetId)
    if (!widget) {
      return err('WIDGET_NOT_FOUND', `No widget has id "${input.widgetId}".`)
    }

    if (input.config) {
      const merged = mergeConfig(widget.config, input.config)
      const validated = validateConfig(
        widget.type,
        merged,
        widget.dataset?.fields,
      )
      if ('error' in validated) {
        return err(
          validated.error.code,
          validated.error.message,
          validated.error.details,
        )
      }
    }

    mutate(
      {
        actor: 'agent',
        action: 'update_widget',
        summary: `Updated “${widget.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        const target = draft.widgets.find(
          (candidate) => candidate.id === input.widgetId,
        )
        if (!target) return
        if (input.title !== undefined) target.title = input.title
        if (input.position) target.position = input.position
        if (input.config) {
          const merged = mergeConfig(target.config, input.config)
          const validated = validateConfig(
            target.type,
            merged,
            target.dataset?.fields,
          )
          if ('error' in validated) return
          target.config = validated.config
        }
        target.updatedAt = new Date().toISOString()
        target.lastModifiedBy = 'agent'
      },
    )

    return ok({ widgetId: input.widgetId })
  },
})

export const RemoveWidgetInput = z
  .object({
    widgetId: WidgetId,
    rationale: Rationale,
  })
  .strict()

export const removeWidget = makeTool({
  name: 'remove_widget',
  description:
    'Deletes a widget and its data. Any minted tool owned by a form is removed from the registry and persistence. Charts that source the widget remain and show an empty state. Use this only when the whole widget should go; use delete_rows to keep its schema. Undo restores the widget, rows, and minted tools.',
  input: RemoveWidgetInput,
  handler: (input) => {
    const state = useBoardStore.getState()
    const widget = state.document.widgets.find(
      (candidate) => candidate.id === input.widgetId,
    )
    if (!widget) {
      return err('WIDGET_NOT_FOUND', `No widget has id "${input.widgetId}".`)
    }

    const unregisteredTools = state.document.mintedTools
      .filter((tool) => tool.widgetId === input.widgetId)
      .map((tool) => tool.toolName)

    mutate(
      {
        actor: 'agent',
        action: 'remove_widget',
        summary: `Removed “${widget.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        draft.widgets = draft.widgets.filter(
          (candidate) => candidate.id !== input.widgetId,
        )
        draft.mintedTools = draft.mintedTools.filter(
          (tool) => tool.widgetId !== input.widgetId,
        )
      },
    )

    return ok({
      removedWidgetId: input.widgetId,
      unregisteredTools,
    })
  },
})
