import { z } from 'zod'
import { useBoardStore } from '../../store/boardStore'
import { activityEntries, currentSnapshot } from '../../store/selectors'
import { makeTool } from '../makeTool'
import { ok } from '../result'

export const DescribeInput = z
  .object({
    include_sample_rows: z
      .boolean()
      .default(true)
      .describe('Set false to omit sample rows for a smaller response.'),
  })
  .strict()

export const describeCurrentState = makeTool({
  name: 'describe_current_state',
  description:
    'Returns the full ground-truth snapshot of the board: title, theme, every widget (id, type, title, grid position, config, data field schema, row count, up to 3 sample rows), all dynamically minted tools, the last 10 activity-log entries including edits the human made by hand, and the current stateVersion. Call this before your first mutation and again whenever a tool reports a stale or missing id. This is the only tool that shows you what the human has changed.',
  input: DescribeInput,
  handler: (input) => {
    const snapshot = currentSnapshot(input.include_sample_rows)
    const humanEdits = useBoardStore.getState().resetHumanEditCount()
    return ok({
      ...snapshot,
      humanEditsSinceLastDescribe: humanEdits,
    })
  },
})

export const GetActivityLogInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
    actor: z
      .enum(['human', 'agent'])
      .optional()
      .describe('Filter to only human edits or only agent edits.'),
    since_seq: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Only entries with seq greater than this value.'),
  })
  .strict()

export const getActivityLog = makeTool({
  name: 'get_activity_log',
  description:
    "Returns the board's command log, newest first — every mutation made by you or by the human dragging, editing, or deleting things by hand. Each entry has an actor ('human'|'agent'), an action name, a human-readable summary, and the rationale the agent gave. Use it to answer \"what did the human change?\" or to review your own recent edits before reorganizing.",
  input: GetActivityLogInput,
  handler: (input) => {
    const { commands } = useBoardStore.getState()
    return ok({
      entries: activityEntries(commands, {
        limit: input.limit,
        actor: input.actor,
        since_seq: input.since_seq,
      }),
    })
  },
})
