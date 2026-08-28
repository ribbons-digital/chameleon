import { z } from 'zod'
import { fieldSchema } from '../model/fields'
import { uniqueFieldKeys } from '../model/migrate'
import type {
  BoardDocument,
  Field,
  MintedToolRecord,
} from '../model/types'
import { appendRows } from '../store/submit'
import { useBoardStore } from '../store/boardStore'
import { makeTool } from './makeTool'
import type { RegisterableTool } from './modelContext'
import { ToolRegistry } from './registry'
import { err, ok } from './result'
import { STATIC_TOOL_NAMES } from './staticToolNames'

export const RESERVED_TOOL_NAMES = new Set<string>([
  ...STATIC_TOOL_NAMES,
  'undo',
  'redo',
  'help',
])

export function isReservedToolName(name: string): boolean {
  return name.startsWith('chameleon_') || RESERVED_TOOL_NAMES.has(name)
}

function schemaForField(field: Field): z.ZodType {
  let schema: z.ZodType
  switch (field.type) {
    case 'text':
      schema = z.string().max(2000)
      break
    case 'number':
      schema = z.number()
      break
    case 'date':
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      break
    case 'select': {
      const [first, ...rest] = field.options ?? []
      schema = first ? z.enum([first, ...rest]) : z.string()
      break
    }
    case 'boolean':
      schema = z.boolean()
      break
    case 'url':
      schema = z.string().url()
      break
    default: {
      const _exhaustive: never = field.type
      return _exhaustive
    }
  }
  const description = [field.label, field.description]
    .filter((part) => Boolean(part))
    .join('. ')
  const described = schema.describe(description)
  return field.required ? described : described.optional()
}

export function deriveSubmissionSchema(fields: Field[]): z.ZodObject {
  const shape: Record<string, z.ZodType> = {}
  for (const field of fields) {
    shape[field.key] = schemaForField(field)
  }
  return z.object(shape).strict()
}

export function makeMintedTool(
  record: MintedToolRecord,
  fields: Field[],
): RegisterableTool {
  return makeTool({
    name: record.toolName,
    description: record.description,
    input: deriveSubmissionSchema(fields),
    handler: (input) => {
      const widget = useBoardStore
        .getState()
        .document.widgets.find(
          (candidate) => candidate.id === record.widgetId,
        )
      if (!widget) {
        return err(
          'WIDGET_NOT_FOUND',
          `No widget has id "${record.widgetId}".`,
        )
      }
      if (widget.type !== 'form') {
        return err(
          'WRONG_WIDGET_TYPE',
          `Widget "${widget.title}" is not a form.`,
        )
      }
      const added = appendRows(
        widget.id,
        [input],
        'agent',
        `Logged to “${widget.title}”`,
      )
      if (!added.ok) {
        return err(added.code, added.message, added.details)
      }
      return ok({
        rowId: added.rowIds[0],
        widgetId: widget.id,
        message: `Logged to "${widget.title}" (${added.rowCount} rows total).`,
      })
    },
  })
}

const managedNames = new WeakMap<ToolRegistry, Set<string>>()
let activeRegistry: ToolRegistry | undefined
let watchQueue: Promise<void> = Promise.resolve()

export function awaitMintedSync(): Promise<void> {
  return watchQueue.then(() => undefined)
}

export function registeredToolKind(
  name: string,
): 'static' | 'minted' | undefined {
  if (!activeRegistry?.has(name)) return undefined
  return useBoardStore
    .getState()
    .document.mintedTools.some((record) => record.toolName === name)
    ? 'minted'
    : 'static'
}

function mintedDefinitions(document: BoardDocument): {
  definitions: Map<string, RegisterableTool>
  dropped: string[]
} {
  const definitions = new Map<string, RegisterableTool>()
  const dropped: string[] = []
  for (const record of document.mintedTools) {
    if (definitions.has(record.toolName) || isReservedToolName(record.toolName)) {
      dropped.push(record.toolName)
      console.info(
        `[chameleon] Dropped invalid persisted tool "${record.toolName}".`,
      )
      continue
    }
    const widget = document.widgets.find(
      (candidate) => candidate.id === record.widgetId,
    )
    const fieldsAreValid =
      widget?.type === 'form' &&
      widget.dataset.fields.length > 0 &&
      widget.dataset.fields.every(
        (field) => fieldSchema.safeParse(field).success,
      ) &&
      uniqueFieldKeys(widget.dataset.fields) === undefined
    if (!widget || widget.type !== 'form' || !fieldsAreValid) {
      dropped.push(record.toolName)
      console.info(
        `[chameleon] Dropped tool "${record.toolName}" because its form is unavailable.`,
      )
      continue
    }
    definitions.set(
      record.toolName,
      makeMintedTool(record, widget.dataset.fields),
    )
  }
  return { definitions, dropped }
}

function sameDefinition(
  left: RegisterableTool | undefined,
  right: RegisterableTool,
): boolean {
  return (
    left?.description === right.description &&
    JSON.stringify(left.inputSchema) === JSON.stringify(right.inputSchema)
  )
}

export async function syncMintedRegistry(
  registry: ToolRegistry,
  document: BoardDocument,
): Promise<{ dropped: string[] }> {
  const previous = managedNames.get(registry) ?? new Set<string>()
  const { definitions, dropped } = mintedDefinitions(document)

  for (const name of previous) {
    if (!definitions.has(name)) {
      registry.unregister(name)
    }
  }

  const nextManaged = new Set<string>()
  for (const [name, definition] of definitions) {
    if (registry.has(name) && !previous.has(name)) {
      dropped.push(name)
      console.info(
        `[chameleon] Dropped tool "${name}" because that name is already registered.`,
      )
      continue
    }
    try {
      if (!registry.has(name)) {
        await registry.register(definition)
      } else if (!sameDefinition(registry.get(name), definition)) {
        await registry.replace(definition)
      }
      nextManaged.add(name)
    } catch {
      dropped.push(name)
      console.info(
        `[chameleon] Dropped tool "${name}" because registration failed.`,
      )
    }
  }
  managedNames.set(registry, nextManaged)
  return { dropped }
}

function mintedSignature(document: BoardDocument): string {
  const forms = document.widgets
    .filter((widget) => widget.type === 'form')
    .map((widget) => ({
      id: widget.id,
      fields: widget.dataset.fields,
    }))
  return JSON.stringify({ mintedTools: document.mintedTools, forms })
}

export function watchMintedTools(registry: ToolRegistry): () => void {
  activeRegistry = registry
  let signature = mintedSignature(useBoardStore.getState().document)
  let active = true
  const unsubscribe = useBoardStore.subscribe((state) => {
    const nextSignature = mintedSignature(state.document)
    if (nextSignature === signature) return
    signature = nextSignature
    const document = state.document
    watchQueue = watchQueue
      .then(async () => {
        if (active) await syncMintedRegistry(registry, document)
      })
      .catch(() => undefined)
  })
  return () => {
    active = false
    unsubscribe()
    if (activeRegistry === registry) activeRegistry = undefined
  }
}
