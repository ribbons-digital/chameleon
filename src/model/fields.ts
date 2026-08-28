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
