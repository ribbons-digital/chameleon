import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, proportional, useTableRowIndex } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { TableColumn } from '@astryxdesign/core/Table'
import { useState } from 'react'
import { LIMITS } from '../model/limits'
import type { Field, Row, TableWidget } from '../model/types'
import {
  formatCell,
  humanAddBlankRow,
  humanDeleteRow,
  humanUpdateCell,
} from '../store/human'
import { useBoardDensity } from './density'
import { widgetStyles } from './styles'

type TableRow = Row & Record<string, unknown>

function CellEditor({
  widgetId,
  row,
  field,
}: {
  widgetId: string
  row: TableRow
  field: Field
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string>()
  const current = row[field.key]

  if (field.type === 'boolean') {
    return (
      <CheckboxInput
        label={field.label}
        isLabelHidden
        value={Boolean(current)}
        onChange={(isChecked) => {
          humanUpdateCell(widgetId, row._id, field, isChecked)
        }}
      />
    )
  }

  const display = formatCell(field, row)

  if (!editing) {
    return (
      <Button
        label={display || 'Edit'}
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(display)
          setError(undefined)
          setEditing(true)
        }}
      />
    )
  }

  const close = () => {
    setEditing(false)
    setError(undefined)
  }

  const commit = (value: unknown) => {
    const result = humanUpdateCell(widgetId, row._id, field, value)
    if (!result.ok) {
      setError(result.message)
      return
    }
    close()
  }

  if (field.type === 'select') {
    const selected = typeof current === 'string' && current !== '' ? current : undefined
    const shared = {
      label: field.label,
      isLabelHidden: true,
      size: 'sm',
      width: '100%',
      options: field.options ?? [],
      status: error ? { type: 'error' as const, message: error } : undefined,
    } as const
    if (field.required) {
      return (
        <Selector
          {...shared}
          value={selected}
          onChange={(next: string) => commit(next)}
        />
      )
    }
    return (
      <Selector
        {...shared}
        value={selected ?? null}
        hasClear
        onChange={(next: string | null) => commit(next ?? undefined)}
      />
    )
  }

  return (
    <TextInput
      label={field.label}
      isLabelHidden
      size="sm"
      value={draft}
      hasAutoFocus
      width="100%"
      status={error ? { type: 'error', message: error } : undefined}
      onChange={(value) => {
        setDraft(value)
        setError(undefined)
      }}
      onEnter={() => commit(draft === '' ? undefined : draft)}
      onBlur={() => {
        if (draft === display) close()
        else commit(draft === '' ? undefined : draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    />
  )
}

export function TableWidgetView({ widget }: { widget: TableWidget }) {
  const density = useBoardDensity()
  const config = widget.config
  const fields = widget.dataset.fields
  const rows = widget.dataset.rows as TableRow[]
  const full = rows.length >= LIMITS.rowsPerWidget
  const orderedFields = orderFields(fields, config.columnOrder)
  const sortedRows = sortRows(rows, orderedFields, config.sort)

  const columns: TableColumn<TableRow>[] = [
    ...orderedFields.map((field) => ({
      key: field.key,
      header: field.label,
      width: proportional(1),
      renderCell: (item: TableRow) => (
        <CellEditor widgetId={widget.id} row={item} field={field} />
      ),
    })),
    {
      key: '_actions',
      header: '',
      width: proportional(0.4),
      renderCell: (item: TableRow) => (
        <IconButton
          label={`Delete row in ${widget.title}`}
          tooltip="Delete row"
          size="sm"
          variant="ghost"
          icon={<Text>×</Text>}
          onClick={() => humanDeleteRow(widget.id, item._id)}
        />
      ),
    },
  ]

  const rowIndex = useTableRowIndex({
    data: sortedRows,
    getRowKey: (item) => String(item._id),
  })

  if (fields.length === 0) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="No columns yet"
        description="Ask the agent to bind fields, or pass fields when adding this table."
      />
    )
  }

  return (
    <VStack gap={2} paddingBlockStart={4} xstyle={widgetStyles.tableStack}>
      {sortedRows.length === 0 ? (
        <EmptyState
          isCompact
          headingLevel={3}
          title="No rows yet"
          description="Add a row, or ask the agent to fill this table."
        />
      ) : (
        <Table
          data={sortedRows}
          columns={columns}
          idKey="_id"
          density={density.rows}
          dividers="grid"
          hasHover
          textOverflow="truncate"
          plugins={config.rowNumbers ? { rowIndex } : undefined}
          xstyle={widgetStyles.tableHost}
        />
      )}
      <Button
        label="Add row"
        variant="secondary"
        size="sm"
        isDisabled={full}
        tooltip={
          full ? `This table already has ${LIMITS.rowsPerWidget} rows.` : undefined
        }
        onClick={() => humanAddBlankRow(widget.id)}
      />
    </VStack>
  )
}

function orderFields(fields: Field[], columnOrder?: string[]): Field[] {
  if (!columnOrder?.length) return fields
  const lookup = new Map(fields.map((field) => [field.key, field]))
  const ordered = columnOrder
    .map((key) => lookup.get(key))
    .filter((field): field is Field => Boolean(field))
  for (const field of fields) {
    if (!columnOrder.includes(field.key)) ordered.push(field)
  }
  return ordered
}

function sortRows(
  rows: TableRow[],
  fields: Field[],
  sort?: TableWidget['config']['sort'],
): TableRow[] {
  if (!sort) return rows
  const field = fields.find((candidate) => candidate.key === sort.field)
  if (!field) return rows
  const direction = sort.dir === 'desc' ? -1 : 1
  return [...rows].sort((left, right) => {
    const a = left[sort.field]
    const b = right[sort.field]
    if (a === b) return 0
    if (a === undefined || a === null) return 1
    if (b === undefined || b === null) return -1
    if (field.type === 'number') {
      return (Number(a) - Number(b)) * direction
    }
    return String(a).localeCompare(String(b)) * direction
  })
}
