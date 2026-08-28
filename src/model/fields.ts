import { z } from 'zod'
import type { Field } from './types'

export const fieldSchema = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,39}$/)
      .describe('Stable snake_case identity for this field.'),
    label: z.string().min(1).max(60).describe('Display name shown on the widget.'),
    type: z
      .enum(['text', 'number', 'date', 'select', 'boolean', 'url'])
      .describe('Value type. select requires options; other types forbid options.'),
    required: z.boolean().default(false),
    options: z
      .array(z.string().min(1))
      .min(1)
      .max(30)
      .optional()
      .describe('Required when type is "select"; forbidden otherwise.'),
    description: z.string().max(200).optional(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.type === 'select' && !field.options) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Select fields require options.',
      })
    }
    if (field.type !== 'select' && field.options) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Only select fields can define options.',
      })
    }
    if (field.options && new Set(field.options).size !== field.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Select options must be unique.',
      })
    }
  })

export type ParsedField = z.infer<typeof fieldSchema>

export const CHECKLIST_FIELDS: Field[] = [
  { key: 'text', label: 'Item', type: 'text', required: true },
  { key: 'done', label: 'Done', type: 'boolean', required: false },
  { key: 'due', label: 'Due', type: 'date', required: false },
  { key: 'note', label: 'Note', type: 'text', required: false },
]

export function fieldsByKey(fields: Field[]): Map<string, Field> {
  return new Map(fields.map((field) => [field.key, field]))
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function coerceValue(field: Field, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined

  switch (field.type) {
    case 'text':
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      return value
    case 'number':
      if (typeof value === 'number') return value
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
      return value
    case 'date':
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10)
      }
      if (typeof value === 'string') {
        if (DATE_ONLY.test(value)) return value
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
      }
      return value
    case 'select':
      return typeof value === 'string' ? value.trim() : value
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (value === 'true') return true
      if (value === 'false') return false
      return value
    case 'url':
      return value
    default: {
      const _exhaustive: never = field.type
      return _exhaustive
    }
  }
}

export type ValueOk = { ok: true; value: unknown }
export type ValueErr = { ok: false; message: string }

export function validateValue(field: Field, value: unknown): ValueOk | ValueErr {
  const coerced = coerceValue(field, value)
  if (coerced === undefined) {
    if (field.required) {
      return { ok: false, message: `Field "${field.key}" is required.` }
    }
    return { ok: true, value: undefined }
  }

  switch (field.type) {
    case 'text':
      if (typeof coerced !== 'string') {
        return { ok: false, message: `Field "${field.key}" must be text.` }
      }
      if (coerced.length > 2000) {
        return { ok: false, message: `Field "${field.key}" must be 2000 characters or fewer.` }
      }
      return { ok: true, value: coerced }
    case 'number':
      if (typeof coerced !== 'number' || !Number.isFinite(coerced)) {
        return { ok: false, message: `Field "${field.key}" must be a finite number.` }
      }
      return { ok: true, value: coerced }
    case 'date':
      if (typeof coerced !== 'string' || !DATE_ONLY.test(coerced)) {
        return { ok: false, message: `Field "${field.key}" must be a date (yyyy-mm-dd).` }
      }
      return { ok: true, value: coerced }
    case 'select':
      if (!field.options?.includes(String(coerced))) {
        return {
          ok: false,
          message: `Field "${field.key}" must be one of: ${(field.options ?? []).join(', ')}.`,
        }
      }
      return { ok: true, value: coerced }
    case 'boolean':
      if (typeof coerced !== 'boolean') {
        return { ok: false, message: `Field "${field.key}" must be true or false.` }
      }
      return { ok: true, value: coerced }
    case 'url': {
      if (typeof coerced !== 'string') {
        return { ok: false, message: `Field "${field.key}" must be an http(s) URL.` }
      }
      try {
        const url = new URL(coerced)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { ok: false, message: `Field "${field.key}" must be an http(s) URL.` }
        }
      } catch {
        return { ok: false, message: `Field "${field.key}" must be an http(s) URL.` }
      }
      return { ok: true, value: coerced }
    }
    default: {
      const _exhaustive: never = field.type
      return _exhaustive
    }
  }
}

export type RowIssue = {
  index: number
  fieldKey?: string
  issue: string
}

export function parseRowValues(
  fields: Field[],
  values: Record<string, unknown>,
  options: { index: number; partial: boolean },
):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; issues: RowIssue[] } {
  const known = fieldsByKey(fields)
  const issues: RowIssue[] = []
  const next: Record<string, unknown> = {}

  for (const key of Object.keys(values)) {
    if (!known.has(key)) {
      issues.push({
        index: options.index,
        fieldKey: key,
        issue: `Unknown field key "${key}".`,
      })
    }
  }

  for (const field of fields) {
    if (options.partial && !Object.prototype.hasOwnProperty.call(values, field.key)) {
      continue
    }
    const raw = values[field.key]
    const result = validateValue(field, raw)
    if (!result.ok) {
      issues.push({
        index: options.index,
        fieldKey: field.key,
        issue: result.message,
      })
      continue
    }
    if (result.value !== undefined) next[field.key] = result.value
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, values: next }
}
