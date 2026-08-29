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
    // Kill vertical Table bleed. Use 0px (Astryx Section's reset) rather
    // than var(--spacing-0), which is a hashed StyleX token and can leave
    // this declaration invalid so Card's 16px still inherits.
    '--container-padding-block-start': '0px',
  },
  tableStack: {
    width: '100%',
    maxWidth: '100%',
    flexShrink: 0,
    minHeight: 'min-content',
    '--container-padding-block-start': '0px',
  },
  tableHost: {
    width: '100%',
    maxWidth: '100%',
  },
  noteEditor: {
    width: '100%',
  },
  placeholder: {
    height: '100%',
  },
  chartHost: {
    width: '100%',
    minHeight: 'calc(var(--spacing-10) * 4)',
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
