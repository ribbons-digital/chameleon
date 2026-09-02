import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import { setLayout, setTheme } from '../../src/webmcp/tools/layout'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

async function addNotes(): Promise<[string, string]> {
  await executeTool(addWidget, { type: 'note', title: 'First' })
  await executeTool(addWidget, { type: 'note', title: 'Second' })
  const [first, second] = useBoardStore.getState().document.widgets
  return [first.id, second.id]
}

describe('set_layout', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('resolves collisions and returns the final layout', async () => {
    const [firstId, secondId] = await addNotes()
    const result = await executeTool(setLayout, {
      items: [
        { widgetId: secondId, x: 0, y: 0, w: 6, h: 4 },
      ],
      rationale: 'Put the active note first.',
    })

    expect(result.ok).toBe(true)
    expect(result.layout).toEqual([
      { widgetId: firstId, x: 0, y: 4, w: 5, h: 5 },
      { widgetId: secondId, x: 0, y: 0, w: 6, h: 4 },
    ])
  })

  it('rejects duplicate and missing widget ids', async () => {
    const [firstId] = await addNotes()
    const item = { widgetId: firstId, x: 0, y: 0, w: 4, h: 4 }
    const duplicate = await executeTool(setLayout, {
      items: [item, item],
    })
    expect((duplicate.error as { code: string }).code).toBe('DUPLICATE_ID')

    const missing = await executeTool(setLayout, {
      items: [
        { widgetId: 'w_missing1', x: 0, y: 0, w: 4, h: 4 },
      ],
    })
    expect((missing.error as { code: string }).code).toBe(
      'WIDGET_NOT_FOUND',
    )
  })
})

describe('set_theme', () => {
  beforeEach(() => {
    resetBoard(emptyBoard())
  })

  it('updates the title and complete theme state', async () => {
    const result = await executeTool(setTheme, {
      boardTitle: 'Health log',
      theme: 'matcha',
      mode: 'dark',
      density: 'compact',
      rationale: 'Match the health tracking context.',
    })
    expect(result).toMatchObject({
      ok: true,
      boardTitle: 'Health log',
      theme: {
        name: 'matcha',
        mode: 'dark',
        density: 'compact',
      },
    })
  })

  it('returns NO_CHANGES for omitted or identical values', async () => {
    const omitted = await executeTool(setTheme, {})
    expect((omitted.error as { code: string }).code).toBe('NO_CHANGES')
    const current = useBoardStore.getState().document.theme
    const identical = await executeTool(setTheme, {
      theme: current.name,
      mode: current.mode,
      density: current.density,
    })
    expect((identical.error as { code: string }).code).toBe('NO_CHANGES')
  })

  it('summarises a title-only change as a rename', async () => {
    await executeTool(setTheme, { boardTitle: 'Wedding, June 2027' })
    expect(useBoardStore.getState().commands.at(-1)?.summary).toBe(
      'Renamed board to “Wedding, June 2027”',
    )
    await executeTool(setTheme, { mode: 'dark' })
    expect(useBoardStore.getState().commands.at(-1)?.summary).toBe(
      'Set theme to neutral dark comfortable',
    )
  })
})
