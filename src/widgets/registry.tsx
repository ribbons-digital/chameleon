import type { Widget } from '../model/types'
import { ChecklistWidgetView } from './ChecklistWidget'
import { KanbanWidgetView } from './KanbanWidget'
import { NoteWidget } from './NoteWidget'
import { PlaceholderWidget } from './PlaceholderWidget'
import { TableWidgetView } from './TableWidget'
import { WidgetShell } from './WidgetShell'

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
      ) : (
        <PlaceholderWidget widget={widget} />
      )}
    </WidgetShell>
  )
}
