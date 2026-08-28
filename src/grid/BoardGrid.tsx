import {
  GridLayout,
  useContainerWidth,
  type LayoutItem,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { LIMITS } from '../model/limits'
import { useBoardStore } from '../store/boardStore'
import { WidgetView } from '../widgets/registry'

export function BoardGrid() {
  const widgets = useBoardStore((state) => state.document.widgets)
  const mutate = useBoardStore((state) => state.mutate)
  const { width, mounted, containerRef } = useContainerWidth({
    initialWidth: 1200,
  })

  const savePosition = (item: LayoutItem | null, action: 'move' | 'resize') => {
    if (!item) return
    const widget = widgets.find((candidate) => candidate.id === item.i)
    if (!widget) return
    const next = { x: item.x, y: item.y, w: item.w, h: item.h }
    if (
      widget.position.x === next.x &&
      widget.position.y === next.y &&
      widget.position.w === next.w &&
      widget.position.h === next.h
    ) {
      return
    }
    mutate(
      {
        actor: 'human',
        action: action === 'move' ? 'move_widget' : 'resize_widget',
        summary: `${action === 'move' ? 'Moved' : 'Resized'} “${widget.title}”`,
      },
      (draft) => {
        const target = draft.widgets.find((candidate) => candidate.id === item.i)
        if (!target) return
        target.position = next
        target.updatedAt = new Date().toISOString()
        target.lastModifiedBy = 'human'
      },
    )
  }

  const layout = widgets.map((widget) => ({
    i: widget.id,
    ...widget.position,
    minW: LIMITS.minWidgetW,
    minH: LIMITS.minWidgetH,
    maxW: LIMITS.maxWidgetW,
    maxH: LIMITS.maxWidgetH,
  }))

  return (
    <section ref={containerRef} aria-label="Widget canvas" className="board-grid">
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: LIMITS.gridCols,
            rowHeight: LIMITS.rowHeightPx,
            margin: [16, 16],
          }}
          dragConfig={{
            handle: '.widget-drag-handle',
            cancel: '.react-resizable-handle, textarea, input, button',
          }}
          resizeConfig={{ enabled: true, handles: ['se'] }}
          onDragStop={(_layout, _oldItem, newItem) =>
            savePosition(newItem, 'move')
          }
          onResizeStop={(_layout, _oldItem, newItem) =>
            savePosition(newItem, 'resize')
          }
        >
          {widgets.map((widget) => (
            <article key={widget.id}>
              <WidgetView widget={widget} />
            </article>
          ))}
        </GridLayout>
      )}
    </section>
  )
}
