export const STATIC_TOOL_NAMES = [
  'describe_current_state',
  'add_widget',
  'bind_data',
  'add_rows',
  'create_form_tool',
  'update_widget',
  'read_widget_data',
  'get_activity_log',
  'remove_widget',
  'update_rows',
  'delete_rows',
  'set_layout',
  'set_theme',
  'remove_minted_tool',
  'undo',
] as const

export type StaticToolName = (typeof STATIC_TOOL_NAMES)[number]
