import * as stylex from '@stylexjs/stylex'

export const widgetStyles = stylex.create({
  shell: {
    height: '100%',
    minHeight: '0',
  },
  body: {
    flexGrow: 1,
    minHeight: '0',
    overflow: 'auto',
  },
  tableHost: {
    minHeight: '0',
    width: '100%',
  },
  noteEditor: {
    width: '100%',
  },
  placeholder: {
    height: '100%',
  },
})
