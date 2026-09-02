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
import { humanApplyLayout } from '../store/human'
import { WidgetView } from '../widgets/registry'

export function BoardGrid() {
  const widgets = useBoardStore((state) => state.document.widgets)
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

  const saveLayout = (
    nextLayout: readonly LayoutItem[],
    item: LayoutItem | null,
    action: 'move' | 'resize',
  ) => {
    if (stacked || !item) return
    humanApplyLayout(
      nextLayout.map(({ i, x, y, w, h }) => ({ widgetId: i, x, y, w, h })),
      item.i,
      action,
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
          description="This canvas has no widgets. Ask an agent in this tab, copy a prompt to get started, or use Add widget to start by hand."
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
                '.react-resizable-handle, textarea, input, button, [role="checkbox"], .kanban-card',
              enabled: !stacked,
            }}
            resizeConfig={{
              enabled: !stacked,
              handles: ['se'],
            }}
            onDragStop={(nextLayout, _oldItem, newItem) =>
              saveLayout(nextLayout, newItem, 'move')
            }
            onResizeStop={(nextLayout, _oldItem, newItem) =>
              saveLayout(nextLayout, newItem, 'resize')
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
