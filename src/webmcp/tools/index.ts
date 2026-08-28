import type { RegisterableTool } from '../modelContext'
import { describeCurrentState, getActivityLog } from './describe'
import { addWidget, removeWidget, updateWidget } from './widgets'

export const DAY2_STATIC_TOOLS: RegisterableTool[] = [
  describeCurrentState,
  getActivityLog,
  addWidget,
  updateWidget,
  removeWidget,
]

export const STATIC_TOOL_NAMES = DAY2_STATIC_TOOLS.map((tool) => tool.name)
