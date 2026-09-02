import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { useToast } from '@astryxdesign/core/Toast'
import { Text } from '@astryxdesign/core/Text'
import { LIMITS } from '../model/limits'
import { useBoardStore } from '../store/boardStore'
import { humanAddWidget, type HumanWidgetType } from '../store/human'

const OPTIONS: Array<{
  type: HumanWidgetType
  label: string
  description: string
}> = [
  {
    type: 'note',
    label: 'Note',
    description: 'Markdown you and the agent can both edit.',
  },
  {
    type: 'checklist',
    label: 'Checklist',
    description: 'Items with due dates; ready to use.',
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Ask the agent to bind columns, then fill it in.',
  },
]

export function AddWidgetMenu() {
  const widgetCount = useBoardStore((state) => state.document.widgets.length)
  const showToast = useToast()
  const full = widgetCount >= LIMITS.widgetsPerBoard

  const add = (type: HumanWidgetType) => {
    const result = humanAddWidget(type)
    if (!result.ok) {
      showToast({
        type: 'error',
        body: <Text>{result.message}</Text>,
        uniqueID: 'add-widget-error',
        isAutoHide: true,
      })
    }
  }

  return (
    <DropdownMenu
      button={{ label: 'Add widget', variant: 'secondary', isDisabled: full }}
      menuWidth="max-content"
      items={OPTIONS.map((option) => ({
        id: option.type,
        label: option.label,
        description: option.description,
        onClick: () => add(option.type),
      }))}
    />
  )
}
