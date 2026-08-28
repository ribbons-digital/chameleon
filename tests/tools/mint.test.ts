import { beforeEach, describe, expect, it } from 'vitest'
import { LIMITS } from '../../src/model/limits'
import { useBoardStore } from '../../src/store/boardStore'
import { bootWebmcp, resetBootForTests } from '../../src/webmcp/boot'
import { ToolRegistry } from '../../src/webmcp/registry'
import {
  createFormTool,
  removeMintedTool,
} from '../../src/webmcp/tools/mint'
import { addWidget } from '../../src/webmcp/tools/widgets'
import { emptyBoard, executeTool, resetBoard } from '../helpers'

const fields = [
  { key: 'reading', label: 'Reading', type: 'number', required: true },
  {
    key: 'context',
    label: 'Context',
    type: 'select',
    options: ['fasting', 'after_meal'],
  },
] as const

async function addForm(withFields = true): Promise<string> {
  await executeTool(addWidget, {
    type: 'form',
    title: 'Blood sugar',
    fields: withFields ? fields : undefined,
  })
  return useBoardStore.getState().document.widgets.at(-1)?.id ?? ''
}

describe('create_form_tool', () => {
  let registry: ToolRegistry

  beforeEach(async () => {
    resetBootForTests()
    resetBoard(emptyBoard())
    registry = new ToolRegistry(undefined)
    await bootWebmcp(registry)
  })

  it('mints a live tool with a derived schema', async () => {
    const widgetId = await addForm()
    const result = await executeTool(createFormTool, {
      widgetId,
      toolName: 'log_blood_sugar',
      description:
        'Records one blood sugar reading with reading and context fields. Example: log 104 after a meal.',
    })

    expect(result).toMatchObject({
      ok: true,
      toolName: 'log_blood_sugar',
      widgetId,
    })
    expect(result.inputSchema).toMatchObject({
      type: 'object',
      required: ['reading'],
      additionalProperties: false,
    })
    expect(registry.has('log_blood_sugar')).toBe(true)
  })

  it('rejects missing, wrong-type, and unbound widgets', async () => {
    const missing = await executeTool(createFormTool, {
      widgetId: 'w_missing1',
      toolName: 'log_missing',
      description: 'Records one missing form submission for lifecycle testing.',
    })
    expect((missing.error as { code: string }).code).toBe('WIDGET_NOT_FOUND')

    await executeTool(addWidget, { type: 'table', title: 'Table' })
    const tableId = useBoardStore.getState().document.widgets.at(-1)?.id
    const wrongType = await executeTool(createFormTool, {
      widgetId: tableId,
      toolName: 'log_table',
      description: 'Records one table submission for lifecycle testing only.',
    })
    expect((wrongType.error as { code: string }).code).toBe(
      'WRONG_WIDGET_TYPE',
    )

    const formId = await addForm(false)
    const unbound = await executeTool(createFormTool, {
      widgetId: formId,
      toolName: 'log_empty_form',
      description: 'Records one empty form submission for lifecycle testing.',
    })
    expect((unbound.error as { code: string }).code).toBe('NO_FIELDS_BOUND')
  })

  it('rejects reserved and duplicate names', async () => {
    const widgetId = await addForm()
    const reserved = await executeTool(createFormTool, {
      widgetId,
      toolName: 'add_rows',
      description: 'Records one submission with the reserved static tool name.',
    })
    expect((reserved.error as { code: string }).code).toBe('RESERVED_NAME')

    const input = {
      widgetId,
      toolName: 'log_reading',
      description:
        'Records one reading with its context. Example: log reading 104 fasting.',
    }
    expect((await executeTool(createFormTool, input)).ok).toBe(true)
    const duplicate = await executeTool(createFormTool, input)
    expect((duplicate.error as { code: string }).code).toBe('NAME_TAKEN')
    expect(
      (duplicate.error as { details: { existingKind: string } }).details
        .existingKind,
    ).toBe('minted')
  })

  it('enforces the board minted-tool limit', async () => {
    const widgetId = await addForm()
    useBoardStore.setState((state) => ({
      document: {
        ...state.document,
        mintedTools: Array.from(
          { length: LIMITS.mintedTools },
          (_, index) => ({
            toolName: `log_entry_${index}`,
            widgetId,
            description: `Records entry ${index} with the current form fields.`,
            createdAt: new Date().toISOString(),
          }),
        ),
      },
    }))

    const result = await executeTool(createFormTool, {
      widgetId,
      toolName: 'log_overflow',
      description: 'Records one submission after the minted tool limit is full.',
    })
    expect((result.error as { code: string }).code).toBe('LIMIT_EXCEEDED')
  })
})

describe('remove_minted_tool', () => {
  beforeEach(async () => {
    resetBootForTests()
    resetBoard(emptyBoard())
    await bootWebmcp(new ToolRegistry(undefined))
  })

  it('removes only the minted tool', async () => {
    const widgetId = await addForm()
    await executeTool(createFormTool, {
      widgetId,
      toolName: 'log_reading',
      description:
        'Records one reading with its context. Example: log reading 104 fasting.',
    })
    const result = await executeTool(removeMintedTool, {
      toolName: 'log_reading',
    })
    expect(result).toMatchObject({
      ok: true,
      removedToolName: 'log_reading',
    })
    expect(useBoardStore.getState().document.widgets).toHaveLength(1)
    expect(useBoardStore.getState().document.mintedTools).toEqual([])
  })

  it('returns TOOL_NOT_FOUND for an unknown name', async () => {
    const result = await executeTool(removeMintedTool, {
      toolName: 'log_unknown',
    })
    expect((result.error as { code: string }).code).toBe('TOOL_NOT_FOUND')
  })
})
