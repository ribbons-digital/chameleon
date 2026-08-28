import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { Widget } from '../model/types'
import { widgetStyles } from './styles'

const copy: Record<
  'chart' | 'form',
  { title: string; description: string }
> = {
  chart: {
    title: 'Chart is on the board',
    description:
      'This chart will plot data once the chart renderer ships. Agents can still bind fields and add rows.',
  },
  form: {
    title: 'Form is on the board',
    description:
      'Submission fields will render here when form widgets land. Agents can still bind fields and add rows.',
  },
}

export function PlaceholderWidget({ widget }: { widget: Widget }) {
  if (widget.type !== 'chart' && widget.type !== 'form') return null
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
