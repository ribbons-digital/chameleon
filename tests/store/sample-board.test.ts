import { beforeEach, describe, expect, it } from 'vitest'
import { initialDocument, useBoardStore } from '../../src/store/boardStore'

describe('empty first load and sample board', () => {
  beforeEach(() => {
    localStorage.clear()
    useBoardStore.setState({
      document: structuredClone(initialDocument),
      commands: [],
      hydrated: true,
    })
  })

  it('starts with no widgets', () => {
    expect(useBoardStore.getState().document.widgets).toHaveLength(0)
  })

  it('loadSample places the note and table', () => {
    useBoardStore.getState().loadSample()
    const titles = useBoardStore
      .getState()
      .document.widgets.map((widget) => widget.title)
    expect(titles).toEqual(['A canvas that listens', 'What happens next'])
    expect(useBoardStore.getState().commands[0]).toMatchObject({
      action: 'load_sample',
      actor: 'human',
    })
  })

  it('reset returns to an empty canvas', () => {
    useBoardStore.getState().loadSample()
    useBoardStore.getState().reset()
    expect(useBoardStore.getState().document.widgets).toHaveLength(0)
    expect(useBoardStore.getState().commands).toHaveLength(0)
  })
})
