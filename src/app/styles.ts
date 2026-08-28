import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  shell: {
    minHeight: '100dvh',
    backgroundColor: 'var(--color-background-body)',
  },
  page: {
    width: '100%',
    minHeight: '100%',
    paddingTop: 'var(--spacing-5)',
    paddingRight: 'var(--spacing-5)',
    paddingBottom: 'var(--spacing-5)',
    paddingLeft: 'var(--spacing-5)',
  },
  header: {
    width: '100%',
    maxWidth: 1440,
    marginRight: 'auto',
    marginLeft: 'auto',
  },
  brandMark: {
    letterSpacing: '-0.04em',
  },
  gridWrap: {
    width: '100%',
    maxWidth: 1440,
    marginRight: 'auto',
    marginLeft: 'auto',
    paddingTop: 'var(--spacing-4)',
  },
  activity: {
    width: '100%',
    maxWidth: 1440,
    marginRight: 'auto',
    marginLeft: 'auto',
    paddingTop: 'var(--spacing-4)',
  },
})
