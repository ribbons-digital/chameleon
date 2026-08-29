import type { ZodError } from 'zod'
import { useBoardStore } from '../store/boardStore'

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_CONFIG'
  | 'INVALID_ROWS'
  | 'WIDGET_NOT_FOUND'
  | 'WRONG_WIDGET_TYPE'
  | 'ROW_NOT_FOUND'
  | 'NO_FIELDS_BOUND'
  | 'FIELD_NOT_FOUND'
  | 'NAME_TAKEN'
  | 'RESERVED_NAME'
  | 'NO_CHANGES'
  | 'NOTHING_TO_UNDO'
  | 'DUPLICATE_ID'
  | 'LIMIT_EXCEEDED'
  | 'TOOL_NOT_FOUND'
  | 'INTERNAL'

export const ERROR_HINTS: Record<ErrorCode, string> = {
  INVALID_INPUT:
    'Arguments failed schema validation. Read error.details, fix those fields, and retry the same tool.',
  INVALID_CONFIG:
    'This config does not match this widget type. Call describe_current_state, then pass a config for that type.',
  INVALID_ROWS:
    'One or more rows failed field validation. details lists row index, field key, and issue. Fix only those rows and retry.',
  WIDGET_NOT_FOUND:
    'No widget has this id. Call describe_current_state and use an id from that snapshot. The human may have deleted it.',
  WRONG_WIDGET_TYPE:
    'This tool does not apply to this widget type. Call describe_current_state and pick a widget of a type this tool accepts.',
  ROW_NOT_FOUND:
    'One or more rowIds do not exist in this widget. Call read_widget_data and copy ids from the current rows.',
  NO_FIELDS_BOUND:
    'This widget has no field schema yet. Call bind_data first, then add_rows.',
  FIELD_NOT_FOUND:
    'Config names a field key that is not in this widget schema. Call describe_current_state, then retry with a listed key.',
  NAME_TAKEN:
    'A tool with this name already exists. Pick a more specific name, or call remove_minted_tool first if you own it.',
  RESERVED_NAME:
    'This name is reserved by the app. Choose a different verb_noun name that is not a static tool.',
  NO_CHANGES:
    'You passed no fields to change. Include at least one property to update.',
  NOTHING_TO_UNDO:
    'The command log is empty. There is nothing to revert.',
  DUPLICATE_ID:
    'The same widgetId appears more than once in items. Each widget may appear at most once.',
  LIMIT_EXCEEDED:
    'A hard limit was hit. details names which limit and the maximum. Call remove_widget, delete_rows, or remove_minted_tool until you are under it, then retry.',
  TOOL_NOT_FOUND:
    'No minted tool has this name. describe_current_state lists minted tools. Static tools cannot be removed.',
  INTERNAL:
    'Unexpected app error. State was not changed. Call describe_current_state and retry once.',
}

export type ToolOk<T extends object = object> = {
  ok: true
  stateVersion: number
} & T

export type ToolErr = {
  ok: false
  stateVersion: number
  error: {
    code: ErrorCode
    message: string
    hint: string
    details?: unknown
  }
}

export type ToolResult<T extends object = Record<string, never>> =
  | ToolOk<T>
  | ToolErr

export function currentVersion(): number {
  return useBoardStore.getState().document.stateVersion
}

export function ok<T extends object>(payload: T, stateVersion = currentVersion()): ToolOk<T> {
  return { ok: true, stateVersion, ...payload }
}

export function err(
  code: ErrorCode,
  message: string,
  details?: unknown,
  stateVersion = currentVersion(),
): ToolErr {
  const result: ToolErr = {
    ok: false,
    stateVersion,
    error: {
      code,
      message,
      hint: ERROR_HINTS[code],
    },
  }
  if (details !== undefined) {
    result.error.details = details
  }
  return result
}

export function formatZodIssues(error: ZodError): unknown {
  return error.flatten()
}

export function safeRun(
  run: () => ToolOk<object> | ToolErr,
): ToolOk<object> | ToolErr {
  try {
    return run()
  } catch (error) {
    return err(
      'INTERNAL',
      error instanceof Error ? error.message : 'Unexpected app error.',
    )
  }
}
