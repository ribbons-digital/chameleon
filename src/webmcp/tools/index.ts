import type { RegisterableTool } from '../modelContext'
import {
  describeCurrentState,
  getActivityLog,
  readWidgetData,
} from './describe'
import { addRows, bindData, deleteRows, updateRows } from './data'
import { undoBoard } from './undo'
import { addWidget, removeWidget, updateWidget } from './widgets'

export const STATIC_TOOLS: RegisterableTool[] = [
  describeCurrentState,
  readWidgetData,
  getActivityLog,
  addWidget,
  updateWidget,
  removeWidget,
  bindData,
  addRows,
  updateRows,
  deleteRows,
  undoBoard,
]

export const DAY2_STATIC_TOOLS = STATIC_TOOLS
export const STATIC_TOOL_NAMES = STATIC_TOOLS.map((tool) => tool.name)
