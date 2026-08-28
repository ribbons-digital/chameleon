import { describe, expect, it } from 'vitest'
import {
  detectModelContext,
  registerToolCompatible,
} from '../../src/webmcp/modelContext'
import { makeTool } from '../../src/webmcp/makeTool'
import { ok } from '../../src/webmcp/result'
import { z } from 'zod'
import {
  FakeModelContext,
  StringSchemaModelContext,
} from './fake-model-context'

const probe = makeTool({
  name: 'probe',
  description: 'Probe tool.',
  input: z.object({}).strict(),
  handler: () => ok({}),
})

describe('modelContext detection', () => {
  it('prefers document.modelContext over navigator.modelContext', () => {
    const documentContext = new FakeModelContext()
    const navigatorContext = new FakeModelContext()
    const doc = {
      modelContext: documentContext,
    } as unknown as Document
    const nav = {
      modelContext: navigatorContext,
    } as unknown as Navigator

    const detected = detectModelContext(doc, nav)
    expect(detected.source).toBe('document')
    expect(detected.context).toBe(documentContext)
  })

  it('falls back to navigator.modelContext when document is empty', () => {
    const navigatorContext = new FakeModelContext()
    const doc = {} as Document
    const nav = { modelContext: navigatorContext } as unknown as Navigator
    const detected = detectModelContext(doc, nav)
    expect(detected.source).toBe('navigator')
    expect(detected.context).toBe(navigatorContext)
  })

  it('reports undefined when neither surface exists', () => {
    const detected = detectModelContext({} as Document, {} as Navigator)
    expect(detected.source).toBeUndefined()
    expect(detected.context).toBeUndefined()
  })

  it('retries with a serialized schema when the host requires a string', async () => {
    const host = new StringSchemaModelContext()
    const encoding = await registerToolCompatible(host, probe, {
      signal: new AbortController().signal,
    })
    expect(encoding).toBe('string')
    expect(typeof host.tools.get('probe')?.inputSchema).toBe('string')
  })
})
