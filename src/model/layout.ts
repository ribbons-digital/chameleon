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
  const x = Math.min(LIMITS.gridCols - w, Math.max(0, position.x))
  return { x, y: Math.max(0, position.y), w, h }
}

export type LayoutUpdate = GridPosition & { widgetId: string }

function overlaps(left: GridPosition, right: GridPosition): boolean {
  return (
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y
  )
}

export function applyLayout(
  widgets: Widget[],
  items: LayoutUpdate[],
): Array<GridPosition & { widgetId: string }> {
  const requested = new Map(
    items.map(({ widgetId, x, y, w, h }) => [
      widgetId,
      clampPosition({ x, y, w, h }),
    ]),
  )
  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]))
  const ordered = [
    ...items
      .map((item) => widgetById.get(item.widgetId))
      .filter((widget): widget is Widget => Boolean(widget)),
    ...widgets.filter((widget) => !requested.has(widget.id)),
  ]
  const resolved = new Map<string, GridPosition>()

  for (const widget of ordered) {
    let position = requested.get(widget.id) ?? clampPosition(widget.position)
    let collisions = [...resolved.values()].filter((placed) =>
      overlaps(position, placed),
    )
    while (collisions.length > 0) {
      position = {
        ...position,
        y: Math.max(...collisions.map((placed) => placed.y + placed.h)),
      }
      collisions = [...resolved.values()].filter((placed) =>
        overlaps(position, placed),
      )
    }
    resolved.set(widget.id, position)
  }

  return widgets.map((widget) => ({
    widgetId: widget.id,
    ...(resolved.get(widget.id) ?? widget.position),
  }))
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
