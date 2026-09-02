import { beforeEach, describe, expect, it } from 'vitest'
import {
  createSampleDocument,
  useBoardStore,
} from '../../src/store/boardStore'

describe('board command log', () => {
  beforeEach(() => {
    localStorage.clear()
    useBoardStore.setState({
      document: createSampleDocument(),
      commands: [],
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

  it('does not rewind stateVersion to 0 on reset', () => {
    useBoardStore.getState().mutate(
      {
        actor: 'human',
        action: 'move_widget',
        summary: 'Moved a widget',
      },
      (draft) => {
        draft.widgets[0].position.x = 4
      },
    )
    expect(useBoardStore.getState().document.stateVersion).toBe(1)
    useBoardStore.getState().reset()
    expect(useBoardStore.getState().document.stateVersion).toBe(1)
    expect(useBoardStore.getState().document.widgets).toHaveLength(0)
    expect(useBoardStore.getState().commands).toHaveLength(0)
  })

  it('records undo as the given actor', () => {
    useBoardStore.getState().mutate(
      {
        actor: 'agent',
        action: 'update_widget',
        summary: 'Renamed',
      },
      (draft) => {
        draft.widgets[0].title = 'Renamed'
      },
    )
    useBoardStore.getState().undo('agent')
    expect(useBoardStore.getState().commands.at(-1)).toMatchObject({
      action: 'undo',
      actor: 'agent',
    })
  })

  it('counts a human undo as a human edit the agent has not seen', () => {
    useBoardStore.getState().mutate(
      {
        actor: 'agent',
        action: 'update_widget',
        summary: 'Renamed',
      },
      (draft) => {
        draft.widgets[0].title = 'Renamed'
      },
    )
    expect(useBoardStore.getState().document.humanEditsSinceLastDescribe).toBe(0)
    useBoardStore.getState().undo('human')
    expect(useBoardStore.getState().document.humanEditsSinceLastDescribe).toBe(1)
    useBoardStore.getState().undo('agent')
    expect(useBoardStore.getState().document.humanEditsSinceLastDescribe).toBe(1)
  })
})
