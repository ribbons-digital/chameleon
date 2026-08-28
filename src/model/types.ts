import type { Patch } from 'immer'

export type Actor = 'human' | 'agent'

export type WidgetType =
  | 'table'
  | 'kanban'
  | 'checklist'
  | 'chart'
  | 'note'
  | 'form'

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'url'

export type ThemeName =
  | 'neutral'
  | 'butter'
  | 'chocolate'
  | 'matcha'
  | 'stone'
  | 'gothic'
  | 'y2k'

export type ThemeMode = 'light' | 'dark'
export type ThemeDensity = 'comfortable' | 'compact'

export type GridPosition = {
  x: number
  y: number
  w: number
  h: number
}

export type Field = {
  key: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]
  description?: string
}

export type Row = {
  _id: string
  _createdAt: string
  _updatedAt: string
  _createdBy: Actor
  [fieldKey: string]: unknown
}

export type DataSet = {
  fields: Field[]
  rows: Row[]
}

export type TableConfig = {
  columnOrder?: string[]
  sort?: { field: string; dir: 'asc' | 'desc' }
  rowNumbers: boolean
}

export type KanbanConfig = {
  groupByField: string
  cardTitleField: string
  cardDetailFields: string[]
  columnOrder?: string[]
}

export type ChecklistConfig = {
  showCompleted: boolean
  sortBy: 'manual' | 'due' | 'created'
  showProgress: boolean
}

export type ChartConfig = {
  chartType: 'line' | 'bar' | 'area' | 'pie'
  xField: string
  yFields: string[]
  sourceWidgetId?: string
  aggregate: 'none' | 'sum' | 'count' | 'avg'
}

export type NoteConfig = {
  markdown: string
  variant: 'plain' | 'callout'
}

export type FormConfig = {
  description?: string
  submitLabel: string
  showRecentSubmissions: number
}

export type WidgetConfig =
  | TableConfig
  | KanbanConfig
  | ChecklistConfig
  | ChartConfig
  | NoteConfig
  | FormConfig

type WidgetBase = {
  id: string
  title: string
  position: GridPosition
  createdAt: string
  updatedAt: string
  lastModifiedBy: Actor
}

export type TableWidget = WidgetBase & {
  type: 'table'
  config: TableConfig
  dataset: DataSet
}

export type KanbanWidget = WidgetBase & {
  type: 'kanban'
  config: KanbanConfig
  dataset: DataSet
}

export type ChecklistWidget = WidgetBase & {
  type: 'checklist'
  config: ChecklistConfig
  dataset: DataSet
}

export type ChartWidget = WidgetBase & {
  type: 'chart'
  config: ChartConfig
  dataset: DataSet
}

export type NoteWidget = WidgetBase & {
  type: 'note'
  config: NoteConfig
  dataset: null
}

export type FormWidget = WidgetBase & {
  type: 'form'
  config: FormConfig
  dataset: DataSet
}

export type Widget =
  | TableWidget
  | KanbanWidget
  | ChecklistWidget
  | ChartWidget
  | NoteWidget
  | FormWidget

export type MintedToolRecord = {
  toolName: string
  widgetId: string
  description: string
  createdAt: string
}

export type BoardTheme = {
  name: ThemeName
  mode: ThemeMode
  density: ThemeDensity
}

export type BoardDocument = {
  title: string
  theme: BoardTheme
  stateVersion: number
  widgets: Widget[]
  mintedTools: MintedToolRecord[]
  humanEditsSinceLastDescribe: number
}

export type Command = {
  seq: number
  at: string
  actor: Actor
  action: string
  summary: string
  rationale?: string
  inversePatches: Patch[]
  undone: boolean
}

export type MutationMeta = Omit<Command, 'seq' | 'at' | 'inversePatches' | 'undone'>

export type ActivityEntry = {
  seq: number
  at: string
  actor: Actor
  action: string
  summary: string
  rationale?: string
  undone: boolean
}

export type ConfigByType = {
  table: TableConfig
  kanban: KanbanConfig
  checklist: ChecklistConfig
  chart: ChartConfig
  note: NoteConfig
  form: FormConfig
}
