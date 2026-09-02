import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { useState } from 'react'
import type { ChecklistWidget as ChecklistWidgetModel, Row } from '../model/types'
import { humanAddRow, humanDeleteRow, humanUpdateCell } from '../store/human'
import { useBoardDensity } from './density'

function sortItems(rows: Row[], sortBy: ChecklistWidgetModel['config']['sortBy']): Row[] {
  if (sortBy === 'manual') return rows
  return [...rows].sort((left, right) => {
    if (sortBy === 'created') {
      return String(left._createdAt).localeCompare(String(right._createdAt))
    }
    const a = typeof left.due === 'string' ? left.due : '9999-12-31'
    const b = typeof right.due === 'string' ? right.due : '9999-12-31'
    return a.localeCompare(b)
  })
}

export function ChecklistWidgetView({ widget }: { widget: ChecklistWidgetModel }) {
  const [draft, setDraft] = useState('')
  const density = useBoardDensity()
  const fields = widget.dataset.fields
  const textField = fields.find((field) => field.key === 'text')
  const doneField = fields.find((field) => field.key === 'done')
  if (!textField || !doneField) return null

  const visible = sortItems(widget.dataset.rows, widget.config.sortBy).filter((row) => {
    if (widget.config.showCompleted) return true
    return row.done !== true
  })
  const doneCount = widget.dataset.rows.filter((row) => row.done === true).length
  const total = widget.dataset.rows.length

  const addItem = () => {
    const text = draft.trim()
    if (!text) return
    const result = humanAddRow(widget.id, { text, done: false }, `Added “${text}”`)
    if (result.ok) setDraft('')
  }

  return (
    <VStack gap={3}>
      {widget.config.showProgress && total > 0 && (
        <ProgressBar
          label={`${doneCount} of ${total} done`}
          value={doneCount}
          max={total}
          hasValueLabel
          formatValueLabel={(value, max) => `${value} of ${max} done`}
          variant="success"
        />
      )}
      {visible.length === 0 ? (
        <EmptyState
          isCompact
          headingLevel={3}
          title="No items yet"
          description="Add a checklist item, or ask the agent to fill this list."
        />
      ) : (
        <List density={density.rows} hasDividers header={<Text type="label">Items</Text>}>
          {visible.map((row) => {
            const label = typeof row.text === 'string' ? row.text : 'Untitled'
            const due = typeof row.due === 'string' ? row.due : undefined
            return (
              <ListItem
                key={row._id}
                label={label}
                description={due ? `Due ${due}` : undefined}
                startContent={
                  <CheckboxInput
                    label={`Mark ${label} done`}
                    isLabelHidden
                    value={row.done === true}
                    onChange={(isChecked) => {
                      humanUpdateCell(
                        widget.id,
                        row._id,
                        doneField,
                        isChecked,
                        isChecked
                          ? `Checked off “${label}” in ${widget.title}`
                          : `Reopened “${label}” in ${widget.title}`,
                      )
                    }}
                  />
                }
                endContent={
                  <IconButton
                    label={`Delete ${label}`}
                    tooltip="Delete item"
                    size="sm"
                    variant="ghost"
                    icon={<Text>×</Text>}
                    onClick={() => humanDeleteRow(widget.id, row._id)}
                  />
                }
              />
            )
          })}
        </List>
      )}
      <TextInput
        label="New item"
        isLabelHidden
        placeholder="Add an item"
        value={draft}
        onChange={setDraft}
        onEnter={addItem}
        width="100%"
      />
      <Button label="Add item" variant="secondary" size="sm" onClick={addItem} />
    </VStack>
  )
}
