import { beforeEach, describe, expect, it } from 'vitest'
import { initialDocument, useBoardStore } from '../../src/store/boardStore'

describe('board command log', () => {
  beforeEach(() => {
    localStorage.clear()
    useBoardStore.setState({
      document: structuredClone(initialDocument),
      commands: [],
      hydrated: true,
    })
  })

  it('records a human mutation and increments stateVersion', () => {
    const version = useBoardStore.getState().mutate(
      {
        actor: 'human',
        action: 'move_widget',
        summary: 'Moved “A canvas that listens”',
      },
      (draft) => {
        draft.widgets[0].position.x = 4
      },
    )

    const state = useBoardStore.getState()
    expect(version).toBe(1)
    expect(state.document.stateVersion).toBe(1)
    expect(state.document.widgets[0].position.x).toBe(4)
    expect(state.commands[0]).toMatchObject({
      seq: 1,
      actor: 'human',
      action: 'move_widget',
      undone: false,
    })
  })

  it('restores document state with inverse patches', () => {
    const originalPosition = structuredClone(
      useBoardStore.getState().document.widgets[0].position,
    )
    useBoardStore.getState().mutate(
      {
        actor: 'agent',
        action: 'update_widget',
        summary: 'Repositioned the welcome note',
        rationale: 'Give the table more room.',
      },
      (draft) => {
        draft.widgets[0].position = { x: 7, y: 4, w: 5, h: 5 }
      },
    )

    const undone = useBoardStore.getState().undo()
    const state = useBoardStore.getState()

    expect(undone?.action).toBe('update_widget')
    expect(state.document.widgets[0].position).toEqual(originalPosition)
    expect(state.document.stateVersion).toBe(2)
    expect(state.commands[0].undone).toBe(true)
    expect(state.commands[1]).toMatchObject({
      seq: 2,
      action: 'undo',
      actor: 'human',
    })
  })

  it('does not create a command for a no-op recipe', () => {
    const version = useBoardStore.getState().mutate(
      {
        actor: 'human',
        action: 'move_widget',
        summary: 'No movement',
      },
      () => {},
    )

    expect(version).toBe(0)
    expect(useBoardStore.getState().commands).toHaveLength(0)
  })
})
