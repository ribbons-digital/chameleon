import { z } from 'zod'
import { fieldSchema } from '../../model/fields'
import { createWidgetId } from '../../model/ids'
import { autoPlace } from '../../model/layout'
import { LIMITS } from '../../model/limits'
import type { Field, Widget } from '../../model/types'
import {
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
        "Type-specific config. If omitted, sensible defaults are used. See each type's schema.",
      ),
    fields: z
      .array(fieldSchema)
      .max(LIMITS.fieldsPerDataset)
      .optional()
      .describe(
        'Optional shortcut: define the data schema at creation time instead of calling bind_data.',
      ),
    position: Position.optional(),
    rationale: Rationale,
  })
  .strict()

function summaryForAdd(type: string, title: string): string {
  return `Added ${type} “${title}”`
}

export const addWidget = makeTool({
  name: 'add_widget',
  description:
    'Creates one widget on the board and returns its id. type is one of: table (spreadsheet-like records), kanban (cards grouped by a select field), checklist (todo items with optional due dates), chart (line/bar/area/pie over a dataset), note (markdown text), form (input fields the human fills in — and the only widget that can mint a new tool via create_form_tool). For table, kanban, chart and form you should usually call bind_data next to define fields, unless you pass `fields` here. Omit position to auto-place. Prefer several small focused widgets over one giant one.',
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
        const widget: Widget = {
          id: widgetId,
          type: input.type,
          title: input.title,
          position,
          config: validated.config,
          dataset: defaultDataset(input.type, fields),
          createdAt: timestamp,
          updatedAt: timestamp,
          lastModifiedBy: 'agent',
        }
        draft.widgets.push(widget)
      },
    )

    return ok({ widgetId, position })
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
    "Updates a widget's title, config, and/or position. Only the keys you pass change; config is deep-merged per key (pass a key with null to clear it). Does not touch data rows — use the row tools for that — and does not change the field schema — use bind_data. If the widget is a form with a minted tool, changing config does not affect the minted tool.",
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
    'Deletes a widget and its data rows. If the widget is a form with a minted tool, that tool is unregistered immediately and will not come back on reload. If any chart uses this widget as its data source, the chart stays but shows an empty state until re-pointed. The human can undo this from the UI, and you can undo it with the undo tool.',
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
