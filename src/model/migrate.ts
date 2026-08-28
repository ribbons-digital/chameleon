import { fieldsByKey, validateValue } from './fields'
import type { Field, Row } from './types'

export function migrateRows(
  rows: Row[],
  previousFields: Field[],
  nextFields: Field[],
): Row[] {
  const previous = fieldsByKey(previousFields)
  return rows.map((row) => {
    const next: Row = {
      _id: row._id,
      _createdAt: row._createdAt,
      _updatedAt: row._updatedAt,
      _createdBy: row._createdBy,
    }
    for (const field of nextFields) {
      if (!previous.has(field.key)) continue
      const raw = row[field.key]
      if (raw === undefined) continue
      const result = validateValue(field, raw)
      if (result.ok && result.value !== undefined) {
        next[field.key] = result.value
      }
    }
    return next
  })
}

export function uniqueFieldKeys(fields: Field[]): string | undefined {
  const seen = new Set<string>()
  for (const field of fields) {
    if (seen.has(field.key)) return field.key
    seen.add(field.key)
  }
  return undefined
}
