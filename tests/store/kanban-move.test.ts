import { describe, expect, it } from 'vitest'
import { emptyBoard, executeTool, resetBoard } from '../helpers'
import { addRows } from '../../src/webmcp/tools/data'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { humanMoveKanbanCard } from '../../src/store/human'
import { useBoardStore } from '../../src/store/boardStore'
import type { KanbanWidget } from '../../src/model/types'
import { columnValueOf } from '../../src/model/kanbanOrder'

describe('humanMoveKanbanCard', () => {
  it('reorders two cards in the same column', async () => {
    resetBoard(emptyBoard())
    const added = await executeTool(addWidget, {
      type: 'kanban',
      title: 'Vendors',
      fields: [
        { key: 'title', label: 'Vendor', type: 'text', required: true },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: ['contacted', 'booked'],
        },
      ],
    })
    await executeTool(addRows, {
      widgetId: added.widgetId,
      rows: [
        { title: 'Florist', status: 'contacted' },
        { title: 'DJ', status: 'contacted' },
      ],
    })
    const widget = useBoardStore
      .getState()
      .document.widgets.find((candidate) => candidate.id === added.widgetId) as KanbanWidget
    const group = widget.dataset.fields.find((field) => field.key === 'status')!
    const dj = widget.dataset.rows.find((row) => row.title === 'DJ')!
    const result = humanMoveKanbanCard(
      widget.id,
      dj._id,
      group,
      'contacted',
      0,
      'Reordered “DJ” in contacted',
    )
    expect(result).toEqual({ ok: true, changed: true })
    const ordered = useBoardStore
      .getState()
      .document.widgets.find((candidate) => candidate.id === widget.id)
      ?.dataset?.rows.filter((row) => columnValueOf(row, 'status') === 'contacted')
      .map((row) => row.title)
    expect(ordered).toEqual(['DJ', 'Florist'])
  })
})
