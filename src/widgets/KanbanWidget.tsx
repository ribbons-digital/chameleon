import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { useState } from 'react'
import {
  columnValueOf,
  dropInsertIndex,
  KANBAN_UNGROUPED,
} from '../model/kanbanOrder'
import type { Field, KanbanWidget as KanbanWidgetModel, Row } from '../model/types'
import { humanAddRow, humanMoveKanbanCard } from '../store/human'
import { widgetStyles } from './styles'

const CARD_MIME = 'application/x-chameleon-row'

function columnsFor(widget: KanbanWidgetModel): string[] {
  const group = widget.dataset.fields.find(
    (field) => field.key === widget.config.groupByField,
  )
  const options = group?.options ?? []
  const ordered = widget.config.columnOrder?.filter((option) => options.includes(option))
  const base = ordered && ordered.length > 0 ? ordered : options
  const extras = options.filter((option) => !base.includes(option))
  return [...base, ...extras, KANBAN_UNGROUPED]
}

function columnLabel(value: string): string {
  return value === KANBAN_UNGROUPED ? 'No status' : value
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

function dropIndexFromPoint(
  columnEl: HTMLElement,
  draggingId: string | null,
  clientY: number,
  currentIndex: number,
): number {
  const others = [...columnEl.querySelectorAll<HTMLElement>('.kanban-card')]
    .filter((element) => element.dataset.rowId !== draggingId)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        id: element.dataset.rowId ?? '',
        top: rect.top,
        height: rect.height,
      }
    })
  return dropInsertIndex({ others, clientY, currentIndex })
}

export function KanbanWidgetView({ widget }: { widget: KanbanWidgetModel }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{ column: string; index: number } | null>(
    null,
  )
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

  const moveCard = (row: Row, column: string, index: number) => {
    const current = columnValueOf(row, groupField.key)
    const title = cardTitle(row, titleField)
    const summary =
      current === column
        ? `Reordered “${title}” in ${columnLabel(column)}`
        : `Moved “${title}” to ${columnLabel(column)}`
    humanMoveKanbanCard(widget.id, row._id, groupField, column, index, summary)
  }

  const addCard = (column: string) => {
    const title = (drafts[column] ?? '').trim()
    if (!title || !titleField) return
    const values: Record<string, unknown> = { [titleField.key]: title }
    if (column !== KANBAN_UNGROUPED) values[groupField.key] = column
    const result = humanAddRow(widget.id, values, `Added “${title}”`)
    if (result.ok) {
      setDrafts((current) => ({ ...current, [column]: '' }))
      setErrors((current) => ({ ...current, [column]: '' }))
      return
    }
    setErrors((current) => ({ ...current, [column]: result.message }))
  }

  const readRowId = (transfer: DataTransfer) =>
    transfer.getData(CARD_MIME) || transfer.getData('text/plain')

  return (
    <HStack gap={3} xstyle={widgetStyles.kanbanBoard} vAlign="start">
      {columns.map((column) => {
        const cards = widget.dataset.rows.filter(
          (row) => columnValueOf(row, groupField.key) === column,
        )
        const others = cards.filter((candidate) => candidate._id !== draggingId)
        return (
          <VStack
            key={column || 'ungrouped'}
            gap={2}
            xstyle={widgetStyles.kanbanColumn}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              const currentIndex = draggingId
                ? cards.findIndex((candidate) => candidate._id === draggingId)
                : -1
              const index = dropIndexFromPoint(
                event.currentTarget,
                draggingId,
                event.clientY,
                currentIndex,
              )
              setDropHint({ column, index })
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget
              if (next instanceof Node && event.currentTarget.contains(next)) return
              setDropHint((current) =>
                current?.column === column ? null : current,
              )
            }}
            onDrop={(event) => {
              event.preventDefault()
              const rowId = readRowId(event.dataTransfer)
              const row = widget.dataset.rows.find((candidate) => candidate._id === rowId)
              const currentIndex = cards.findIndex((candidate) => candidate._id === rowId)
              const index = dropIndexFromPoint(
                event.currentTarget,
                rowId,
                event.clientY,
                currentIndex,
              )
              setDraggingId(null)
              setDropHint(null)
              if (row) moveCard(row, column, index)
            }}
          >
            <Heading level={3}>{columnLabel(column)}</Heading>
            <Text type="supporting" color="secondary">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </Text>
            {cards.length === 0 ? (
              <Text type="supporting" color="secondary">
                Drop a card here, or add one below.
              </Text>
            ) : (
              <VStack gap={2}>
                {cards.map((row, index) => {
                  const title = cardTitle(row, titleField)
                  const details = cardDetails(row, detailFields)
                  const dragging = draggingId === row._id
                  const othersIndex = others.findIndex((candidate) => candidate._id === row._id)
                  const hintHere =
                    dropHint?.column === column &&
                    othersIndex >= 0 &&
                    dropHint.index === othersIndex
                  const hintAfter =
                    dropHint?.column === column &&
                    index === cards.length - 1 &&
                    dropHint.index === others.length
                  const dropClass = hintHere
                    ? ' drop-before'
                    : hintAfter
                      ? ' drop-after'
                      : ''
                  return (
                    <Card
                      key={row._id}
                      className={`kanban-card${dragging ? ' is-dragging' : ''}${dropClass}`}
                      padding={3}
                      elevation="med"
                      width="100%"
                      draggable
                      data-row-id={row._id}
                      aria-label={`${title} card`}
                      xstyle={widgetStyles.kanbanCard}
                      onPointerDown={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.stopPropagation()
                        event.dataTransfer.setData(CARD_MIME, row._id)
                        event.dataTransfer.setData('text/plain', row._id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggingId(row._id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDropHint(null)
                      }}
                    >
                      <VStack gap={1}>
                        <Heading level={4}>{title}</Heading>
                        {details && (
                          <Text type="supporting" color="secondary">
                            {details}
                          </Text>
                        )}
                      </VStack>
                    </Card>
                  )
                })}
              </VStack>
            )}
            {titleField && (
              <TextInput
                label={`New card in ${columnLabel(column)}`}
                isLabelHidden
                size="sm"
                placeholder="Add a card"
                value={drafts[column] ?? ''}
                status={
                  errors[column]
                    ? { type: 'error', message: errors[column] }
                    : undefined
                }
                onChange={(value) => {
                  setDrafts((current) => ({ ...current, [column]: value }))
                  setErrors((current) => ({ ...current, [column]: '' }))
                }}
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
