import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '../../src/store/boardStore'
import { bootWebmcp, resetBootForTests } from '../../src/webmcp/boot'
import {
  makeMintedTool,
  syncMintedRegistry,
} from '../../src/webmcp/minted'
import { ToolRegistry } from '../../src/webmcp/registry'
import { bindData } from '../../src/webmcp/tools/data'
import { createFormTool } from '../../src/webmcp/tools/mint'
import { undoBoard } from '../../src/webmcp/tools/undo'
import { addWidget, removeWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'
import { FakeModelContext } from './fake-model-context'

const description =
  'Records one blood sugar reading in mg/dL. Example: log a reading of 104.'

async function settleRegistry(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function createMintedForm(): Promise<{
  widgetId: string
  toolName: string
}> {
  await executeTool(addWidget, {
    type: 'form',
    title: 'Blood sugar log',
    fields: [
      {
        key: 'reading',
        label: 'Blood sugar',
        type: 'number',
        required: true,
      },
    ],
  })
  const widgetId = useBoardStore.getState().document.widgets[0].id
  const toolName = 'log_blood_sugar'
  await executeTool(createFormTool, {
    widgetId,
    toolName,
    description,
  })
  await settleRegistry()
  return { widgetId, toolName }
}

describe('minted tool lifecycle', () => {
  let registry: ToolRegistry

  beforeEach(async () => {
    resetBootForTests()
    resetBoard(emptyBoard())
    registry = new ToolRegistry(new FakeModelContext())
    await bootWebmcp(registry)
  })

  it('mints, executes, and appends one validated row', async () => {
    const { widgetId, toolName } = await createMintedForm()
    const result = await executeTool(registry.get(toolName)!, {
      reading: 104,
    })
    expect(result).toMatchObject({
      ok: true,
      widgetId,
      message: 'Logged to "Blood sugar log" (1 rows total).',
    })
    expect(
      useBoardStore.getState().document.widgets[0].dataset?.rows[0].reading,
    ).toBe(104)
  })

  it('re-registers with new fields after bind_data', async () => {
    const { widgetId, toolName } = await createMintedForm()
    const before = registry.get(toolName)
    await executeTool(bindData, {
      widgetId,
      fields: [
        {
          key: 'meal',
          label: 'Meal',
          type: 'select',
          required: true,
          options: ['breakfast', 'lunch'],
        },
      ],
    })
    await settleRegistry()

    const after = registry.get(toolName)
    expect(after).not.toBe(before)
    expect(after?.description).toMatch(/Schema updated/)
    const oldInput = await executeTool(after!, { reading: 104 })
    expect((oldInput.error as { code: string }).code).toBe('INVALID_INPUT')
    expect((await executeTool(after!, { meal: 'lunch' })).ok).toBe(true)
  })

  it('unregisters on widget removal and restores on undo', async () => {
    const { widgetId, toolName } = await createMintedForm()
    await executeTool(removeWidget, { widgetId })
    await settleRegistry()
    expect(registry.has(toolName)).toBe(false)

    await executeTool(undoBoard, {})
    await settleRegistry()
    expect(registry.has(toolName)).toBe(true)
  })

  it('registers persisted tools on a simulated reload', async () => {
    const { toolName } = await createMintedForm()
    const persisted = JSON.parse(
      localStorage.getItem('chameleon-board-v1') ?? '{}',
    ) as { state?: { document?: ReturnType<typeof emptyBoard> } }
    const document =
      persisted.state?.document ??
      structuredClone(useBoardStore.getState().document)

    resetBootForTests()
    resetBoard(document)
    const reloaded = new ToolRegistry(new FakeModelContext())
    await bootWebmcp(reloaded)

    expect(reloaded.has(toolName)).toBe(true)
  })

  it('drops a persisted tool whose form is missing', async () => {
    const document = emptyBoard()
    document.mintedTools.push({
      toolName: 'log_broken',
      widgetId: 'w_missing1',
      description: 'Records one entry for a form that no longer exists.',
      createdAt: new Date().toISOString(),
    })
    const isolated = new ToolRegistry(undefined)
    const result = await syncMintedRegistry(isolated, document)
    expect(result.dropped).toEqual(['log_broken'])
    expect(isolated.has('log_broken')).toBe(false)
  })

  it('builds minted handlers that reject a removed form', async () => {
    const { widgetId } = await createMintedForm()
    const record = useBoardStore.getState().document.mintedTools[0]
    const widget = useBoardStore.getState().document.widgets[0]
    if (!record || widget.type !== 'form') throw new Error('Fixture failed')
    const stale = makeMintedTool(record, widget.dataset.fields)
    await executeTool(removeWidget, { widgetId })
    const result = await executeTool(stale, { reading: 88 })
    expect((result.error as { code: string }).code).toBe('WIDGET_NOT_FOUND')
  })
})
