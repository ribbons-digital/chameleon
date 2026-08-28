import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Table, proportional, useTableRowIndex } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import type { TableColumn } from '@astryxdesign/core/Table'
import type { Field, Row, TableConfig, Widget } from '../model/types'
import { widgetStyles } from './styles'

type TableRow = Row & Record<string, unknown>

function formatValue(field: Field, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (field.type === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export function TableWidget({ widget }: { widget: Widget }) {
  const config = widget.config as TableConfig
  const fields = widget.dataset?.fields ?? []
  const rows = (widget.dataset?.rows ?? []) as TableRow[]

  const orderedFields = orderFields(fields, config.columnOrder)
  const sortedRows = sortRows(rows, orderedFields, config.sort)

  const columns: TableColumn<TableRow>[] = orderedFields.map((field) => ({
    key: field.key,
    header: field.label,
    width: proportional(1),
    renderCell: (item) => (
      <Text maxLines={2}>{formatValue(field, item[field.key])}</Text>
    ),
  }))

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

  if (sortedRows.length === 0) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="No rows yet"
        description="This table is ready. An agent can add rows, or you can wait for data to land."
      />
    )
  }

  return (
    <Table
      data={sortedRows}
      columns={columns}
      idKey="_id"
      density="compact"
      dividers="grid"
      hasHover
      textOverflow="truncate"
      plugins={config.rowNumbers ? { rowIndex } : undefined}
      xstyle={widgetStyles.tableHost}
    />
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
  sort?: TableConfig['sort'],
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
