export const STATIC_TOOL_NAMES = [
  'describe_current_state',
  'read_widget_data',
  'get_activity_log',
  'add_widget',
  'update_widget',
  'remove_widget',
  'bind_data',
  'add_rows',
  'update_rows',
  'delete_rows',
  'set_layout',
  'set_theme',
  'create_form_tool',
  'remove_minted_tool',
  'undo',
] as const

export type StaticToolName = (typeof STATIC_TOOL_NAMES)[number]
