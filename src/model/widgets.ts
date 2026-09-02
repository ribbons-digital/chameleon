import { z } from 'zod'
import { CHECKLIST_FIELDS, fieldsByKey } from './fields'
import { LIMITS } from './limits'
import type {
  Actor,
  ChartConfig,
  ChartWidget,
  ChecklistConfig,
  ChecklistWidget,
  DataSet,
  Field,
  FormConfig,
  FormWidget,
  GridPosition,
  KanbanConfig,
  KanbanWidget,
  NoteConfig,
  NoteWidget,
  TableConfig,
  TableWidget,
  Widget,
  WidgetConfig,
  WidgetType,
} from './types'

export const tableConfigSchema = z
  .object({
    columnOrder: z.array(z.string()).optional(),
    sort: z
      .object({
        field: z.string(),
        dir: z.enum(['asc', 'desc']),
      })
      .optional(),
    rowNumbers: z.boolean().default(false),
  })
  .strict()

export const kanbanConfigSchema = z
  .object({
    groupByField: z.string(),
    cardTitleField: z.string(),
    cardDetailFields: z.array(z.string()).max(3).default([]),
    columnOrder: z.array(z.string()).optional(),
  })
  .strict()

export const checklistConfigSchema = z
  .object({
    showCompleted: z.boolean().default(true),
    sortBy: z.enum(['manual', 'due', 'created']).default('manual'),
    showProgress: z.boolean().default(true),
  })
  .strict()

export const chartConfigSchema = z
  .object({
    chartType: z.enum(['line', 'bar', 'area', 'pie']),
    xField: z.string(),
    yFields: z.array(z.string()).min(1).max(4),
    sourceWidgetId: z.string().optional(),
    aggregate: z.enum(['none', 'sum', 'count', 'avg']).default('none'),
  })
  .strict()

export const noteConfigSchema = z
  .object({
    markdown: z.string().max(LIMITS.noteMarkdown).default(''),
    variant: z.enum(['plain', 'callout']).default('plain'),
  })
  .strict()

export const formConfigSchema = z
  .object({
    description: z.string().max(300).optional(),
    submitLabel: z.string().min(1).max(30).default('Add entry'),
    showRecentSubmissions: z.number().int().min(0).max(10).default(3),
  })
  .strict()

export const configSchemas = {
  table: tableConfigSchema,
  kanban: kanbanConfigSchema,
  checklist: checklistConfigSchema,
  chart: chartConfigSchema,
  note: noteConfigSchema,
  form: formConfigSchema,
} as const

export type ConfigIssue = {
  code: 'INVALID_CONFIG' | 'FIELD_NOT_FOUND'
  message: string
  details?: unknown
}

const defaultConfigs: Record<WidgetType, WidgetConfig> = {
  table: { rowNumbers: false },
  kanban: {
    groupByField: 'status',
    cardTitleField: 'title',
    cardDetailFields: [],
  },
  checklist: {
    showCompleted: true,
    sortBy: 'manual',
    showProgress: true,
  },
  chart: {
    chartType: 'bar',
    xField: '_createdAt',
    yFields: ['value'],
    aggregate: 'none',
  },
  note: { markdown: '', variant: 'plain' },
  form: { submitLabel: 'Add entry', showRecentSubmissions: 3 },
}

export function defaultConfig(type: WidgetType): WidgetConfig {
  return structuredClone(defaultConfigs[type])
}

export function defaultDataset(type: WidgetType, fields?: Field[]) {
  if (type === 'note') return null
  if (type === 'checklist') {
    return { fields: structuredClone(CHECKLIST_FIELDS), rows: [] }
  }
  return { fields: fields ? structuredClone(fields) : [], rows: [] }
}

