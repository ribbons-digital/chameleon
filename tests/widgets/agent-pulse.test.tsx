import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentPulse } from '../../src/components/AgentPulse'
import { useBoardStore } from '../../src/store/boardStore'
import { emptyBoard, resetBoard } from '../helpers'

const { showToast } = vi.hoisted(() => ({
  showToast: vi.fn(),
}))

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => showToast,
}))

let root: Root | undefined

function renderPulse() {
  const host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(<AgentPulse />))
}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  showToast.mockReset()
})

describe('AgentPulse', () => {
  it('announces the first live agent mutation on an empty board', () => {
    resetBoard(emptyBoard())
    renderPulse()
    act(() => {
      useBoardStore.getState().mutate(
        {
          actor: 'agent',
          action: 'add_widget',
          summary: 'Added note “Shared brief”',
        },
        (draft) => {
          draft.title = 'Agent started'
        },
      )
    })
    expect(showToast).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        uniqueID: 'agent-1',
      }),
    )
  })

  it('does not replay persisted agent history on mount', () => {
    resetBoard(emptyBoard())
    useBoardStore.getState().mutate(
      {
        actor: 'agent',
        action: 'set_theme',
        summary: 'Renamed board',
      },
      (draft) => {
        draft.title = 'Persisted title'
      },
    )
    renderPulse()
    expect(showToast).not.toHaveBeenCalled()
  })
})
