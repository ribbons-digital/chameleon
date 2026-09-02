import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import { appendRows, submitFormValues } from '../../src/store/submit'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { collectFormSubmission } from '../../src/widgets/formValues'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

const logFields = [
  {
    key: 'reading',
    label: 'Blood sugar',
    type: 'number',
    required: true,
  },
  {
    key: 'context',
    label: 'When taken',
    type: 'select',
    options: ['fasting', 'after meal'],
  },
] as const

describe('form submissions onto a companion table', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('copies a form row onto a table with the same title', async () => {
    await executeTool(addWidget, {
      type: 'form',
      title: 'Blood sugar log',
      fields: [...logFields],
    })
    await executeTool(addWidget, {
      type: 'table',
      title: 'Blood sugar log',
      fields: [...logFields],
    })
    const formId = useBoardStore.getState().document.widgets[0].id
    const tableId = useBoardStore.getState().document.widgets[1].id

    const result = submitFormValues(formId, {
      reading: 104,
      context: 'after meal',
    })
    expect(result.ok).toBe(true)

    const widgets = useBoardStore.getState().document.widgets
    const form = widgets.find((widget) => widget.id === formId)
    const table = widgets.find((widget) => widget.id === tableId)
    expect(form?.dataset?.rows).toHaveLength(1)
    expect(table?.dataset?.rows).toHaveLength(1)
    expect(table?.dataset?.rows[0].reading).toBe(104)
    expect(table?.dataset?.rows[0].context).toBe('after meal')
  })

  it('copies Log New Reading onto Blood Sugar Log when fields match', async () => {
    const readingFields = [
      { key: 'date', label: 'Date', type: 'date', required: true },
      {
        key: 'timing',
        label: 'Timing',
        type: 'select',
        required: true,
        options: ['Fasting', 'Post-Lunch', 'Bedtime'],
      },
      { key: 'glucose', label: 'Glucose (mg/dL)', type: 'number', required: true },
    ]
    await executeTool(addWidget, {
      type: 'table',
      title: 'Blood Sugar Log',
      fields: readingFields,
    })
    await executeTool(addWidget, {
      type: 'form',
      title: 'Log New Reading',
      fields: readingFields,
    })
    const tableId = useBoardStore.getState().document.widgets[0].id
    const formId = useBoardStore.getState().document.widgets[1].id
    const result = submitFormValues(formId, {
      date: '2026-08-29',
      timing: 'Fasting',
      glucose: 104,
    })
    expect(result.ok).toBe(true)
    const table = useBoardStore
      .getState()
      .document.widgets.find((widget) => widget.id === tableId)
    expect(table?.dataset?.rows).toHaveLength(1)
    expect(table?.dataset?.rows[0]).toMatchObject({
      date: '2026-08-29',
      timing: 'Fasting',
      glucose: 104,
    })
  })

  it('copies add_rows on the table back onto the companion form', async () => {
    await executeTool(addWidget, {
      type: 'form',
      title: 'Log New Reading',
      fields: [...logFields],
    })
    await executeTool(addWidget, {
      type: 'table',
      title: 'Blood Sugar Log',
      fields: [...logFields],
    })
    const tableId = useBoardStore.getState().document.widgets[1].id
    const added = appendRows(
      tableId,
      [{ reading: 96, context: 'fasting' }],
      'agent',
      'Added a row',
    )
    expect(added.ok).toBe(true)
    const form = useBoardStore.getState().document.widgets[0]
    expect(form.dataset?.rows).toHaveLength(1)
    expect(form.dataset?.rows[0].reading).toBe(96)
  })

  it('does not copy onto a table with unrelated fields', async () => {
    await executeTool(addWidget, {
      type: 'form',
      title: 'Log New Reading',
      fields: [...logFields],
    })
    await executeTool(addWidget, {
      type: 'table',
      title: 'Medications',
      fields: [
        { key: 'drug', label: 'Drug', type: 'text', required: true },
        { key: 'dose', label: 'Dose', type: 'text' },
      ],
    })
    const formId = useBoardStore.getState().document.widgets[0].id
    submitFormValues(formId, { reading: 110, context: 'fasting' })
    expect(
      useBoardStore.getState().document.widgets[1].dataset?.rows,
    ).toHaveLength(0)
  })

  it('does not mirror rows between two same-title tables', async () => {
    await executeTool(addWidget, {
      type: 'table',
      title: 'Blood Sugar Log',
      fields: [...logFields],
    })
    await executeTool(addWidget, {
      type: 'table',
      title: 'Blood Sugar Log',
      fields: [...logFields],
    })
    const [first, second] = useBoardStore.getState().document.widgets
    appendRows(
      first.id,
      [{ reading: 110, context: 'fasting' }],
      'agent',
      'Added a row',
    )
    const widgets = useBoardStore.getState().document.widgets
    expect(widgets.find((widget) => widget.id === first.id)?.dataset?.rows).toHaveLength(1)
    expect(widgets.find((widget) => widget.id === second.id)?.dataset?.rows).toHaveLength(0)
  })
})

describe('collectFormSubmission', () => {
  it('prefers live form fields so a pending number input still submits', () => {
    const fields = [
      {
        key: 'reading',
        label: 'Blood sugar',
        type: 'number' as const,
        required: true,
      },
    ]
    const form = document.createElement('form')
    const input = document.createElement('input')
    input.name = 'reading'
    input.value = '104'
    form.append(input)
    expect(collectFormSubmission(fields, {}, form)).toEqual({
      reading: '104',
    })
  })
})
