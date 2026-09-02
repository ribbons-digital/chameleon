import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import { undoBoard } from '../../src/webmcp/tools/undo'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

describe('undo tool', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('reverts the latest mutation as the agent', async () => {
    await executeTool(addWidget, { type: 'note', title: 'One' })
    await executeTool(addWidget, { type: 'note', title: 'Two' })
    const result = await executeTool(undoBoard, {
      steps: 1,
      rationale: 'The human asked me to remove the second note.',
    })
    expect(result.ok).toBe(true)
    expect(useBoardStore.getState().document.widgets).toHaveLength(1)
    expect(useBoardStore.getState().document.widgets[0].title).toBe('One')
    expect(useBoardStore.getState().commands.at(-1)).toMatchObject({
      action: 'undo',
      actor: 'agent',
      rationale: 'The human asked me to remove the second note.',
    })
  })

  it('returns NOTHING_TO_UNDO on an empty log', async () => {
    const result = await executeTool(undoBoard, {})
    expect(result.ok).toBe(false)
    expect((result.error as { code: string }).code).toBe('NOTHING_TO_UNDO')
  })
})
