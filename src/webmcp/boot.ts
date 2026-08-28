import { ToolRegistry } from './registry'
import {
  detectModelContext,
  WEBMCP_ENABLE_HINT,
  type ModelContextSource,
} from './modelContext'
import { DAY2_STATIC_TOOLS } from './tools'

export type BootResult = {
  registry: ToolRegistry
  source: ModelContextSource
  registered: string[]
  hosted: boolean
}

let booted: BootResult | undefined

export function getBootResult(): BootResult | undefined {
  return booted
}

export async function bootWebmcp(
  registry = new ToolRegistry(detectModelContext().context),
): Promise<BootResult> {
  if (booted && booted.registry === registry) {
    return booted
  }

  const { source } = detectModelContext()
  const registered: string[] = []

  for (const tool of DAY2_STATIC_TOOLS) {
    if (registry.has(tool.name)) continue
    await registry.register(tool)
    registered.push(tool.name)
  }

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
  booted = undefined
}
