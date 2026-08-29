import { beforeEach, describe, expect, it } from 'vitest'
import { LIMITS } from '../../src/model/limits'
import type { Row } from '../../src/model/types'
import { useBoardStore } from '../../src/store/boardStore'
import { addRows } from '../../src/webmcp/tools/data'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

describe('5k-row table scale', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('serializes LIMITS.rowsPerWidget rows and rejects the next add_rows', async () => {
    await executeTool(addWidget, {
      type: 'table',
      title: 'Scale',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
    })
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const now = '2026-01-01T00:00:00.000Z'
    const rows: Row[] = Array.from(
      { length: LIMITS.rowsPerWidget },
      (_, index) => ({
        _id: `r_${String(index).padStart(8, '0')}`,
        _createdAt: now,
        _updatedAt: now,
        _createdBy: 'agent',
        name: `Row ${index}`,
      }),
    )
    useBoardStore.getState().mutate(
      {
        actor: 'agent',
        action: 'add_rows',
        summary: 'Filled scale table to the row limit.',
      },
      (draft) => {
        const table = draft.widgets[0]
        if (table.type !== 'table') return
        table.dataset.rows = rows
      },
    )

    const started = performance.now()
    const json = JSON.stringify(useBoardStore.getState().document)
    const elapsedMs = performance.now() - started
    expect(useBoardStore.getState().document.widgets[0].dataset?.rows).toHaveLength(
      LIMITS.rowsPerWidget,
    )
    expect(json.length).toBeLessThan(2_000_000)
    expect(elapsedMs).toBeLessThan(500)

    const overflow = await executeTool(addRows, {
      widgetId,
      rows: [{ name: 'overflow' }],
    })
    expect(overflow.ok).toBe(false)
    expect((overflow.error as { code: string }).code).toBe('LIMIT_EXCEEDED')
  })
})
