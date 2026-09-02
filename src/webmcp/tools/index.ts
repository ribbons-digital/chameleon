import type { RegisterableTool } from '../modelContext'
import {
  STATIC_TOOL_NAMES,
  type StaticToolName,
} from '../staticToolNames'
import {
  describeCurrentState,
  getActivityLog,
  readWidgetData,
} from './describe'
import { addRows, bindData, deleteRows, updateRows } from './data'
import { setLayout, setTheme } from './layout'
import { createFormTool, removeMintedTool } from './mint'
import { undoBoard } from './undo'
import { addWidget, removeWidget, updateWidget } from './widgets'

const TOOLS_BY_NAME = {
  describe_current_state: describeCurrentState,
  read_widget_data: readWidgetData,
  get_activity_log: getActivityLog,
  add_widget: addWidget,
  update_widget: updateWidget,
  remove_widget: removeWidget,
  bind_data: bindData,
  add_rows: addRows,
  update_rows: updateRows,
  delete_rows: deleteRows,
  set_layout: setLayout,
  set_theme: setTheme,
  create_form_tool: createFormTool,
  remove_minted_tool: removeMintedTool,
  undo: undoBoard,
} satisfies Record<StaticToolName, RegisterableTool>

export const STATIC_TOOLS: RegisterableTool[] = STATIC_TOOL_NAMES.map(
  (name) => TOOLS_BY_NAME[name],
)

export { STATIC_TOOL_NAMES }
