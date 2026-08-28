import type {
  ModelContext,
  ModelContextRegisterToolOptions,
  ModelContextTool,
  RegisteredTool,
} from '@mcp-b/webmcp-types'

type StoredTool = ModelContextTool & { name: string }

export class FakeModelContext extends EventTarget implements ModelContext {
  readonly tools = new Map<string, StoredTool>()
  ontoolchange: ModelContext['ontoolchange'] = null
  registerCalls = 0

  async registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions,
  ): Promise<void> {
    this.registerCalls += 1
    const name = tool.name
    if (this.tools.has(name)) {
      throw new Error(`Duplicate tool registration: ${name}`)
    }
    const signal = options?.signal
    if (signal?.aborted) {
      return
    }
    this.tools.set(name, tool as StoredTool)
    signal?.addEventListener(
      'abort',
      () => {
        this.tools.delete(name)
      },
      { once: true },
    )
  }

  async getTools(): Promise<RegisteredTool[]> {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      window: globalThis as unknown as Window,
      origin: 'https://chameleon.test',
    }))
  }
}

export class FakeModelContextWithUnregister extends FakeModelContext {
  unregisterCalls: string[] = []

  unregisterTool(name: string): void {
    this.unregisterCalls.push(name)
    this.tools.delete(name)
  }
}

export class StringSchemaModelContext extends FakeModelContext {
  override async registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions,
  ): Promise<void> {
    if (tool.inputSchema && typeof tool.inputSchema !== 'string') {
      throw new TypeError('inputSchema must be a JSON string')
    }
    return super.registerTool(tool, options)
  }
}
