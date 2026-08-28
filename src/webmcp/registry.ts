import type { ModelContext } from '@mcp-b/webmcp-types'
import {
  registerToolCompatible,
  unregisterToolFallback,
  type RegisterableTool,
} from './modelContext'

export class NameTakenError extends Error {
  readonly toolName: string
  constructor(toolName: string) {
    super(`A tool named "${toolName}" is already registered.`)
    this.name = 'NameTakenError'
    this.toolName = toolName
  }
}

type LiveRegistration = {
  controller: AbortController
  def: RegisterableTool
  schemaEncoding: 'object' | 'string' | 'unhosted'
}

export class ToolRegistry {
  private readonly live = new Map<string, LiveRegistration>()
  private readonly context: ModelContext | undefined
  schemaEncoding: 'object' | 'string' | 'unhosted' | undefined
  lastRegisterError: unknown

  constructor(context: ModelContext | undefined) {
    this.context = context
  }

  get size(): number {
    return this.live.size
  }

  names(): string[] {
    return [...this.live.keys()]
  }

  get(name: string): RegisterableTool | undefined {
    return this.live.get(name)?.def
  }

  has(name: string): boolean {
    return this.live.has(name)
  }

  async register(def: RegisterableTool): Promise<void> {
    if (this.live.has(def.name)) {
      throw new NameTakenError(def.name)
    }
    const controller = new AbortController()
    if (controller.signal.aborted) {
      return
    }
    if (!this.context) {
      this.live.set(def.name, { controller, def, schemaEncoding: 'unhosted' })
      this.schemaEncoding = 'unhosted'
      return
    }
    try {
      const encoding = await registerToolCompatible(this.context, def, {
        signal: controller.signal,
      })
      this.schemaEncoding = encoding
      this.live.set(def.name, { controller, def, schemaEncoding: encoding })
      controller.signal.addEventListener(
        'abort',
        () => {
          this.live.delete(def.name)
        },
        { once: true },
      )
    } catch (error) {
      this.lastRegisterError = error
      const message = error instanceof Error ? error.message : String(error)
      if (/already|duplicate|taken|exists/i.test(message)) {
        throw new NameTakenError(def.name)
      }
      throw error
    }
  }

  unregister(name: string): boolean {
    const live = this.live.get(name)
    if (!live) return false
    live.controller.abort()
    unregisterToolFallback(this.context, name)
    this.live.delete(name)
    return true
  }

  async replace(def: RegisterableTool): Promise<void> {
    this.unregister(def.name)
    await this.register(def)
  }

  unregisterAll(): void {
    for (const name of [...this.live.keys()]) {
      this.unregister(name)
    }
  }
}
