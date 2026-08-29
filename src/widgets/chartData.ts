import type {
  ChartWidget,
  DataSet,
  Row,
} from '../model/types'

export type ChartDatum = Record<string, string | number>

function xValue(row: Row, key: string): string | undefined {
  const value = row[key]
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  return undefined
}

function numericValue(row: Row, key: string): number | undefined {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

export function prepareChartData(
  widget: ChartWidget,
  dataset: DataSet,
): ChartDatum[] {
  const { xField, yFields, aggregate } = widget.config
  if (aggregate === 'none') {
    return dataset.rows
      .map((row) => {
        const label = xValue(row, xField)
        if (label === undefined) return undefined
        const datum: ChartDatum = { __label: label }
        for (const key of yFields) {
          const value = numericValue(row, key)
          if (value !== undefined) datum[key] = value
        }
        return datum
      })
      .filter((datum): datum is ChartDatum => Boolean(datum))
  }

  const groups = new Map<
    string,
    { count: number; sums: Record<string, number> }
  >()
  for (const row of dataset.rows) {
    const label = xValue(row, xField)
    if (label === undefined) continue
    const group = groups.get(label) ?? { count: 0, sums: {} }
    group.count += 1
    for (const key of yFields) {
      group.sums[key] =
        (group.sums[key] ?? 0) + (numericValue(row, key) ?? 0)
    }
    groups.set(label, group)
  }

  return [...groups].map(([label, group]) => {
    const datum: ChartDatum = { __label: label }
    for (const key of yFields) {
      if (aggregate === 'count') {
        datum[key] = group.count
      } else if (aggregate === 'avg') {
        datum[key] = (group.sums[key] ?? 0) / group.count
      } else {
        datum[key] = group.sums[key] ?? 0
      }
    }
    return datum
  })
}
