import * as stylex from '@stylexjs/stylex'

export const widgetStyles = stylex.create({
  shell: {
    height: '100%',
    minHeight: '0',
    overflow: 'hidden',
  },
  body: {
    flexGrow: 1,
    minHeight: '0',
    overflow: 'auto',
    paddingBottom: 'var(--spacing-4)',
  },
  tableHost: {
    minHeight: '0',
    width: '100%',
    maxWidth: '100%',
    overflow: 'auto',
  },
  noteEditor: {
    width: '100%',
  },
  placeholder: {
    height: '100%',
  },
  kanbanBoard: {
    width: '100%',
    minHeight: '0',
    alignItems: 'flex-start',
  },
  kanbanColumn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'var(--spacing-12)',
    minWidth: 'var(--spacing-12)',
    minHeight: '0',
    padding: 'var(--spacing-2)',
    backgroundColor: 'var(--color-background-secondary)',
    borderRadius: 'var(--radius-md)',
  },
})