function referencedKeys(type: WidgetType, config: WidgetConfig): string[] {
  switch (type) {
    case 'table': {
      const table = config as TableConfig
      return [
        ...(table.columnOrder ?? []),
        ...(table.sort ? [table.sort.field] : []),
      ]
    }
    case 'kanban': {
      const kanban = config as KanbanConfig
      return [
        kanban.groupByField,
        kanban.cardTitleField,
        ...kanban.cardDetailFields,
      ]
    }
    case 'chart': {
      const chart = config as ChartConfig
      return [chart.xField, ...chart.yFields].filter((key) => !key.startsWith('_'))
    }
    case 'checklist':
    case 'note':
    case 'form':
      return []
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

export function validateConfig(
  type: WidgetType,
  config: unknown,
  fields?: Field[],
): { config: WidgetConfig } | { error: ConfigIssue } {
  const schema = configSchemas[type]
  const parsed = schema.safeParse(config ?? {})
  if (!parsed.success) {
    return {
      error: {
        code: 'INVALID_CONFIG',
        message: parsed.error.issues.map((issue) => issue.message).join('; '),
        details: z.toJSONSchema(schema, {
          target: 'draft-7',
          reused: 'inline',
        }),
      },
    }
  }

  const next = parsed.data
  const knownFields = fields ?? []

  if (type === 'kanban' && knownFields.length > 0) {
    const kanban = next as KanbanConfig
    const group = knownFields.find((field) => field.key === kanban.groupByField)
    if (!group) {
      return {
        error: {
          code: 'FIELD_NOT_FOUND',
          message: `Kanban groupByField "${kanban.groupByField}" is not in the schema.`,
          details: { missingKey: kanban.groupByField },
        },
      }
    }
    if (group.type !== 'select') {
      return {
        error: {
          code: 'INVALID_CONFIG',
          message: 'Kanban groupByField must be a select field.',
          details: z.toJSONSchema(kanbanConfigSchema, {
            target: 'draft-7',
            reused: 'inline',
          }),
        },
      }
    }
  }

  if (type === 'chart') {
    const chart = next as ChartConfig
    if (chart.aggregate !== 'count' && knownFields.length > 0) {
      const lookup = fieldsByKey(knownFields)
      for (const key of chart.yFields) {
        if (key.startsWith('_')) continue
        const field = lookup.get(key)
        if (field && field.type !== 'number') {
          return {
            error: {
              code: 'INVALID_CONFIG',
              message: `Chart yField "${key}" must be a number field (except when aggregate is "count").`,
              details: z.toJSONSchema(chartConfigSchema, {
                target: 'draft-7',
                reused: 'inline',
              }),
            },
          }
        }
      }
    }
  }

  if (knownFields.length > 0) {
    const lookup = fieldsByKey(knownFields)
    for (const key of referencedKeys(type, next)) {
      if (!lookup.has(key)) {
        return {
          error: {
            code: 'FIELD_NOT_FOUND',
            message: `Config references field key "${key}" that is not in the schema.`,
            details: { missingKey: key },
          },
        }
      }
    }
  }

  return { config: next }
}

export function mergeConfig(
  current: WidgetConfig,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key]
    } else {
      next[key] = value
    }
  }
  return next
}

export function createWidget(input: {
  id: string
  type: WidgetType
  title: string
  position: GridPosition
  config: WidgetConfig
  dataset: DataSet | null
  createdAt: string
  updatedAt: string
  lastModifiedBy: Actor
}): Widget {
  switch (input.type) {
    case 'note':
      return {
        ...input,
        type: 'note',
        config: input.config as NoteConfig,
        dataset: null,
      } satisfies NoteWidget
    case 'table':
      return {
        ...input,
        type: 'table',
        config: input.config as TableConfig,
        dataset: input.dataset ?? { fields: [], rows: [] },
      } satisfies TableWidget
    case 'kanban':
      return {
        ...input,
        type: 'kanban',
        config: input.config as KanbanConfig,
        dataset: input.dataset ?? { fields: [], rows: [] },
      } satisfies KanbanWidget
    case 'checklist':
      return {
        ...input,
        type: 'checklist',
        config: input.config as ChecklistConfig,
        dataset: input.dataset ?? {
          fields: structuredClone(CHECKLIST_FIELDS),
          rows: [],
        },
      } satisfies ChecklistWidget
    case 'chart':
      return {
        ...input,
        type: 'chart',
        config: input.config as ChartConfig,
        dataset: input.dataset ?? { fields: [], rows: [] },
      } satisfies ChartWidget
    case 'form':
      return {
        ...input,
        type: 'form',
        config: input.config as FormConfig,
        dataset: input.dataset ?? { fields: [], rows: [] },
      } satisfies FormWidget
    default: {
      const _exhaustive: never = input.type
      return _exhaustive
    }
  }
}
