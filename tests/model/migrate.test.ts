import { describe, expect, it } from 'vitest'
import { migrateRows } from '../../src/model/migrate'
import type { Field, Row } from '../../src/model/types'

const text: Field = { key: 'name', label: 'Name', type: 'text', required: true }
const status: Field = {
  key: 'status',
  label: 'Status',
  type: 'select',
  required: false,
  options: ['open', 'done'],
}
const count: Field = { key: 'count', label: 'Count', type: 'number', required: false }

function row(values: Record<string, unknown>): Row {
  return {
    _id: 'r_one',
    _createdAt: '2026-08-30T00:00:00.000Z',
    _updatedAt: '2026-08-30T00:00:00.000Z',
    _createdBy: 'agent',
    ...values,
  }
}

describe('migrateRows', () => {
  it('keeps values for unchanged keys', () => {
    const next = migrateRows([row({ name: 'Ada', status: 'open' })], [text, status], [
      text,
      status,
    ])
    expect(next[0].name).toBe('Ada')
    expect(next[0].status).toBe('open')
  })

  it('drops removed keys and leaves new keys empty', () => {
    const next = migrateRows([row({ name: 'Ada', extra: 'gone' })], [text], [text, count])
    expect(next[0].name).toBe('Ada')
    expect(next[0].extra).toBeUndefined()
    expect(next[0].count).toBeUndefined()
  })

  it('clears select values that are not in the new options', () => {
    const next = migrateRows(
      [row({ status: 'open' })],
      [status],
      [{ ...status, options: ['done'] }],
    )
    expect(next[0].status).toBeUndefined()
  })

  it('re-coerces type changes and clears on failure', () => {
    const next = migrateRows(
      [row({ count: '4' }), row({ count: 'nope' })],
      [{ ...count, type: 'text' }],
      [count],
    )
    expect(next[0].count).toBe(4)
    expect(next[1].count).toBeUndefined()
  })
})
