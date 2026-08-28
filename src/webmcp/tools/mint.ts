import { z } from 'zod'
import { LIMITS } from '../../model/limits'
import { useBoardStore } from '../../store/boardStore'
import { mutate } from '../../store/mutate'
import {
  deriveSubmissionSchema,
  isReservedToolName,
  registeredToolKind,
} from '../minted'
import { toDraft7Schema } from '../makeTool'
import { makeTool } from '../makeTool'
import { err, ok } from '../result'
import { Rationale, WidgetId } from '../schemas'

const ToolName = z
  .string()
  .regex(/^[a-z][a-z0-9_]{2,49}$/)
  .describe(
    'snake_case verb phrase, e.g. "log_blood_sugar". Must not collide with an existing tool.',
  )

export const CreateFormToolInput = z
  .object({
    widgetId: WidgetId.describe(
      'Must be a form widget with at least one bound field.',
    ),
    toolName: ToolName,
    description: z
      .string()
      .min(20)
      .max(500)
      .describe(
        'Written for the next agent. Say what one call records, name the fields and units or options, and give one example invocation in prose.',
      ),
    rationale: Rationale,
  })
  .strict()

export const RemoveMintedToolInput = z
  .object({
    toolName: ToolName,
    rationale: Rationale,
  })
  .strict()

export const createFormTool = makeTool({
  name: 'create_form_tool',
  description:
    'Mints a persistent tool from a form widget. Prefer this when the user will log the same entry repeatedly; use add_rows for one-off or batch data. The input schema mirrors current form fields and re-registers when fields change. Choose a verb_noun name such as log_blood_sugar. Each call adds one validated row. The tool survives reloads until the form is deleted or remove_minted_tool is called. Returns the generated input schema.',
  input: CreateFormToolInput,
  handler: (input) => {
    const state = useBoardStore.getState()
    if (isReservedToolName(input.toolName)) {
      return err(
        'RESERVED_NAME',
        `Tool name "${input.toolName}" is reserved by the app.`,
      )
    }
    const persisted = state.document.mintedTools.find(
      (record) => record.toolName === input.toolName,
    )
    if (persisted) {
      return err(
        'NAME_TAKEN',
        `A minted tool named "${input.toolName}" already exists.`,
        { existingKind: 'minted' },
      )
    }
    const liveKind = registeredToolKind(input.toolName)
    if (liveKind) {
      return err(
        'NAME_TAKEN',
        `A tool named "${input.toolName}" is already registered.`,
        { existingKind: liveKind },
      )
    }
    const widget = state.document.widgets.find(
      (candidate) => candidate.id === input.widgetId,
    )
    if (!widget) {
      return err('WIDGET_NOT_FOUND', `No widget has id "${input.widgetId}".`)
    }
    if (widget.type !== 'form') {
      return err(
        'WRONG_WIDGET_TYPE',
        `Widget "${widget.title}" is not a form. Only form widgets can mint tools.`,
      )
    }
    if (widget.dataset.fields.length === 0) {
      return err(
        'NO_FIELDS_BOUND',
        `Form "${widget.title}" has no field schema yet.`,
      )
    }
    if (state.document.mintedTools.length >= LIMITS.mintedTools) {
      return err(
        'LIMIT_EXCEEDED',
        `A board can have at most ${LIMITS.mintedTools} minted tools.`,
        {
          limit: 'mintedTools',
          maximum: LIMITS.mintedTools,
        },
      )
    }

    const createdAt = new Date().toISOString()
    mutate(
      {
        actor: 'agent',
        action: 'create_form_tool',
        summary: `Minted ${input.toolName} from “${widget.title}”`,
        rationale: input.rationale,
      },
      (draft) => {
        draft.mintedTools.push({
          toolName: input.toolName,
          widgetId: input.widgetId,
          description: input.description,
          createdAt,
        })
      },
    )

    return ok({
      toolName: input.toolName,
      widgetId: input.widgetId,
      inputSchema: toDraft7Schema(
        deriveSubmissionSchema(widget.dataset.fields),
      ),
      note: 'Tool is registered now and will re-register on every page load.',
    })
  },
})

export const removeMintedTool = makeTool({
  name: 'remove_minted_tool',
  description:
    'Removes a tool created by create_form_tool from the live registry and persistence. Use this when the shortcut is obsolete or needs a better name. The form widget and its rows stay unchanged. Static tools cannot be removed. Returns the removed tool name.',
  input: RemoveMintedToolInput,
  handler: (input) => {
    const state = useBoardStore.getState()
    const record = state.document.mintedTools.find(
      (candidate) => candidate.toolName === input.toolName,
    )
    if (!record) {
      return err(
        'TOOL_NOT_FOUND',
        `No minted tool named "${input.toolName}" exists.`,
      )
    }
    mutate(
      {
        actor: 'agent',
        action: 'remove_minted_tool',
        summary: `Removed minted tool ${input.toolName}`,
        rationale: input.rationale,
      },
      (draft) => {
        draft.mintedTools = draft.mintedTools.filter(
          (candidate) => candidate.toolName !== input.toolName,
        )
      },
    )
    return ok({ removedToolName: input.toolName })
  },
})
