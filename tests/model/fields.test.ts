import { describe, expect, it } from 'vitest'
import { coerceValue, validateValue } from '../../src/model/fields'
import type { Field } from '../../src/model/types'

const text: Field = { key: 'title', label: 'Title', type: 'text', required: true }
const number: Field = { key: 'count', label: 'Count', type: 'number', required: false }
const date: Field = { key: 'due', label: 'Due', type: 'date', required: false }
const select: Field = {
  key: 'status',
  label: 'Status',
  type: 'select',
  required: true,
  options: ['open', 'done'],
}
const flag: Field = { key: 'done', label: 'Done', type: 'boolean', required: false }
const link: Field = { key: 'url', label: 'URL', type: 'url', required: false }

describe('coerceValue / validateValue', () => {
  it('stringifies numbers into text', () => {
    expect(coerceValue(text, 12)).toBe('12')
    expect(validateValue(text, 12)).toEqual({ ok: true, value: '12' })
  })

  it('parses numeric strings', () => {
    expect(validateValue(number, '3.5')).toEqual({ ok: true, value: 3.5 })
    expect(validateValue(number, 'nope').ok).toBe(false)
  })

  it('truncates ISO datetimes to yyyy-mm-dd', () => {
    expect(validateValue(date, '2026-08-30T14:02:11Z')).toEqual({
      ok: true,
      value: '2026-08-30',
    })
  })

  it('trims select values and rejects unknown options', () => {
    expect(validateValue(select, ' done ')).toEqual({ ok: true, value: 'done' })
    expect(validateValue(select, 'Done').ok).toBe(false)
  })

  it('parses true/false strings', () => {
    expect(validateValue(flag, 'true')).toEqual({ ok: true, value: true })
    expect(validateValue(flag, 'yes').ok).toBe(false)
  })

  it('accepts http(s) urls only', () => {
    expect(validateValue(link, 'https://example.com')).toMatchObject({ ok: true })
    expect(validateValue(link, 'ftp://example.com').ok).toBe(false)
  })

  it('rejects missing required values', () => {
    expect(validateValue(text, '').ok).toBe(false)
    expect(validateValue(number, undefined)).toEqual({ ok: true, value: undefined })
  })
})
