import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Markdown } from '@astryxdesign/core/Markdown'
import { TextArea } from '@astryxdesign/core/TextArea'
import { VStack } from '@astryxdesign/core/VStack'
import { useState } from 'react'
import { LIMITS } from '../model/limits'
import type { NoteConfig, NoteWidget as NoteWidgetModel } from '../model/types'
import { mutate } from '../store/mutate'
import { widgetStyles } from './styles'

function noteConfig(widget: NoteWidgetModel): NoteConfig {
  return {
    markdown: widget.config.markdown ?? '',
    variant: widget.config.variant ?? 'plain',
  }
}

export function NoteWidget({ widget }: { widget: NoteWidgetModel }) {
  const config = noteConfig(widget)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(config.markdown)

  const startEditing = () => {
    setDraft(config.markdown)
    setEditing(true)
  }

  const commit = (value: string) => {
    setEditing(false)
    if (value === config.markdown) return
    mutate(
      {
        actor: 'human',
        action: 'update_widget',
        summary: `Edited note “${widget.title}”`,
      },
      (board) => {
        const target = board.widgets.find(
          (candidate) => candidate.id === widget.id,
        )
        if (!target || target.type !== 'note') return
        target.config = { ...noteConfig(target), markdown: value }
        target.updatedAt = new Date().toISOString()
        target.lastModifiedBy = 'human'
      },
    )
  }

  if (editing) {
    return (
      <TextArea
        label="Note markdown"
        isLabelHidden
        value={draft}
        rows={8}
        maxLength={LIMITS.noteMarkdown}
        placeholder="Write markdown…"
        hasAutoFocus
        width="100%"
        xstyle={widgetStyles.noteEditor}
        onChange={setDraft}
        onBlur={() => commit(draft)}
      />
    )
  }

  if (!config.markdown.trim()) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="Empty note"
        description="Click to write markdown the agent and the human can both edit."
        actions={
          <Button
            label="Write note"
            variant="secondary"
            size="sm"
            onClick={startEditing}
          />
        }
      />
    )
  }

  const markdown = (
    <VStack gap={2} onClick={startEditing}>
      <Markdown headingLevelStart={3} density="compact" contentWidth="100%">
        {config.markdown}
      </Markdown>
    </VStack>
  )

  if (config.variant === 'callout') {
    return (
      <Banner status="info" title="Note" collapsible={false}>
        {markdown}
      </Banner>
    )
  }

  return markdown
}
