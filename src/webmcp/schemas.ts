import { z } from 'zod'
import { WIDGET_ID_PATTERN } from '../model/ids'
import { LIMITS } from '../model/limits'

export const WidgetId = z
  .string()
  .regex(WIDGET_ID_PATTERN)
  .describe(
    'A widget id as returned by add_widget or describe_current_state, e.g. "w_x8Kd2q".',
  )

export const Rationale = z
  .string()
  .max(300)
  .optional()
  .describe(
    'One sentence explaining why you are making this change. Shown to the human in the activity log.',
  )

export const Position = z
  .object({
    x: z.number().int().min(0).max(LIMITS.gridCols - 1),
    y: z.number().int().min(0),
    w: z.number().int().min(LIMITS.minWidgetW).max(LIMITS.maxWidgetW),
    h: z.number().int().min(LIMITS.minWidgetH).max(LIMITS.maxWidgetH),
  })
  .describe(
    'Grid placement on a 12-column grid. One row unit is ~40px. Omit to auto-place below existing widgets.',
  )

export const WidgetTypeEnum = z.enum([
  'table',
  'kanban',
  'checklist',
  'chart',
  'note',
  'form',
])
