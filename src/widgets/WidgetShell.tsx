import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { ReactNode } from 'react'
import type { Widget } from '../model/types'
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
  return (
    <Card height="100%" padding={4} elevation="low" xstyle={widgetStyles.shell}>
      <VStack gap={3} height="100%">
        <header className="widget-drag-handle">
          <HStack hAlign="between" vAlign="center" gap={3}>
            <Heading level={2} maxLines={1}>
              {widget.title}
            </Heading>
            <Token
              size="sm"
              color={typeColor[widget.type]}
              label={widget.type}
            />
          </HStack>
        </header>
        <VStack gap={2} height="100%" xstyle={widgetStyles.body}>
          {children}
        </VStack>
      </VStack>
    </Card>
  )
}
