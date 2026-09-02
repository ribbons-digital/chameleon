import { CHECKLIST_FIELDS } from '../model/fields'
import { LIMITS } from '../model/limits'
import type {
  ActivityEntry,
  BoardDocument,
  Command,
  DataSet,
  Field,
  Row,
  Widget,
} from '../model/types'
import { useBoardStore } from './boardStore'

export function isRepeatedLogTitle(title: string): boolean {
  return /blood[\s-]?sugar|glucose|diabetes|readings?|\blog\b/i.test(title)
}

export function effectiveDataset(
  widget: Widget,
  widgets: Widget[],
): DataSet | null {
  if (widget.type === 'note') return null
  if (widget.type === 'chart') {
    const sourceId = widget.config.sourceWidgetId
    if (sourceId) {
      const source = widgets.find((candidate) => candidate.id === sourceId)
      return source?.dataset ?? widget.dataset
    }
  }
  if (widget.type === 'checklist') {
    return {
      fields: widget.dataset?.fields?.length
        ? widget.dataset.fields
        : CHECKLIST_FIELDS,
      rows: widget.dataset?.rows ?? [],
    }
  }
  return widget.dataset
}

export function widgetFields(widget: Widget, widgets: Widget[]): Field[] | null {
  if (widget.type === 'note') return null
  if (
    widget.type === 'chart' &&
    widget.config.sourceWidgetId
  ) {
    return null
  }
  return effectiveDataset(widget, widgets)?.fields ?? []
}

function toActivity(command: Command): ActivityEntry {
  return {
    seq: command.seq,
    at: command.at,
    actor: command.actor,
    action: command.action,
    summary: command.summary,
    rationale: command.rationale,
    undone: command.undone,
  }
}

export function activityEntries(
  commands: Command[],
  options: {
    limit?: number
    actor?: 'human' | 'agent'
    since_seq?: number
  } = {},
): ActivityEntry[] {
  const limit = options.limit ?? 20
  return commands
    .filter((command) => {
      if (options.actor && command.actor !== options.actor) return false
      if (
        typeof options.since_seq === 'number' &&
        command.seq <= options.since_seq
      ) {
        return false
      }
      return true
    })
    .slice()
    .reverse()
    .slice(0, limit)
    .map(toActivity)
}

export type WidgetSnapshot = {
  id: string
  type: Widget['type']
  title: string
  position: Widget['position']
  config: Widget['config']
  fields: Field[] | null
  rowCount: number
  sampleRows?: Row[]
  mintedTools: string[]
  lastModified: { at: string; by: Widget['lastModifiedBy'] }
}

export type UnfinishedWidget = {
  widgetId: string
  title: string
  type: Widget['type']
  reason: string
  action: 'add_rows' | 'bind_data' | 'create_form_tool'
}

export function unfinishedWidgets(document: BoardDocument): UnfinishedWidget[] {
  const unfinished: UnfinishedWidget[] = []
  for (const widget of document.widgets) {
    if (widget.type === 'note' || widget.type === 'chart') continue
    const dataset = effectiveDataset(widget, document.widgets)
    const rowCount = dataset?.rows.length ?? 0
    const fieldCount = dataset?.fields.length ?? 0
    if (widget.type === 'form') {
      const minted = document.mintedTools.some(
        (tool) => tool.widgetId === widget.id,
      )
      if (fieldCount === 0) {
        unfinished.push({
          widgetId: widget.id,
          title: widget.title,
          type: widget.type,
          reason:
            'No fields yet. Call bind_data, then create_form_tool. add_rows does not mint a tool.',
          action: 'bind_data',
        })
        continue
      }
      if (!minted) {
        unfinished.push({
          widgetId: widget.id,
          title: widget.title,
          type: widget.type,
          reason:
            'Form has no minted tool. Call create_form_tool before you stop. add_rows is not a substitute.',
          action: 'create_form_tool',
        })
        continue
      }
      continue
    }
    if (
      widget.type === 'table' &&
      isRepeatedLogTitle(widget.title) &&
      document.mintedTools.length === 0
    ) {
      unfinished.push({
        widgetId: widget.id,
        title: widget.title,
        type: widget.type,
        reason:
          'Repeated log has no minted tool. add_widget type=form with these fields, then create_form_tool. Filling this table is not a substitute.',
        action: 'create_form_tool',
      })
      continue
    }
    if (rowCount > 0) continue
    if (widget.type !== 'checklist' && fieldCount === 0) {
      unfinished.push({
        widgetId: widget.id,
        title: widget.title,
        type: widget.type,
        reason: 'No fields yet. Call bind_data, then add_rows.',
        action: 'bind_data',
      })
      continue
    }
    const empty =
      widget.type === 'checklist' ? 'No items yet' : 'No rows yet'
    unfinished.push({
      widgetId: widget.id,
      title: widget.title,
      type: widget.type,
      reason: `${empty}. Call add_rows before you stop.`,
      action: 'add_rows',
    })
  }
  return unfinished
}

export type BoardSnapshot = {
  board: {
    title: string
    theme: BoardDocument['theme']
    grid: { cols: number; rowHeightPx: number }
    widgetCount: number
  }
  unfinished: UnfinishedWidget[]
  widgets: WidgetSnapshot[]
  mintedTools: BoardDocument['mintedTools']
  recentActivity: Array<Omit<ActivityEntry, 'undone'>>
  humanEditsSinceLastDescribe: number
}

export function snapshot(
  document: BoardDocument,
  commands: Command[],
  options: { includeSampleRows: boolean },
): BoardSnapshot {
  return {
    board: {
      title: document.title,
      theme: document.theme,
      grid: { cols: LIMITS.gridCols, rowHeightPx: LIMITS.rowHeightPx },
      widgetCount: document.widgets.length,
    },
    unfinished: unfinishedWidgets(document),
    widgets: document.widgets.map((widget) => {
      const dataset = effectiveDataset(widget, document.widgets)
      const rowCount = dataset?.rows.length ?? 0
      const snapshotWidget: WidgetSnapshot = {
        id: widget.id,
        type: widget.type,
        title: widget.title,
        position: widget.position,
        config: widget.config,
        fields: widgetFields(widget, document.widgets),
        rowCount,
        mintedTools: document.mintedTools
          .filter((tool) => tool.widgetId === widget.id)
          .map((tool) => tool.toolName),
        lastModified: { at: widget.updatedAt, by: widget.lastModifiedBy },
      }
      if (options.includeSampleRows) {
        snapshotWidget.sampleRows = dataset ? dataset.rows.slice(0, 3) : []
      }
      return snapshotWidget
    }),
    mintedTools: document.mintedTools,
    recentActivity: activityEntries(commands, { limit: 10 }).map(
      ({ undone: _undone, ...entry }) => entry,
    ),
    humanEditsSinceLastDescribe: document.humanEditsSinceLastDescribe,
  }
}

export function currentSnapshot(includeSampleRows: boolean) {
  const { document, commands } = useBoardStore.getState()
  return snapshot(document, commands, { includeSampleRows })
}
