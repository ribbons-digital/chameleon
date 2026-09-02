import { useToast } from '@astryxdesign/core/Toast'
import { Text } from '@astryxdesign/core/Text'
import { useEffect, useRef } from 'react'
import { useBoardStore } from '../store/boardStore'

export function AgentPulse() {
  const lastCommand = useBoardStore((state) => state.commands.at(-1))
  const showToast = useToast()
  // Seed from persisted history during render: that command should stay
  // quiet on reload. If the board starts empty, the first later command is
  // genuinely new and must not be swallowed.
  const seenSeq = useRef(lastCommand?.seq)

  useEffect(() => {
    if (!lastCommand) return
    if (lastCommand.seq === seenSeq.current) return
    seenSeq.current = lastCommand.seq
    if (lastCommand.actor !== 'agent') return
    showToast({
      type: 'info',
      body: <Text>{lastCommand.summary}</Text>,
      uniqueID: `agent-${lastCommand.seq}`,
      isAutoHide: true,
    })
  }, [lastCommand, showToast])

  return null
}
