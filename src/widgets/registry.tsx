import { Text } from '@astryxdesign/core/Text'
import { lazy, Suspense } from 'react'
import type { Widget } from '../model/types'
import { ChecklistWidgetView } from './ChecklistWidget'
import { FormWidgetView } from './FormWidget'
import { KanbanWidgetView } from './KanbanWidget'
import { NoteWidget } from './NoteWidget'
import { TableWidgetView } from './TableWidget'
import { WidgetShell } from './WidgetShell'

const ChartWidgetView = lazy(() =>
  import('./ChartWidget').then((module) => ({
    default: module.ChartWidgetView,
  })),
)

export function WidgetView({ widget }: { widget: Widget }) {
  return (
    <WidgetShell widget={widget}>
      {widget.type === 'note' ? (
        <NoteWidget widget={widget} />
      ) : widget.type === 'table' ? (
        <TableWidgetView widget={widget} />
      ) : widget.type === 'checklist' ? (
        <ChecklistWidgetView widget={widget} />
      ) : widget.type === 'kanban' ? (
        <KanbanWidgetView widget={widget} />
      ) : widget.type === 'form' ? (
        <FormWidgetView
          key={JSON.stringify(widget.dataset.fields)}
          widget={widget}
        />
      ) : (
        <Suspense fallback={<Text color="secondary">Loading chart</Text>}>
          <ChartWidgetView widget={widget} />
        </Suspense>
      )}
    </WidgetShell>
  )
}
