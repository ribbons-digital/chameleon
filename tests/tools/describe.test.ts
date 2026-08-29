import { beforeEach, describe, expect, it } from 'vitest'
import { initialDocument } from '../../src/store/boardStore'
import { useBoardStore } from '../../src/store/boardStore'
import {
  describeCurrentState,
  getActivityLog,
} from '../../src/webmcp/tools/describe'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { executeTool, emptyBoard, resetBoard } from '../helpers'

describe('describe_current_state', () => {
  beforeEach(() => {
    resetBoard()
  })

  it('returns the canonical snapshot for the Day 1 board', async () => {
    const result = await executeTool(describeCurrentState, {})
    expect(result.ok).toBe(true)
    expect(result.stateVersion).toBe(0)
    expect(result.board).toEqual({
      title: 'Untitled workspace',
      theme: { name: 'neutral', mode: 'light', density: 'comfortable' },
      grid: { cols: 12, rowHeightPx: 40 },
      widgetCount: 2,
    })
    expect(result.widgets).toHaveLength(2)
    const note = (result.widgets as Array<Record<string, unknown>>)[0]
    const table = (result.widgets as Array<Record<string, unknown>>)[1]
    expect(note).toMatchObject({
      id: 'w_welcome',
      type: 'note',
      title: 'A canvas that listens',
      fields: null,
      rowCount: 0,
      sampleRows: [],
      mintedTools: [],
    })
    expect(table).toMatchObject({
      id: 'w_first_steps',
      type: 'table',
      title: 'What happens next',
      rowCount: 3,
      mintedTools: [],
    })
    expect(table.fields).toEqual([
      { key: 'step', label: 'Step', type: 'text', required: true },
    ])
    expect((table.sampleRows as unknown[]).length).toBe(3)
    expect(result.unfinished).toEqual([])
    expect(result.mintedTools).toEqual([])
    expect(result.recentActivity).toEqual([])
    expect(result.humanEditsSinceLastDescribe).toBe(0)
  })

  it('omits sample rows when include_sample_rows is false', async () => {
    const result = await executeTool(describeCurrentState, {
      include_sample_rows: false,
    })
    expect(result.ok).toBe(true)
    for (const widget of result.widgets as Array<Record<string, unknown>>) {
      expect(widget).not.toHaveProperty('sampleRows')
    }
  })

  it('reports human edits since the last describe, then resets the counter', async () => {
    useBoardStore.getState().mutate(
      {
        actor: 'human',
        action: 'move_widget',
        summary: 'Moved a widget',
      },
      (draft) => {
        draft.widgets[0].position.x = 1
      },
    )
    const first = await executeTool(describeCurrentState, {})
    expect(first.humanEditsSinceLastDescribe).toBe(1)
    const second = await executeTool(describeCurrentState, {})
    expect(second.humanEditsSinceLastDescribe).toBe(0)
  })

  it('rejects invalid input', async () => {
    const result = await executeTool(describeCurrentState, {
      include_sample_rows: 'nope',
    })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('INVALID_INPUT')
  })

  it('lists empty tables and checklists as unfinished', async () => {
    resetBoard(emptyBoard())
    await executeTool(addWidget, {
      type: 'table',
      title: 'People and conversations',
      fields: [{ key: 'name', label: 'Name', type: 'text' }],
    })
    await executeTool(addWidget, { type: 'checklist', title: 'This week' })
    const result = await executeTool(describeCurrentState, {})
    expect(result.ok).toBe(true)
    expect(result.unfinished).toEqual([
      expect.objectContaining({
        title: 'People and conversations',
        type: 'table',
        action: 'add_rows',
      }),
      expect.objectContaining({
        title: 'This week',
        type: 'checklist',
        action: 'add_rows',
      }),
    ])
  })

  it('lists a bound form without a minted tool as unfinished', async () => {
    resetBoard(emptyBoard())
    await executeTool(addWidget, {
      type: 'form',
      title: 'Blood sugar log',
      fields: [
        { key: 'reading', label: 'Reading', type: 'number', required: true },
      ],
    })
    const result = await executeTool(describeCurrentState, {})
    expect(result.ok).toBe(true)
    expect(result.unfinished).toEqual([
      expect.objectContaining({
        title: 'Blood sugar log',
        type: 'form',
        action: 'create_form_tool',
      }),
    ])
  })

  it('matches a stable snapshot of the default board', async () => {
    const result = await executeTool(describeCurrentState, {})
    expect(result).toMatchSnapshot()
  })
})

describe('get_activity_log', () => {
  beforeEach(() => {
    resetBoard(initialDocument)
  })

  it('returns newest-first entries including undone', async () => {
    const add = await executeTool(addWidget, {
      type: 'note',
      title: 'Agenda',
      rationale: 'Dinner notes.',
    })
    expect(add.ok).toBe(true)
    useBoardStore.getState().undo()

    const result = await executeTool(getActivityLog, { limit: 10 })
    expect(result.ok).toBe(true)
    const entries = result.entries as Array<Record<string, unknown>>
    expect(entries[0]).toMatchObject({ action: 'undo', actor: 'human' })
    expect(entries[1]).toMatchObject({
      action: 'add_widget',
      actor: 'agent',
      rationale: 'Dinner notes.',
      undone: true,
    })
  })

  it('filters by actor and since_seq', async () => {
    await executeTool(addWidget, { type: 'note', title: 'A' })
    useBoardStore.getState().mutate(
      {
        actor: 'human',
        action: 'move_widget',
        summary: 'Moved A',
      },
      (draft) => {
        draft.widgets.at(-1)!.position.x = 3
      },
    )
    const humanOnly = await executeTool(getActivityLog, { actor: 'human' })
    expect(
      (humanOnly.entries as Array<{ actor: string }>).every(
        (entry) => entry.actor === 'human',
      ),
    ).toBe(true)

    const since = await executeTool(getActivityLog, { since_seq: 1 })
    expect(
      (since.entries as Array<{ seq: number }>).every((entry) => entry.seq > 1),
    ).toBe(true)
  })

  it('rejects invalid filters', async () => {
    const result = await executeTool(getActivityLog, { limit: 0 })
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('INVALID_INPUT')
  })
})
