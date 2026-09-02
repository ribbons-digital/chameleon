import { z } from 'zod'
import { useBoardStore } from '../../store/boardStore'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'
import { MutationFields } from '../schemas'

export const UndoInput = z
  .object({
    steps: z.number().int().min(1).max(10).default(1),
    ...MutationFields,
  })
  .strict()

export const undoBoard = makeTool({
  name: 'undo',
  description:
    'Reverts the most recent board mutations, human or agent, newest first, up to 10 steps. Returns what was undone. Removed widgets, rows, and minted tools are fully restored and re-registered when applicable. There is no redo; reapply changes with the normal tools if needed.',
  input: UndoInput,
  handler: (input) => {
    const undone: Array<{
      seq: number
      action: string
      summary: string
      actor: 'human' | 'agent'
    }> = []
    for (let step = 0; step < input.steps; step += 1) {
      const target = useBoardStore
        .getState()
        .undo('agent', input.rationale)
      if (!target) break
      undone.push({
        seq: target.seq,
        action: target.action,
        summary: target.summary,
        actor: target.actor,
      })
    }
    if (undone.length === 0) {
      return err('NOTHING_TO_UNDO', 'The command log is empty; there is nothing to revert.')
    }
    return ok({ undone })
  },
})
