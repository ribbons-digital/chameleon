import { createRowId } from '../model/ids'
import type {
  Actor,
  BoardDocument,
  Field,
  GridPosition,
  Row,
  Widget,
  WidgetType,
} from '../model/types'
import { createWidget, defaultConfig, defaultDataset } from '../model/widgets'

const now = () => '2026-08-28T00:00:00.000Z'

function row(
  actor: Actor,
  values: Record<string, unknown>,
  id: string,
): Row {
  return {
    _id: id,
    _createdAt: now(),
    _updatedAt: now(),
    _createdBy: actor,
    ...values,
  }
}

const stepField: Field = {
  key: 'step',
  label: 'Step',
  type: 'text',
  required: true,
}

export function createSampleWidgets(): Widget[] {
  return [
    createWidget({
      id: 'w_welcome',
      type: 'note',
      title: 'A canvas that listens',
      position: { x: 0, y: 0, w: 5, h: 5 },
      config: {
        markdown:
          'Tell your agent what you are working on. Chameleon will turn this quiet space into the software you need.',
        variant: 'plain',
      },
      dataset: null,
      createdAt: now(),
      updatedAt: now(),
      lastModifiedBy: 'agent',
    }),
    createWidget({
      id: 'w_first_steps',
      type: 'table',
      title: 'What happens next',
      position: { x: 5, y: 0, w: 7, h: 5 },
      config: { rowNumbers: true },
      dataset: {
        fields: [stepField],
        rows: [
          row('agent', { step: 'Your agent reads the board' }, 'r_step_one'),
          row('agent', { step: 'Widgets appear live' }, 'r_step_two'),
          row('agent', { step: 'You keep editing by hand' }, 'r_step_three'),
        ],
      },
      createdAt: now(),
      updatedAt: now(),
      lastModifiedBy: 'agent',
    }),
  ]
}

export const initialDocument: BoardDocument = {
  title: 'Untitled workspace',
  theme: { name: 'neutral', mode: 'light', density: 'comfortable' },
  stateVersion: 0,
  mintedTools: [],
  humanEditsSinceLastDescribe: 0,
  widgets: [],
}

export function createSampleDocument(): BoardDocument {
  return {
    ...structuredClone(initialDocument),
    widgets: createSampleWidgets(),
  }
}

type LegacyWidget = {
  id?: unknown
  type?: unknown
  title?: unknown
  position?: Partial<GridPosition>
  content?: unknown
  config?: unknown
  dataset?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  lastModifiedBy?: unknown
}

type LegacyDocument = {
  title?: unknown
  theme?: unknown
  stateVersion?: unknown
  widgets?: unknown
  mintedTools?: unknown
  humanEditsSinceLastDescribe?: unknown
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function asActor(value: unknown): Actor {
  return value === 'human' ? 'human' : 'agent'
}

function asWidgetType(value: unknown): WidgetType {
  if (
    value === 'table' ||
    value === 'kanban' ||
    value === 'checklist' ||
    value === 'chart' ||
    value === 'note' ||
    value === 'form'
  ) {
    return value
  }
  return 'note'
}

function migrateWidget(raw: LegacyWidget, index: number): Widget {
  const type = asWidgetType(raw.type)
  const content = asString(raw.content, '')
  const config =
    raw.config && typeof raw.config === 'object'
      ? { ...defaultConfig(type), ...(raw.config as object) }
      : type === 'note'
        ? { ...defaultConfig('note'), markdown: content }
        : defaultConfig(type)

  let dataset =
    raw.dataset && typeof raw.dataset === 'object'
      ? (raw.dataset as Widget['dataset'])
      : defaultDataset(type)

  if (!raw.dataset && type === 'table' && content) {
    dataset = {
      fields: [stepField],
      rows: content
        .split('\n')
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean)
        .map((step) => row('agent', { step }, createRowId())),
    }
  }

  const position = raw.position ?? {}
  return createWidget({
    id: asString(raw.id, `w_migrated_${index + 1}`),
    type,
    title: asString(raw.title, 'Untitled'),
    position: {
      x: typeof position.x === 'number' ? position.x : 0,
      y: typeof position.y === 'number' ? position.y : 0,
      w: typeof position.w === 'number' ? position.w : 4,
      h: typeof position.h === 'number' ? position.h : 4,
    },
    config,
    dataset: type === 'note' ? null : dataset,
    createdAt: asString(raw.createdAt, now()),
    updatedAt: asString(raw.updatedAt, now()),
    lastModifiedBy: asActor(raw.lastModifiedBy),
  })
}

export function migrateDocument(raw: unknown): BoardDocument {
  const source = (raw && typeof raw === 'object' ? raw : {}) as LegacyDocument
  const widgets = Array.isArray(source.widgets)
    ? source.widgets.map((widget, index) =>
        migrateWidget((widget ?? {}) as LegacyWidget, index),
      )
    : structuredClone(initialDocument.widgets)

  const theme =
    source.theme && typeof source.theme === 'object'
      ? {
          ...initialDocument.theme,
          ...(source.theme as object),
        }
      : initialDocument.theme

  return {
    title: asString(source.title, initialDocument.title),
    theme: theme as BoardDocument['theme'],
    stateVersion:
      typeof source.stateVersion === 'number' ? source.stateVersion : 0,
    widgets,
    mintedTools: Array.isArray(source.mintedTools)
      ? (source.mintedTools as BoardDocument['mintedTools'])
      : [],
    humanEditsSinceLastDescribe:
      typeof source.humanEditsSinceLastDescribe === 'number'
        ? source.humanEditsSinceLastDescribe
        : 0,
  }
}
