import { z } from 'zod'
import { applyLayout } from '../../model/layout'
import { LIMITS } from '../../model/limits'
import { useBoardStore } from '../../store/boardStore'
import { mutate } from '../../store/mutate'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'
import { MutationFields, Position, WidgetId } from '../schemas'

const LayoutItem = z
  .object({
    widgetId: WidgetId,
    x: Position.shape.x,
    y: Position.shape.y,
    w: Position.shape.w,
    h: Position.shape.h,
  })
  .strict()

export const SetLayoutInput = z
  .object({
    items: z
      .array(LayoutItem)
      .min(1)
      .max(LIMITS.widgetsPerBoard)
      .describe(
        'Widgets to move or resize. Unlisted widgets keep their position but may be pushed down.',
      ),
    ...MutationFields,
  })
  .strict()

export const SetThemeInput = z
  .object({
    boardTitle: z
      .string()
      .min(1)
      .max(60)
      .regex(/\S/, 'Board title must include a non-whitespace character.')
      .optional(),
    theme: z
      .enum([
        'neutral',
        'butter',
        'chocolate',
        'matcha',
        'stone',
        'gothic',
        'y2k',
      ])
      .optional()
      .describe('Astryx theme name. matcha suits a health log; neutral suits a job search.'),
    mode: z.enum(['light', 'dark']).optional(),
    density: z.enum(['comfortable', 'compact']).optional(),
    ...MutationFields,
  })
  .strict()

export const setLayout = makeTool({
  name: 'set_layout',
  description:
    'Repositions and resizes widgets in one atomic call on the 12-column grid. Pass every widget you want to move; unlisted widgets keep their position but may be pushed down so nothing overlaps. Prefer this over update_widget.position when several widgets move together. Call describe_current_state first so coordinates include any human dragging. Give a rationale shown in the activity log. Typical use: group related widgets, put the most actionable widget top-left, give charts at least w=6. Returns the final layout after collision-push.',
  input: SetLayoutInput,
  handler: (input) => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const item of input.items) {
      if (seen.has(item.widgetId)) duplicates.push(item.widgetId)
      seen.add(item.widgetId)
    }
    if (duplicates.length > 0) {
      return err(
        'DUPLICATE_ID',
        'The same widgetId appears more than once in items.',
        { widgetIds: [...new Set(duplicates)] },
      )
    }

    const state = useBoardStore.getState()
    const missing = input.items
      .map((item) => item.widgetId)
      .filter(
        (widgetId) =>
          !state.document.widgets.some((widget) => widget.id === widgetId),
      )
    if (missing.length > 0) {
      return err(
        'WIDGET_NOT_FOUND',
        'One or more widget ids are not on the board.',
        { widgetIds: missing },
      )
    }

    let layout: Array<{
      widgetId: string
      x: number
      y: number
      w: number
      h: number
    }> = []
    const timestamp = new Date().toISOString()
    mutate(
      {
        actor: 'agent',
        action: 'set_layout',
        summary: `Rearranged ${input.items.length} widget${input.items.length === 1 ? '' : 's'}`,
        rationale: input.rationale,
      },
      (draft) => {
        const resolved = applyLayout(draft.widgets, input.items)
        const byId = new Map(
          resolved.map((item) => [item.widgetId, item]),
        )
        for (const widget of draft.widgets) {
          const next = byId.get(widget.id)
          if (!next) continue
          if (
            widget.position.x === next.x &&
            widget.position.y === next.y &&
            widget.position.w === next.w &&
            widget.position.h === next.h
          ) {
            continue
          }
          widget.position = {
            x: next.x,
            y: next.y,
            w: next.w,
            h: next.h,
          }
          widget.updatedAt = timestamp
          widget.lastModifiedBy = 'agent'
        }
        layout = resolved
      },
    )

    return ok({ layout })
  },
})

export const setTheme = makeTool({
  name: 'set_theme',
  description:
    "Restyles the whole board. Set theme name neutral|butter|chocolate|matcha|stone|gothic|y2k, mode light|dark, density comfortable|compact, or board title. All arguments are optional; only passed values change. Use sparingly. Pick a theme that fits the user's stated goal, such as matcha for a health log or neutral for a job search, and stick with it. Returns the applied theme and title.",
  input: SetThemeInput,
  handler: (input) => {
    const current = useBoardStore.getState().document
    const theme = {
      name: input.theme ?? current.theme.name,
      mode: input.mode ?? current.theme.mode,
      density: input.density ?? current.theme.density,
    }
    const boardTitle = input.boardTitle?.trim() ?? current.title
    if (
      theme.name === current.theme.name &&
      theme.mode === current.theme.mode &&
      theme.density === current.theme.density &&
      boardTitle === current.title
    ) {
      return err('NO_CHANGES', 'No theme, mode, density, or title change was provided.')
    }

    const themeChanged =
      theme.name !== current.theme.name ||
      theme.mode !== current.theme.mode ||
      theme.density !== current.theme.density
    const summary = [
      themeChanged ? `Set theme to ${theme.name} ${theme.mode} ${theme.density}` : '',
      boardTitle !== current.title ? `Renamed board to “${boardTitle}”` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    mutate(
      {
        actor: 'agent',
        action: 'set_theme',
        summary,
        rationale: input.rationale,
      },
      (draft) => {
        draft.theme = theme
        draft.title = boardTitle
      },
    )

    return ok({ theme, boardTitle })
  },
})
