import { beforeEach, describe, expect, it } from 'vitest'
import { makeTool } from '../../src/webmcp/makeTool'
import { ToolRegistry, NameTakenError } from '../../src/webmcp/registry'
import { ok } from '../../src/webmcp/result'
import { z } from 'zod'
import {
  FakeModelContext,
  FakeModelContextWithUnregister,
  StringSchemaModelContext,
} from './fake-model-context'

const ping = makeTool({
  name: 'ping',
  description: 'Ping the board.',
  input: z.object({ n: z.number().optional() }).strict(),
  handler: () => ok({ pong: true }),
})

const pong = makeTool({
  name: 'pong',
  description: 'Pong the board.',
  input: z.object({}).strict(),
  handler: () => ok({ ping: true }),
})

describe('ToolRegistry', () => {
  let context: FakeModelContext
  let registry: ToolRegistry

  beforeEach(() => {
    context = new FakeModelContext()
    registry = new ToolRegistry(context)
  })

  it('registers a tool and honors AbortSignal removal', async () => {
    await registry.register(ping)
    expect(context.tools.has('ping')).toBe(true)
    expect(registry.has('ping')).toBe(true)

    registry.unregister('ping')
    expect(context.tools.has('ping')).toBe(false)
    expect(registry.has('ping')).toBe(false)
  })

  it('throws NameTakenError on colliding names before calling the host', async () => {
    await registry.register(ping)
    await expect(registry.register(ping)).rejects.toBeInstanceOf(NameTakenError)
    expect(context.registerCalls).toBe(1)
  })

  it('treats host duplicate errors as NameTakenError', async () => {
    await context.registerTool(ping)
    await expect(registry.register(ping)).rejects.toBeInstanceOf(NameTakenError)
  })

  it('tracks definitions when ModelContext is missing', async () => {
    const unhosted = new ToolRegistry(undefined)
    await unhosted.register(ping)
    expect(unhosted.has('ping')).toBe(true)
    expect(unhosted.get('ping')?.description).toContain('Ping')
  })

  it('calls unregisterTool as a fallback after aborting', async () => {
    const host = new FakeModelContextWithUnregister()
    const withFallback = new ToolRegistry(host)
    await withFallback.register(ping)
    withFallback.unregister('ping')
    expect(host.unregisterCalls).toEqual(['ping'])
    expect(host.tools.has('ping')).toBe(false)
  })

  it('retries with a string schema when the host rejects objects', async () => {
    const host = new StringSchemaModelContext()
    const compatible = new ToolRegistry(host)
    await compatible.register(ping)
    const stored = host.tools.get('ping')
    expect(typeof stored?.inputSchema).toBe('string')
    expect(compatible.schemaEncoding).toBe('string')
  })

  it('replace unregisters then registers', async () => {
    await registry.register(ping)
    const replacement = makeTool({
      name: 'ping',
      description: 'Updated ping.',
      input: z.object({ n: z.number() }).strict(),
      handler: () => ok({ pong: true }),
    })
    await registry.replace(replacement)
    expect(context.tools.get('ping')?.description).toBe('Updated ping.')
  })

  it('does not register when the abort signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await context.registerTool(pong, { signal: controller.signal })
    expect(context.tools.has('pong')).toBe(false)
  })
})
