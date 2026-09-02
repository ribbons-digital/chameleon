import type { DataSet, Widget } from './types'

type LogWidget = Extract<Widget, { type: 'form' | 'table' }>

function normalizedTitle(title: string): string {
  return title.trim().toLowerCase()
}

function schemasCompatible(left: DataSet, right: DataSet): boolean {
  const leftTypes = new Map(
    left.fields.map((field) => [field.key, field.type]),
  )
  const rightTypes = new Map(
    right.fields.map((field) => [field.key, field.type]),
  )
  if (leftTypes.size === 0 || rightTypes.size === 0) return false
  const overlap = [...leftTypes.keys()].filter((key) => rightTypes.has(key))
  if (overlap.length === 0) return false
  if (overlap.some((key) => leftTypes.get(key) !== rightTypes.get(key))) {
    return false
  }
  if (leftTypes.size === rightTypes.size && overlap.length === leftTypes.size) {
    return true
  }
  const leftSubset = [...leftTypes.keys()].every((key) =>
    rightTypes.has(key),
  )
  const rightSubset = [...rightTypes.keys()].every((key) =>
    leftTypes.has(key),
  )
  return (leftSubset || rightSubset) && overlap.length >= 2
}

/**
 * Forms and tables can present the same repeated log through different UI.
 * Keep this heuristic in one place so data mirroring and unfinished-work
 * detection cannot disagree.
 */
export function areLogCompanions(
  left: LogWidget,
  right: LogWidget,
): boolean {
  if (left.type === right.type) return false
  return (
    normalizedTitle(left.title) === normalizedTitle(right.title) ||
    schemasCompatible(left.dataset, right.dataset)
  )
}
