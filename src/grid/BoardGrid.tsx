import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { VStack } from '@astryxdesign/core/VStack'
import { useEffect, useState } from 'react'
import {
  GridLayout,
  useContainerWidth,
  type LayoutItem,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { SUGGESTED_PROMPTS } from '../app/suggestedPrompts'
import { LIMITS } from '../model/limits'
import { stackMobileLayout } from '../model/layout'
import { useBoardStore } from '../store/boardStore'
import { WidgetView } from '../widgets/registry'

export function BoardGrid() {
  const widgets = useBoardStore((state) => state.document.widgets)
  const mutate = useBoardStore((state) => state.mutate)
  const loadSample = useBoardStore((state) => state.loadSample)
  const { width, mounted, containerRef } = useContainerWidth({
    initialWidth: 1200,
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 1200 : window.innerWidth,
  )
  useEffect(() => {
    const update = () => setViewport(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const layoutWidth = Math.min(width, viewport)
  const stacked = layoutWidth < LIMITS.mobileStackBelowPx

  const savePosition = (item: LayoutItem | null, action: 'move' | 'resize') => {
    if (stacked) return
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

  const layout = stacked
    ? stackMobileLayout(widgets).map((item) => ({
        ...item,
        minW: 1,
        minH: LIMITS.minWidgetH,
        maxW: 1,
        maxH: LIMITS.maxWidgetH,
      }))
    : widgets.map((widget) => ({
        i: widget.id,
        ...widget.position,
        minW: LIMITS.minWidgetW,
        minH: LIMITS.minWidgetH,
        maxW: LIMITS.maxWidgetW,
        maxH: LIMITS.maxWidgetH,
      }))

  const copyPrompt = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
    } catch {
      setCopiedId(null)
    }
  }

  return (
    <section ref={containerRef} aria-label="Widget canvas" className="board-grid">
      {widgets.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="What are you working on?"
          description="This canvas has no widgets. Ask an agent in this tab, or copy a prompt to get started."
          actions={
            <VStack gap={2}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Button
                  key={prompt.id}
                  label={
                    copiedId === prompt.id ? 'Copied' : prompt.label
                  }
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void copyPrompt(prompt.id, prompt.text)
                  }}
                />
              ))}
              <Button
                label="Load a sample board"
                variant="ghost"
                size="sm"
                onClick={loadSample}
              />
            </VStack>
          }
        />
      ) : (
        mounted && (
          <GridLayout
            width={layoutWidth}
            layout={layout}
            gridConfig={{
              cols: stacked ? 1 : LIMITS.gridCols,
              rowHeight: LIMITS.rowHeightPx,
              margin: [16, 16],
            }}
            dragConfig={{
              handle: '.widget-drag-handle',
              cancel:
                '.react-resizable-handle, textarea, input, button, [role="checkbox"]',
              enabled: !stacked,
            }}
            resizeConfig={{
              enabled: !stacked,
              handles: ['se'],
            }}
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
        )
      )}
    </section>
  )
}
