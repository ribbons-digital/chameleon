import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import { submitFormValues } from '../../src/store/submit'
import { makeMintedTool } from '../../src/webmcp/minted'
import { createFormTool } from '../../src/webmcp/tools/mint'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

describe('form submission parity', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('stores the same field values for human and minted submissions', async () => {
    await executeTool(addWidget, {
      type: 'form',
      title: 'Applications',
      fields: [
        {
          key: 'company',
          label: 'Company',
          type: 'text',
          required: true,
        },
        { key: 'salary', label: 'Salary', type: 'number' },
        { key: 'remote', label: 'Remote', type: 'boolean' },
      ],
    })
    const widget = useBoardStore.getState().document.widgets[0]
    if (widget.type !== 'form') throw new Error('Fixture failed')
    await executeTool(createFormTool, {
      widgetId: widget.id,
      toolName: 'add_application',
      description:
        'Records one application with company, salary, and remote fields. Example: add Acme at 120000.',
    })
    const record = useBoardStore.getState().document.mintedTools[0]
    if (!record) throw new Error('Fixture failed')

    const input = { company: 'Acme', salary: 120_000, remote: true }
    const human = submitFormValues(widget.id, input, 'human')
    expect(human.ok).toBe(true)
    const minted = makeMintedTool(record, widget.dataset.fields)
    expect((await executeTool(minted, input)).ok).toBe(true)

    const rows = useBoardStore.getState().document.widgets[0].dataset?.rows
    expect(rows).toHaveLength(2)
    const values = rows?.map(({ company, salary, remote }) => ({
      company,
      salary,
      remote,
    }))
    expect(values?.[0]).toEqual(values?.[1])
  })
})
