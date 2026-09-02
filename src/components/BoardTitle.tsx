import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useState } from 'react'
import { styles } from '../app/styles'
import { useBoardStore } from '../store/boardStore'
import { humanRenameBoard } from '../store/human'

export function BoardTitle() {
  const title = useBoardStore((state) => state.document.title)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [error, setError] = useState<string>()

  const start = () => {
    setDraft(title)
    setError(undefined)
    setEditing(true)
  }

  const close = () => {
    setEditing(false)
    setError(undefined)
  }

  const commit = () => {
    const result = humanRenameBoard(draft)
    if (!result.ok) {
      setError(result.message)
      return
    }
    close()
  }

  if (editing) {
    return (
      <TextInput
        label="Board name"
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
          if (draft.trim() === title) close()
          else commit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      />
    )
  }

  return (
    <HStack gap={2} vAlign="center">
      <Heading level={1} type="display-3" xstyle={styles.brandMark}>
        {title}
      </Heading>
      <Button label="Rename board" variant="ghost" size="sm" onClick={start} />
    </HStack>
  )
}
