import { Badge } from '@astryxdesign/core/Badge'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import {
  GridLayout,
  useContainerWidth,
  type LayoutItem,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useBoardStore } from '../store/boardStore'

function WidgetPreview({
  title,
  type,
  content,
}: {
  title: string
  type: 'note' | 'table'
  content: string
}) {
  return (
    <Card height="100%" padding={4} elevation="low">
      <VStack gap={3} height="100%">
        <HStack hAlign="between" vAlign="center">
          <Heading level={2} maxLines={1}>
            {title}
          </Heading>
          <Badge variant="neutral" label={type} />
        </HStack>
        <Text as="p" color="secondary">
          {content}
        </Text>
        <Text type="supporting" color="secondary">
          Drag this card by its header · Resize from the corner
        </Text>
      </VStack>
    </Card>
  )
}

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
    minW: 3,
    minH: 3,
  }))

  return (
    <section ref={containerRef} aria-label="Widget canvas" className="board-grid">
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 12, rowHeight: 44, margin: [16, 16] }}
          dragConfig={{ handle: '.widget-drag-handle' }}
          onDragStop={(_layout, _oldItem, newItem) =>
            savePosition(newItem, 'move')
          }
          onResizeStop={(_layout, _oldItem, newItem) =>
            savePosition(newItem, 'resize')
          }
        >
          {widgets.map((widget) => (
            <article key={widget.id} className="widget-drag-handle">
              <WidgetPreview
                title={widget.title}
                type={widget.type}
                content={widget.content}
              />
            </article>
          ))}
        </GridLayout>
      )}
    </section>
  )
}
