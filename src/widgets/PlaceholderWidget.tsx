import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { Widget } from '../model/types'
import { widgetStyles } from './styles'

const copy: Record<
  Exclude<Widget['type'], 'note' | 'table'>,
  { title: string; description: string }
> = {
  kanban: {
    title: 'Kanban is on the board',
    description:
      'Cards and columns will render here once data is bound. The widget is already part of the six-type grammar.',
  },
  checklist: {
    title: 'Checklist is on the board',
    description:
      'Items will appear here in a later pass. The widget is stored and visible to agents now.',
  },
  chart: {
    title: 'Chart is on the board',
    description:
      'This chart will plot data once the chart renderer ships. Agents can still place and configure it.',
  },
  form: {
    title: 'Form is on the board',
    description:
      'Submission fields will render here when form widgets land. The widget already exists for tools.',
  },
}

export function PlaceholderWidget({ widget }: { widget: Widget }) {
  if (widget.type === 'note' || widget.type === 'table') return null
  const message = copy[widget.type]
  return (
    <VStack gap={2} xstyle={widgetStyles.placeholder}>
      <EmptyState
        isCompact
        headingLevel={3}
        title={message.title}
        description={message.description}
      />
      <Text type="supporting" color="secondary">
        Type: {widget.type}
      </Text>
    </VStack>
  )
}
