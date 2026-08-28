import { describe, expect, it } from 'vitest'
import { validateConfig } from '../../src/model/widgets'

describe('kanban / checklist config', () => {
  it('requires groupByField to be a select field', () => {
    const result = validateConfig(
      'kanban',
      { groupByField: 'status', cardTitleField: 'title' },
      [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'status', label: 'Status', type: 'text', required: true },
      ],
    )
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.code).toBe('INVALID_CONFIG')
    }
  })

  it('accepts a select group-by field', () => {
    const result = validateConfig(
      'kanban',
      { groupByField: 'status', cardTitleField: 'title' },
      [
        { key: 'title', label: 'Title', type: 'text', required: true },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: ['applied', 'interview'],
        },
      ],
    )
    expect('config' in result).toBe(true)
  })

  it('accepts default checklist config', () => {
    const result = validateConfig('checklist', {}, [])
    expect('config' in result).toBe(true)
  })
})
