import type { Row } from './types'

export const KANBAN_UNGROUPED = ''

export function columnValueOf(
  row: Row,
  groupKey: string,
  ungrouped = KANBAN_UNGROUPED,
): string {
  const value = row[groupKey]
  if (value === undefined || value === null || value === '') return ungrouped
  return String(value)
}

export function placeRowInColumn(
  rows: Row[],
  rowId: string,
  groupKey: string,
  column: string,
  index: number,
  ungrouped = KANBAN_UNGROUPED,
): Row[] | null {
  const row = rows.find((candidate) => candidate._id === rowId)
  if (!row) return null

  const without = rows.filter((candidate) => candidate._id !== rowId)
  const next: Row = { ...row }
  if (column === ungrouped) delete next[groupKey]
  else next[groupKey] = column

  const othersInColumn = without.filter(
    (candidate) => columnValueOf(candidate, groupKey, ungrouped) === column,
  )
  const clamped = Math.max(0, Math.min(index, othersInColumn.length))

  let seen = 0
  const result: Row[] = []
  let inserted = false
  for (const candidate of without) {
    if (
      !inserted &&
      columnValueOf(candidate, groupKey, ungrouped) === column &&
      seen === clamped
    ) {
      result.push(next)
      inserted = true
    }
    if (columnValueOf(candidate, groupKey, ungrouped) === column) seen += 1
    result.push(candidate)
  }
  if (!inserted) result.push(next)

  if (columnSignature(result, groupKey, ungrouped) === columnSignature(rows, groupKey, ungrouped)) {
    return null
  }
  return result
}

function columnSignature(
  rows: Row[],
  groupKey: string,
  ungrouped: string,
): string {
  const columns = new Map<string, string[]>()
  for (const candidate of rows) {
    const column = columnValueOf(candidate, groupKey, ungrouped)
    const ids = columns.get(column) ?? []
    ids.push(candidate._id)
    columns.set(column, ids)
  }
  return [...columns.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([column, ids]) => `${column}:${ids.join(',')}`)
    .join(';')
}
