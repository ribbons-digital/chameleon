import { beforeEach, describe, expect, it } from 'vitest'
import { CHECKLIST_FIELDS } from '../../src/model/fields'
import { LIMITS } from '../../src/model/limits'
import { useBoardStore } from '../../src/store/boardStore'
import { humanAddWidget, humanRenameBoard } from '../../src/store/human'
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
