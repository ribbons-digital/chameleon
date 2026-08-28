import { nanoid } from 'nanoid'

export const WIDGET_ID_PATTERN = /^w_[a-zA-Z0-9_-]{6,}$/
export const ROW_ID_PATTERN = /^r_[a-zA-Z0-9_-]{6,}$/

export function createWidgetId(): string {
  return `w_${nanoid(8)}`
}

export function createRowId(): string {
  return `r_${nanoid(8)}`
}

export function isWidgetId(value: string): boolean {
  return WIDGET_ID_PATTERN.test(value)
}
