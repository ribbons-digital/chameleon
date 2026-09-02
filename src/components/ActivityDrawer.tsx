import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { useState } from 'react'
import { useBoardStore } from '../store/boardStore'
import { activityEntries } from '../store/selectors'
import { useBoardDensity } from '../widgets/density'

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function describeEntry(entry: {
  at: string
  actor: string
  action: string
  undone: boolean
  rationale?: string
}): string {
  const at = new Date(entry.at)
  return [
    Number.isNaN(at.getTime()) ? undefined : timeFormat.format(at),
    entry.actor,
    entry.action,
    entry.undone ? 'undone' : undefined,
    entry.rationale,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function ActivityDrawer() {
  const [open, setOpen] = useState(false)
  const commands = useBoardStore((state) => state.commands)
  const density = useBoardDensity()
  const entries = activityEntries(commands, { limit: 20 })

  return (
    <VStack gap={2}>
      <Button
        label={open ? 'Hide activity' : 'Show activity'}
        variant="ghost"
        size="sm"
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <List
          density={density.rows}
          hasDividers
          header={<Heading level={2}>Activity</Heading>}
        >
          {entries.length === 0 ? (
            <ListItem
              label="No activity yet"
              description="Agent tools and hand edits will show up here."
            />
          ) : (
            entries.map((entry) => (
              <ListItem
                key={entry.seq}
                label={entry.summary}
                description={describeEntry(entry)}
              />
            ))
          )}
        </List>
      )}
      {!open && (
        <Text type="supporting">
          {entries[0]
            ? `Latest: ${entries[0].summary}`
            : 'Drag, edit, or ask an agent to create the first activity entry.'}
        </Text>
      )}
    </VStack>
  )
}
