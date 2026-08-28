import { describe, expect, it } from 'vitest'
import { applyLayout, clampPosition } from '../../src/model/layout'
import type { NoteWidget } from '../../src/model/types'

function note(
  id: string,
  position: NoteWidget['position'],
): NoteWidget {
  return {
    id,
    type: 'note',
    title: id,
    position,
    config: { markdown: '', variant: 'plain' },
    dataset: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastModifiedBy: 'agent',
  }
}

describe('layout collision resolution', () => {
  it('clamps width before clamping x to the grid', () => {
    expect(clampPosition({ x: 11, y: -2, w: 6, h: 1 })).toEqual({
      x: 6,
      y: 0,
      w: 6,
      h: 2,
    })
  })

  it('pushes an overlapping unlisted widget down', () => {
    const widgets = [
      note('w_first1', { x: 0, y: 0, w: 6, h: 4 }),
      note('w_second', { x: 0, y: 5, w: 6, h: 4 }),
    ]
    const result = applyLayout(widgets, [
      { widgetId: 'w_second', x: 0, y: 0, w: 6, h: 4 },
    ])
    expect(result).toEqual([
      { widgetId: 'w_first1', x: 0, y: 4, w: 6, h: 4 },
      { widgetId: 'w_second', x: 0, y: 0, w: 6, h: 4 },
    ])
  })

  it('pushes later requested widgets until every collision clears', () => {
    const widgets = [
      note('w_first1', { x: 0, y: 0, w: 4, h: 3 }),
      note('w_second', { x: 4, y: 0, w: 4, h: 3 }),
      note('w_third3', { x: 8, y: 0, w: 4, h: 3 }),
    ]
    const result = applyLayout(widgets, [
      { widgetId: 'w_first1', x: 0, y: 0, w: 12, h: 3 },
      { widgetId: 'w_second', x: 0, y: 1, w: 6, h: 3 },
    ])
    expect(result[0]).toEqual({ widgetId: 'w_first1', x: 0, y: 0, w: 12, h: 3 })
    expect(result[1]).toEqual({ widgetId: 'w_second', x: 0, y: 3, w: 6, h: 3 })
    expect(result[2]).toEqual({ widgetId: 'w_third3', x: 8, y: 3, w: 4, h: 3 })
  })
})
