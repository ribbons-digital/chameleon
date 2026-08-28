import { z } from 'zod'
import { useBoardStore } from '../../store/boardStore'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'

export const UndoInput = z
  .object({
    steps: z.number().int().min(1).max(10).default(1),
  })
  .strict()

export const undoBoard = makeTool({
  name: 'undo',
  description:
    'Reverts the most recent board mutations (human or agent), newest first, up to 10 steps per call. Returns what was undone so you can confirm to the user. Data-destructive operations (remove_widget, delete_rows) are fully restored including rows. There is no redo — re-apply changes with the normal tools if the user changes their mind.',
  input: UndoInput,
  handler: (input) => {
    const undone: Array<{
      seq: number
      action: string
      summary: string
      actor: 'human' | 'agent'
    }> = []
    for (let step = 0; step < input.steps; step += 1) {
      const target = useBoardStore.getState().undo('agent')
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
