import { describe, expect, it } from 'vitest'
import type {
  ChartWidget,
  DataSet,
} from '../../src/model/types'
import { prepareChartData } from '../../src/widgets/chartData'

function chart(
  aggregate: ChartWidget['config']['aggregate'],
): ChartWidget {
  return {
    id: 'w_chart01',
    type: 'chart',
    title: 'Revenue',
    position: { x: 0, y: 0, w: 6, h: 6 },
    config: {
      chartType: 'bar',
      xField: 'month',
      yFields: ['amount'],
      aggregate,
    },
    dataset: { fields: [], rows: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastModifiedBy: 'agent',
  }
}

const dataset: DataSet = {
  fields: [
    {
      key: 'month',
      label: 'Month',
      type: 'select',
      required: true,
      options: ['Jan', 'Feb'],
    },
    {
      key: 'amount',
      label: 'Amount',
      type: 'number',
      required: true,
    },
  ],
  rows: [
    {
      _id: 'r_1',
      _createdAt: '2026-01-01T00:00:00.000Z',
      _updatedAt: '2026-01-01T00:00:00.000Z',
      _createdBy: 'agent',
      month: 'Jan',
      amount: 10,
    },
    {
      _id: 'r_2',
      _createdAt: '2026-01-02T00:00:00.000Z',
      _updatedAt: '2026-01-02T00:00:00.000Z',
      _createdBy: 'agent',
      month: 'Jan',
      amount: 30,
    },
  ],
}

describe('chart data preparation', () => {
  it('groups sum, count, and average aggregates by xField', () => {
    expect(prepareChartData(chart('sum'), dataset)).toEqual([
      { __label: 'Jan', amount: 40 },
    ])
    expect(prepareChartData(chart('count'), dataset)).toEqual([
      { __label: 'Jan', amount: 2 },
    ])
    expect(prepareChartData(chart('avg'), dataset)).toEqual([
      { __label: 'Jan', amount: 20 },
    ])
  })

  it('keeps one chart datum per row without aggregation', () => {
    expect(prepareChartData(chart('none'), dataset)).toEqual([
      { __label: 'Jan', amount: 10 },
      { __label: 'Jan', amount: 30 },
    ])
  })
})
