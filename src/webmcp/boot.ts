import { useBoardStore } from '../store/boardStore'
import { ToolRegistry } from './registry'
import {
  detectModelContext,
  WEBMCP_ENABLE_HINT,
  type ModelContextSource,
} from './modelContext'
import { syncMintedRegistry, watchMintedTools } from './minted'
import { STATIC_TOOLS } from './tools'

export type BootResult = {
  registry: ToolRegistry
  source: ModelContextSource
  registered: string[]
  hosted: boolean
}

let booted: BootResult | undefined
let stopWatchingMintedTools: (() => void) | undefined

export async function bootWebmcp(
  registry = new ToolRegistry(detectModelContext().context),
): Promise<BootResult> {
  if (booted && booted.registry === registry) {
    return booted
  }
  stopWatchingMintedTools?.()

  const { source } = detectModelContext()

  for (const tool of STATIC_TOOLS) {
    if (registry.has(tool.name)) continue
    await registry.register(tool)
  }
  await syncMintedRegistry(registry, useBoardStore.getState().document)
  stopWatchingMintedTools = watchMintedTools(registry)

  const hosted = Boolean(source)
  if (!hosted) {
    console.info(`[chameleon] ${WEBMCP_ENABLE_HINT}`)
  } else {
    console.info(
      `[chameleon] WebMCP tools registered via ${source}.modelContext: ${registry.names().join(', ')}`,
    )
  }

  booted = {
    registry,
    source,
    registered: registry.names(),
    hosted,
  }
  return booted
}

export function resetBootForTests(): void {
  stopWatchingMintedTools?.()
  stopWatchingMintedTools = undefined
  booted = undefined
}
