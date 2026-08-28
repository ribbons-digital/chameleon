import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { useState } from 'react'
import type { Field, KanbanWidget as KanbanWidgetModel, Row } from '../model/types'
import { humanAddRow, humanUpdateCell } from '../store/human'
import { widgetStyles } from './styles'

const UNGROUPED = ''

function columnsFor(widget: KanbanWidgetModel): string[] {
  const group = widget.dataset.fields.find(
    (field) => field.key === widget.config.groupByField,
  )
  const options = group?.options ?? []
  const ordered = widget.config.columnOrder?.filter((option) => options.includes(option))
  const base = ordered && ordered.length > 0 ? ordered : options
  const extras = options.filter((option) => !base.includes(option))
  return [...base, ...extras, UNGROUPED]
}

function columnLabel(value: string): string {
  return value === UNGROUPED ? 'No status' : value
}

function cardTitle(row: Row, field: Field | undefined): string {
  if (!field) return 'Untitled'
  const value = row[field.key]
  return value === undefined || value === null || value === '' ? 'Untitled' : String(value)
}

function cardDetails(row: Row, fields: Field[]): string | undefined {
  const parts = fields
    .map((field) => {
      const value = row[field.key]
      if (value === undefined || value === null || value === '') return undefined
      return `${field.label}: ${String(value)}`
    })
    .filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function KanbanWidgetView({ widget }: { widget: KanbanWidgetModel }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const groupField = widget.dataset.fields.find(
    (field) => field.key === widget.config.groupByField,
  )
  const titleField = widget.dataset.fields.find(
    (field) => field.key === widget.config.cardTitleField,
  )
  const detailFields = widget.config.cardDetailFields
    .map((key) => widget.dataset.fields.find((field) => field.key === key))
    .filter((field): field is Field => Boolean(field))

  if (widget.dataset.fields.length === 0 || !groupField || groupField.type !== 'select') {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="Kanban needs a select field"
        description="Call bind_data with a select field, then set config.groupByField to that key."
      />
    )
  }

  const columns = columnsFor(widget)

  const moveCard = (row: Row, next: string) => {
    humanUpdateCell(
      widget.id,
      row._id,
      groupField,
      next === UNGROUPED ? undefined : next,
      `Moved “${cardTitle(row, titleField)}” to ${columnLabel(next)}`,
    )
  }

  const addCard = (column: string) => {
    const title = (drafts[column] ?? '').trim()
    if (!title || !titleField) return
    const values: Record<string, unknown> = { [titleField.key]: title }
    if (column !== UNGROUPED) values[groupField.key] = column
    const result = humanAddRow(widget.id, values, `Added “${title}”`)
    if (result.ok) setDrafts((current) => ({ ...current, [column]: '' }))
  }

  return (
    <HStack gap={3} wrap="wrap" xstyle={widgetStyles.kanbanBoard} vAlign="start">
      {columns.map((column) => {
        const cards = widget.dataset.rows.filter((row) => {
          const value = row[groupField.key]
          if (column === UNGROUPED) return value === undefined || value === null || value === ''
          return value === column
        })
        return (
          <VStack
            key={column || 'ungrouped'}
            gap={2}
            xstyle={widgetStyles.kanbanColumn}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const rowId = event.dataTransfer.getData('text/plain')
              const row = widget.dataset.rows.find((candidate) => candidate._id === rowId)
              if (row) moveCard(row, column)
            }}
          >
            <Heading level={3}>
              {columnLabel(column)}
            </Heading>
            <Text type="supporting" color="secondary">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </Text>
            {cards.length === 0 ? (
              <Text type="supporting" color="secondary">
                Drop a card here, or add one below.
              </Text>
            ) : (
              <List density="compact" hasDividers header={<Text type="label">{columnLabel(column)}</Text>}>
                {cards.map((row) => (
                  <ListItem
                    key={row._id}
                    label={cardTitle(row, titleField)}
                    description={cardDetails(row, detailFields)}
                  />
                ))}
              </List>
            )}
            {titleField && (
              <TextInput
                label={`New card in ${columnLabel(column)}`}
                isLabelHidden
                size="sm"
                placeholder="Add a card"
                value={drafts[column] ?? ''}
                onChange={(value) =>
                  setDrafts((current) => ({ ...current, [column]: value }))
                }
                onEnter={() => addCard(column)}
                width="100%"
              />
            )}
            <Button
              label="Add card"
              variant="secondary"
              size="sm"
              onClick={() => addCard(column)}
            />
          </VStack>
        )
      })}
    </HStack>
  )
}
