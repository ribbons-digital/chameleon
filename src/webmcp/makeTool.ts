import type { InputSchema } from '@mcp-b/webmcp-types'
import { z } from 'zod'
import { err, formatZodIssues, safeRun, type ToolErr, type ToolOk } from './result'
import type { RegisterableTool } from './modelContext'

export type JsonSchema = Record<string, unknown>

export function toDraft7Schema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: 'draft-7',
    reused: 'inline',
    io: 'input',
    unrepresentable: 'any',
  }) as JsonSchema
  if (!json.$schema) {
    json.$schema = 'http://json-schema.org/draft-07/schema#'
  }
  return json
}

export function makeTool<I>(def: {
  name: string
  description: string
  input: z.ZodType<I>
  handler: (input: I) => ToolOk<object> | ToolErr
}): RegisterableTool {
  const inputSchema = toDraft7Schema(def.input) as InputSchema
  return {
    name: def.name,
    description: def.description,
    inputSchema,
    async execute(raw) {
      const parsed = def.input.safeParse(raw ?? {})
      const result = parsed.success
        ? safeRun(() => def.handler(parsed.data))
        : err('INVALID_INPUT', 'Arguments failed schema validation.', formatZodIssues(parsed.error))
      const { awaitMintedSync } = await import('./minted')
      await awaitMintedSync()
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  }
}
