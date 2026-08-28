import type { BoardDocument } from '../src/model/types'
import { initialDocument, useBoardStore } from '../src/store/boardStore'
import type { RegisterableTool } from '../src/webmcp/modelContext'

export async function executeTool(
  tool: RegisterableTool,
  input: unknown = {},
) {
  const result = await tool.execute(input as never)
  const payload =
    result &&
    typeof result === 'object' &&
    'content' in result &&
    Array.isArray((result as { content: unknown }).content)
      ? (result as { content: Array<{ type: string; text: string }> }).content[0]
          ?.text
      : undefined
  if (typeof payload !== 'string') {
    throw new Error('Tool did not return MCP text content')
  }
  return JSON.parse(payload) as Record<string, unknown>
}

export function resetBoard(document: BoardDocument = initialDocument) {
  localStorage.clear()
  useBoardStore.setState({
    document: structuredClone(document),
    commands: [],
    hydrated: true,
  })
}

export function emptyBoard(): BoardDocument {
  const document = structuredClone(initialDocument)
  document.widgets = []
  document.stateVersion = 0
  document.mintedTools = []
  document.humanEditsSinceLastDescribe = 0
  return document
}
