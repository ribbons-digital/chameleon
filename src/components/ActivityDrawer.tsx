import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { useState } from 'react'
import { useBoardStore } from '../store/boardStore'
import { activityEntries } from '../store/selectors'

export function ActivityDrawer() {
  const [open, setOpen] = useState(false)
  const commands = useBoardStore((state) => state.commands)
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
          density="compact"
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
                description={`${entry.actor} · ${entry.action}${entry.undone ? ' · undone' : ''}${
                  entry.rationale ? ` · ${entry.rationale}` : ''
                }`}
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
