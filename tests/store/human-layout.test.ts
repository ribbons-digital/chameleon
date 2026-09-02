import { describe, expect, it } from 'vitest'
import { createSampleDocument, useBoardStore } from '../../src/store/boardStore'
import { humanApplyLayout } from '../../src/store/human'
import { resetBoard } from '../helpers'

function positions() {
  return Object.fromEntries(
    useBoardStore
      .getState()
      .document.widgets.map((widget) => [widget.id, widget.position]),
  )
}

describe('humanApplyLayout', () => {
  it('writes every widget the grid moved in one command', () => {
    resetBoard(createSampleDocument())
    // The human drags the note onto the table; the grid pushes the table down.
    const changed = humanApplyLayout(
      [
        { widgetId: 'w_welcome', x: 5, y: 0, w: 5, h: 5 },
        { widgetId: 'w_first_steps', x: 5, y: 5, w: 7, h: 5 },
      ],
      'w_welcome',
      'move',
    )
    expect(changed).toBe(true)
    expect(positions()).toEqual({
      w_welcome: { x: 5, y: 0, w: 5, h: 5 },
      w_first_steps: { x: 5, y: 5, w: 7, h: 5 },
    })
    const { commands, document } = useBoardStore.getState()
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      actor: 'human',
      action: 'move_widget',
      summary: 'Moved “A canvas that listens”',
    })
    expect(
      document.widgets.every((widget) => widget.lastModifiedBy === 'human'),
    ).toBe(true)
  })

  it('undo restores the pushed neighbour as well', () => {
    resetBoard(createSampleDocument())
    humanApplyLayout(
      [
        { widgetId: 'w_welcome', x: 5, y: 0, w: 5, h: 5 },
        { widgetId: 'w_first_steps', x: 5, y: 5, w: 7, h: 5 },
      ],
      'w_welcome',
      'move',
    )
    useBoardStore.getState().undo()
    expect(positions()).toEqual({
      w_welcome: { x: 0, y: 0, w: 5, h: 5 },
      w_first_steps: { x: 5, y: 0, w: 7, h: 5 },
    })
  })

  it('records nothing when the layout is unchanged', () => {
    resetBoard(createSampleDocument())
    const changed = humanApplyLayout(
      [
        { widgetId: 'w_welcome', x: 0, y: 0, w: 5, h: 5 },
        { widgetId: 'w_first_steps', x: 5, y: 0, w: 7, h: 5 },
      ],
      'w_welcome',
      'resize',
    )
    expect(changed).toBe(false)
    expect(useBoardStore.getState().commands).toHaveLength(0)
  })
})
