import { z } from 'zod'
import { applyLayout } from '../../model/layout'
import { LIMITS } from '../../model/limits'
import { useBoardStore } from '../../store/boardStore'
import { mutate } from '../../store/mutate'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'
import { Position, Rationale, WidgetId } from '../schemas'

const ThemeName = z.enum([
  'neutral',
  'butter',
  'chocolate',
  'matcha',
  'stone',
  'gothic',
  'y2k',
])

const LayoutItem = z
  .object({
    widgetId: WidgetId,
    ...Position.shape,
  })
  .strict()

export const SetLayoutInput = z
  .object({
    items: z
      .array(LayoutItem)
      .min(1)
      .max(LIMITS.widgetsPerBoard),
    rationale: Rationale,
  })
  .strict()

export const SetThemeInput = z
  .object({
    boardTitle: z.string().min(1).max(60).optional(),
    theme: ThemeName.optional(),
    mode: z.enum(['light', 'dark']).optional(),
    density: z.enum(['comfortable', 'compact']).optional(),
    rationale: Rationale,
  })
  .strict()

export const setLayout = makeTool({
  name: 'set_layout',
  description:
    'Repositions and resizes multiple widgets atomically on the 12-column grid. Prefer this over update_widget.position for coordinated moves after describe_current_state. Pass 1–24 unique widget ids with x, y, w, and h. Unlisted widgets keep their positions unless pushed down to prevent a collision. The returned layout is the final non-overlapping truth. Include a rationale because the activity log shows it.',
  input: SetLayoutInput,
  handler: (input) => {
    const seen = new Set<string>()
    const duplicate = input.items.find((item) => {
      if (seen.has(item.widgetId)) return true
      seen.add(item.widgetId)
      return false
    })
    if (duplicate) {
      return err(
        'DUPLICATE_ID',
        `Widget "${duplicate.widgetId}" appears more than once in items.`,
      )
    }

    const state = useBoardStore.getState()
    const known = new Set(
      state.document.widgets.map((widget) => widget.id),
    )
    const missing = input.items
      .map((item) => item.widgetId)
      .filter((widgetId) => !known.has(widgetId))
    if (missing.length > 0) {
      return err(
        'WIDGET_NOT_FOUND',
        'One or more layout items reference a missing widget.',
        { widgetIds: missing },
      )
    }

    const widgets = applyLayout(state.document.widgets, input.items)
    const timestamp = new Date().toISOString()
    mutate(
      {
        actor: 'agent',
        action: 'set_layout',
        summary: `Reorganized ${input.items.length} widget${input.items.length === 1 ? '' : 's'}`,
        rationale: input.rationale,
      },
      (draft) => {
        const byId = new Map(
          widgets.map((widget) => [widget.id, widget.position]),
        )
        for (const widget of draft.widgets) {
          const position = byId.get(widget.id)
          if (!position) continue
          if (
            widget.position.x === position.x &&
            widget.position.y === position.y &&
            widget.position.w === position.w &&
            widget.position.h === position.h
          ) {
            continue
          }
          widget.position = position
          widget.updatedAt = timestamp
          widget.lastModifiedBy = 'agent'
        }
      },
    )

    return ok({
      layout: useBoardStore
        .getState()
        .document.widgets.map((widget) => ({
          widgetId: widget.id,
          ...widget.position,
        })),
    })
  },
})

export const setTheme = makeTool({
  name: 'set_theme',
  description:
    "Restyles the board and can rename it. Set any combination of boardTitle, theme neutral|butter|chocolate|matcha|stone|gothic|y2k, mode light|dark, or density comfortable|compact. Use this for the whole board, not one widget, and pick a theme that fits the user's goal. Omitted values stay unchanged. Returns the complete theme and title. Repeating current values returns NO_CHANGES.",
  input: SetThemeInput,
  handler: (input) => {
    const current = useBoardStore.getState().document
    const changed =
      (input.boardTitle !== undefined &&
        input.boardTitle !== current.title) ||
      (input.theme !== undefined &&
        input.theme !== current.theme.name) ||
      (input.mode !== undefined && input.mode !== current.theme.mode) ||
      (input.density !== undefined &&
        input.density !== current.theme.density)
    if (!changed) {
      return err(
        'NO_CHANGES',
        'No board title or theme value would change.',
      )
    }

    mutate(
      {
        actor: 'agent',
        action: 'set_theme',
        summary: `Restyled “${input.boardTitle ?? current.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        if (input.boardTitle !== undefined) {
          draft.title = input.boardTitle
        }
        if (input.theme !== undefined) {
          draft.theme.name = input.theme
        }
        if (input.mode !== undefined) {
          draft.theme.mode = input.mode
        }
        if (input.density !== undefined) {
          draft.theme.density = input.density
        }
      },
    )

    const document = useBoardStore.getState().document
    return ok({
      theme: document.theme,
      boardTitle: document.title,
    })
  },
})
