import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useState } from 'react'
import type { Widget } from '../model/types'
import { humanRenameWidget } from '../store/human'

export function WidgetTitle({ widget }: { widget: Widget }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(widget.title)
  const [error, setError] = useState<string>()

  const close = () => {
    setEditing(false)
    setError(undefined)
  }

  const commit = () => {
    const result = humanRenameWidget(widget.id, draft)
    if (!result.ok) {
      setError(result.message)
      return
    }
    close()
  }

  if (editing) {
    return (
      <TextInput
        label="Widget name"
        isLabelHidden
        value={draft}
        hasAutoFocus
        width="100%"
        status={error ? { type: 'error', message: error } : undefined}
        onChange={(value) => {
          setDraft(value)
          setError(undefined)
        }}
        onEnter={commit}
        onBlur={() => {
          if (draft.trim() === widget.title) close()
          else commit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      />
    )
  }

  return (
    <HStack gap={1} vAlign="center">
      <Heading level={2} maxLines={1}>
        {widget.title}
      </Heading>
      <IconButton
        label={`Rename ${widget.title}`}
        tooltip="Rename widget"
        size="sm"
        variant="ghost"
        icon={<Text>✎</Text>}
        onClick={(event) => {
          event.stopPropagation()
          setDraft(widget.title)
          setError(undefined)
          setEditing(true)
        }}
      />
    </HStack>
  )
}
