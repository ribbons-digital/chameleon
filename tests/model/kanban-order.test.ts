import { describe, expect, it } from 'vitest'
import { placeRowInColumn } from '../../src/model/kanbanOrder'
import type { Row } from '../../src/model/types'

function row(id: string, title: string, status?: string): Row {
  const next: Row = {
    _id: id,
    _createdAt: '2026-01-01T00:00:00.000Z',
    _updatedAt: '2026-01-01T00:00:00.000Z',
    _createdBy: 'human',
    title,
  }
  if (status) next.status = status
  return next
}

describe('placeRowInColumn', () => {
  const rows = [
    row('a', 'DJ', 'research'),
    row('b', 'Florist', 'research'),
    row('c', 'Venue', 'booked'),
  ]

  it('moves a card above another in the same column', () => {
    const next = placeRowInColumn(rows, 'b', 'status', 'research', 0)
    expect(next?.filter((item) => item.status === 'research').map((item) => item._id)).toEqual([
      'b',
      'a',
    ])
  })

  it('moves a card below another in the same column', () => {
    const next = placeRowInColumn(rows, 'a', 'status', 'research', 1)
    expect(next?.filter((item) => item.status === 'research').map((item) => item._id)).toEqual([
      'b',
      'a',
    ])
  })

  it('returns null when the card is already at that index', () => {
    expect(placeRowInColumn(rows, 'a', 'status', 'research', 0)).toBeNull()
    expect(placeRowInColumn(rows, 'b', 'status', 'research', 1)).toBeNull()
  })

  it('appends when moving into another column', () => {
    const next = placeRowInColumn(rows, 'a', 'status', 'booked', 1)
    expect(next?.filter((item) => item.status === 'booked').map((item) => item._id)).toEqual([
      'c',
      'a',
    ])
  })

  it('inserts at the top of another column', () => {
    const next = placeRowInColumn(rows, 'a', 'status', 'booked', 0)
    expect(next?.filter((item) => item.status === 'booked').map((item) => item._id)).toEqual([
      'a',
      'c',
    ])
  })
})
