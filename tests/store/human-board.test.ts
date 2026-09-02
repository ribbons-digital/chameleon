import { beforeEach, describe, expect, it } from 'vitest'
import { CHECKLIST_FIELDS } from '../../src/model/fields'
import { LIMITS } from '../../src/model/limits'
import { useBoardStore } from '../../src/store/boardStore'
import {
  humanAddWidget,
  humanAddBlankRow,
  humanAddRow,
  humanRenameBoard,
  humanRenameWidget,
} from '../../src/store/human'
import { unfinishedWidgets } from '../../src/store/selectors'
import { emptyBoard, resetBoard } from '../helpers'

describe('humanAddWidget', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('adds a ready-to-use checklist as a human add_widget command', () => {
    const result = humanAddWidget('checklist')
    expect(result.ok).toBe(true)
    const { document, commands } = useBoardStore.getState()
    expect(document.widgets).toHaveLength(1)
    expect(document.widgets[0]).toMatchObject({
      type: 'checklist',
      title: 'New checklist',
      lastModifiedBy: 'human',
    })
    expect(document.widgets[0].dataset?.fields).toEqual(CHECKLIST_FIELDS)
    expect(commands.at(-1)).toMatchObject({
      actor: 'human',
      action: 'add_widget',
      summary: 'Added checklist “New checklist”',
    })
    expect(document.humanEditsSinceLastDescribe).toBe(1)
  })

  it('hands a field-less table to the agent as unfinished bind_data work', () => {
    humanAddWidget('table')
    const { document } = useBoardStore.getState()
    expect(unfinishedWidgets(document)).toEqual([
      expect.objectContaining({
        widgetId: document.widgets[0].id,
        type: 'table',
        action: 'bind_data',
      }),
    ])
  })

  it('stacks new widgets below existing ones', () => {
    humanAddWidget('note')
    humanAddWidget('note')
    const [first, second] = useBoardStore.getState().document.widgets
    expect(second.position.y).toBe(first.position.y + first.position.h)
  })

  it('refuses past the widget limit', () => {
    for (let index = 0; index < LIMITS.widgetsPerBoard; index += 1) {
      humanAddWidget('note')
    }
    const result = humanAddWidget('note')
    expect(result).toEqual({
      ok: false,
      message: `The board already has ${LIMITS.widgetsPerBoard} widgets.`,
    })
    expect(useBoardStore.getState().document.widgets).toHaveLength(
      LIMITS.widgetsPerBoard,
    )
  })
})

describe('human row limits', () => {
  it('applies the same hard row limit to hand edits as agent tools', () => {
    resetBoard(emptyBoard())
    const added = humanAddWidget('checklist')
    if (!added.ok) throw new Error(added.message)
    useBoardStore.getState().mutate(
      {
        actor: 'agent',
        action: 'seed_limit',
        summary: 'Filled the checklist',
      },
      (draft) => {
        const widget = draft.widgets[0]
        if (widget.type !== 'checklist') return
        widget.dataset.rows = Array.from(
          { length: LIMITS.rowsPerWidget },
          (_, index) => ({
            _id: `r_limit_${index}`,
            _createdAt: '2026-09-02T00:00:00.000Z',
            _updatedAt: '2026-09-02T00:00:00.000Z',
            _createdBy: 'agent' as const,
            text: `Item ${index}`,
          }),
        )
      },
    )
    const commandCount = useBoardStore.getState().commands.length
    expect(humanAddRow(added.widgetId, { text: 'Overflow' })).toEqual({
      ok: false,
      message: `This widget already has ${LIMITS.rowsPerWidget} rows.`,
    })
    expect(humanAddBlankRow(added.widgetId)).toEqual({
      ok: false,
      message: `This widget already has ${LIMITS.rowsPerWidget} rows.`,
    })
    expect(useBoardStore.getState().commands).toHaveLength(commandCount)
  })
})

describe('humanRenameBoard', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('renames the board and logs it for the agent', () => {
    expect(humanRenameBoard('  Wedding, June 2027 ')).toEqual({ ok: true })
    const { document, commands } = useBoardStore.getState()
    expect(document.title).toBe('Wedding, June 2027')
    expect(commands.at(-1)).toMatchObject({
      actor: 'human',
      action: 'rename_board',
      summary: 'Renamed board to “Wedding, June 2027”',
    })
  })

  it('rejects blank or oversized names without a command', () => {
    expect(humanRenameBoard('   ').ok).toBe(false)
    expect(humanRenameBoard('x'.repeat(61)).ok).toBe(false)
    expect(useBoardStore.getState().commands).toHaveLength(0)
  })

  it('does not log an unchanged name', () => {
    expect(humanRenameBoard('Untitled workspace')).toEqual({ ok: true })
    expect(useBoardStore.getState().commands).toHaveLength(0)
  })
})

describe('humanRenameWidget', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
    humanAddWidget('note')
  })

  it('lets the human correct a widget name for the agent', () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    expect(humanRenameWidget(widgetId, '  Project brief ')).toEqual({
      ok: true,
    })
    const { document, commands } = useBoardStore.getState()
    expect(document.widgets[0]).toMatchObject({
      title: 'Project brief',
      lastModifiedBy: 'human',
    })
    expect(commands.at(-1)).toMatchObject({
      actor: 'human',
      action: 'update_widget',
      summary: 'Renamed “New note” to “Project brief”',
    })
  })

  it('rejects blank or oversized widget names', () => {
    const widgetId = useBoardStore.getState().document.widgets[0].id
    const commandCount = useBoardStore.getState().commands.length
    expect(humanRenameWidget(widgetId, ' ').ok).toBe(false)
    expect(humanRenameWidget(widgetId, 'x'.repeat(81)).ok).toBe(false)
    expect(useBoardStore.getState().commands).toHaveLength(commandCount)
  })
})
