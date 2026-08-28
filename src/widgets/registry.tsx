import type { Widget } from '../model/types'
import { NoteWidget } from './NoteWidget'
import { PlaceholderWidget } from './PlaceholderWidget'
import { TableWidget } from './TableWidget'
import { WidgetShell } from './WidgetShell'

export function WidgetView({ widget }: { widget: Widget }) {
  return (
    <WidgetShell widget={widget}>
      {widget.type === 'note' ? (
        <NoteWidget widget={widget} />
      ) : widget.type === 'table' ? (
        <TableWidget widget={widget} />
      ) : (
        <PlaceholderWidget widget={widget} />
      )}
    </WidgetShell>
  )
}
