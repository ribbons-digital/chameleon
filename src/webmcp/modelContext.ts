import type {
  InputSchema,
  ModelContext,
  ModelContextRegisterToolOptions,
  ModelContextTool,
} from '@mcp-b/webmcp-types'

export type ModelContextSource = 'document' | 'navigator' | undefined

export type DetectedModelContext = {
  context: ModelContext | undefined
  source: ModelContextSource
}

function readContext(
  holder: object | undefined,
  key: 'modelContext',
): ModelContext | undefined {
  if (!holder || !(key in holder)) return undefined
  const value = (holder as { modelContext?: ModelContext }).modelContext
  return value
}

export function detectModelContext(
  doc: Document | undefined = typeof document === 'undefined'
    ? undefined
    : document,
  nav: Navigator | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator,
): DetectedModelContext {
  const fromDocument = readContext(doc, 'modelContext')
  if (fromDocument) {
    return { context: fromDocument, source: 'document' }
  }
  const fromNavigator = readContext(nav, 'modelContext')
  if (fromNavigator) {
    return { context: fromNavigator, source: 'navigator' }
  }
  return { context: undefined, source: undefined }
}

export function getModelContext(): ModelContext | undefined {
  return detectModelContext().context
}

export function getModelContextSource(): ModelContextSource {
  return detectModelContext().source
}

type ContextWithLegacyUnregister = ModelContext & {
  unregisterTool?: (name: string) => void
}

export type RegisterableTool = Pick<
  ModelContextTool,
  'name' | 'description' | 'execute'
> & {
  inputSchema: InputSchema
}

function looksLikeSchemaTypeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /inputSchema|json schema|string/i.test(message)
}

/**
 * Compatibility adapter around `registerTool`.
 *
 * Canonical call: object JSON Schema + AbortSignal, matching the April 2026
 * draft and `@mcp-b/webmcp-types`. If a runtime rejects the object schema
 * (Chrome 149–153 still *returned* schemas as strings from getTools; some
 * polyfills mirrored that on register), retry once with a serialized schema
 * rather than changing handler behavior.
 */
export async function registerToolCompatible(
  context: ModelContext,
  tool: RegisterableTool,
  options: ModelContextRegisterToolOptions,
): Promise<'object' | 'string'> {
  try {
    await context.registerTool(tool, options)
    return 'object'
  } catch (error) {
    if (!looksLikeSchemaTypeError(error)) throw error
    const serialized: RegisterableTool = {
      ...tool,
      inputSchema: JSON.stringify(tool.inputSchema) as unknown as InputSchema,
    }
    await context.registerTool(serialized, options)
    return 'string'
  }
}

export function unregisterToolFallback(
  context: ModelContext | undefined,
  name: string,
): void {
  const unregister = (context as ContextWithLegacyUnregister | undefined)
    ?.unregisterTool
  if (typeof unregister === 'function') {
    try {
      unregister.call(context, name)
    } catch {
      // Harmless if the implementation is gone or the tool is already absent.
    }
  }
}

export const WEBMCP_ENABLE_HINT =
  'WebMCP is not available in this browser. Open this page in ChatGPT’s desktop-app browser, or Chrome Canary with chrome://flags → search "webmcp" (currently #enable-webmcp-testing) enabled, then reload.'
