import { describe, expect, it } from 'vitest'
import { fieldSchema } from '../../src/model/fields'

describe('fieldSchema', () => {
  it('accepts a valid select field', () => {
    const parsed = fieldSchema.parse({
      key: 'rsvp_status',
      label: 'RSVP status',
      type: 'select',
      options: ['invited', 'confirmed', 'declined'],
      required: true,
    })

    expect(parsed.key).toBe('rsvp_status')
  })

  it('requires options for select fields', () => {
    const result = fieldSchema.safeParse({
      key: 'status',
      label: 'Status',
      type: 'select',
    })

    expect(result.success).toBe(false)
  })

  it('rejects duplicate options and invalid keys', () => {
    const result = fieldSchema.safeParse({
      key: 'RSVP Status',
      label: 'RSVP status',
      type: 'select',
      options: ['yes', 'yes'],
    })

    expect(result.success).toBe(false)
  })

  it('forbids options on non-select fields', () => {
    const result = fieldSchema.safeParse({
      key: 'guest_name',
      label: 'Guest name',
      type: 'text',
      options: ['unused'],
    })

    expect(result.success).toBe(false)
  })
})
