import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { ReactNode } from 'react'
import type { Widget } from '../model/types'
import { useBoardStore } from '../store/boardStore'
import { humanDeleteWidget } from '../store/human'
import { widgetStyles } from './styles'

const typeColor: Record<
  Widget['type'],
  'default' | 'blue' | 'teal' | 'purple' | 'gray' | 'green'
> = {
  note: 'blue',
  table: 'teal',
  kanban: 'purple',
  checklist: 'green',
  chart: 'gray',
  form: 'default',
}

export function WidgetShell({
  widget,
  children,
}: {
  widget: Widget
  children: ReactNode
}) {
  const mintedTools = useBoardStore(
    (state) => state.document.mintedTools,
  ).filter((record) => record.widgetId === widget.id)
  return (
    <Card height="100%" padding={4} elevation="low" xstyle={widgetStyles.shell}>
      <VStack gap={3} height="100%">
        <header className="widget-drag-handle">
          <HStack hAlign="between" vAlign="center" gap={3}>
            <Heading level={2} maxLines={1}>
              {widget.title}
            </Heading>
            <HStack gap={1} vAlign="center">
              {widget.type === 'form' &&
                mintedTools.map((record) => (
                  <Token
                    key={record.toolName}
                    size="sm"
                    color="yellow"
                    label={`⚡ ${record.toolName}`}
                  />
                ))}
              <Token
                size="sm"
                color={typeColor[widget.type]}
                label={widget.type}
              />
              <IconButton
                label={`Delete ${widget.title}`}
                tooltip="Delete widget"
                size="sm"
                variant="ghost"
                icon={<Text>×</Text>}
                onClick={(event) => {
                  event.stopPropagation()
                  humanDeleteWidget(widget.id)
                }}
              />
            </HStack>
          </HStack>
        </header>
        <VStack gap={2} height="100%" xstyle={widgetStyles.body}>
          {children}
        </VStack>
      </VStack>
    </Card>
  )
}
