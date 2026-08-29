import type { Field } from '../model/types'

export type FormValue = string | number | boolean | undefined
export type FormValues = Record<string, FormValue>

export function collectFormSubmission(
  fields: Field[],
  state: FormValues,
  form?: HTMLFormElement | null,
): Record<string, unknown> {
  const data = form ? new FormData(form) : null
  const next: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.type === 'boolean') {
      next[field.key] = data
        ? data.has(field.key)
        : Boolean(state[field.key])
      continue
    }
    const fromForm = data?.get(field.key)
    if (typeof fromForm === 'string' && fromForm !== '') {
      next[field.key] = fromForm
      continue
    }
    const fromState = state[field.key]
    if (fromState !== undefined) next[field.key] = fromState
  }
  return next
}
