import { z } from 'zod'

export const fieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: z.string().min(1).max(60),
    type: z.enum(['text', 'number', 'date', 'select', 'boolean', 'url']),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1)).min(1).max(30).optional(),
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

export type Field = z.infer<typeof fieldSchema>
