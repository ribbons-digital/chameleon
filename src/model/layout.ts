import { LIMITS } from './limits'
import type { GridPosition, Widget, WidgetType } from './types'

export const DEFAULT_WIDGET_SIZE: Record<WidgetType, { w: number; h: number }> = {
  table: { w: 6, h: 6 },
  kanban: { w: 8, h: 8 },
  checklist: { w: 4, h: 8 },
  chart: { w: 6, h: 6 },
  note: { w: 5, h: 5 },
  form: { w: 4, h: 8 },
}

export function clampPosition(position: GridPosition): GridPosition {
  const w = Math.min(
    LIMITS.maxWidgetW,
    Math.max(LIMITS.minWidgetW, position.w),
  )
  const h = Math.min(
    LIMITS.maxWidgetH,
    Math.max(LIMITS.minWidgetH, position.h),
  )
  const x = Math.min(LIMITS.gridCols - 1, Math.max(0, position.x))
  return { x, y: Math.max(0, position.y), w, h }
}

export function autoPlace(
  widgets: Widget[],
  type: WidgetType,
  requested?: GridPosition,
): GridPosition {
  if (requested) return clampPosition(requested)
  const size = DEFAULT_WIDGET_SIZE[type]
  const y = widgets.reduce(
    (max, widget) => Math.max(max, widget.position.y + widget.position.h),
    0,
  )
  return clampPosition({ x: 0, y, w: size.w, h: size.h })
}
