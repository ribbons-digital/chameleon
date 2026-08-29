import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { lazy, Suspense } from 'react'
import type {
  ChartWidget as ChartWidgetModel,
  DataSet,
} from '../model/types'
import { effectiveDataset } from '../store/selectors'
import { useBoardStore } from '../store/boardStore'
import { prepareChartData, type ChartDatum } from './chartData'
import { widgetStyles } from './styles'

const ChartRenderer = lazy(() => import('./ChartRenderer'))

function hasConfiguredFields(
  widget: ChartWidgetModel,
  dataset: DataSet,
): boolean {
  const known = new Set(dataset.fields.map((field) => field.key))
  const hasX =
    widget.config.xField.startsWith('_') ||
    known.has(widget.config.xField)
  const hasY =
    widget.config.yFields.length > 0 &&
    (widget.config.aggregate === 'count' ||
      widget.config.yFields.every((key) => known.has(key)))
  return hasX && hasY
}

function sortChartData(
  data: ChartDatum[],
  widget: ChartWidgetModel,
  dataset: DataSet,
): ChartDatum[] {
  const xField = dataset.fields.find(
    (field) => field.key === widget.config.xField,
  )
  if (
    xField?.type !== 'date' &&
    widget.config.xField !== '_createdAt' &&
    widget.config.xField !== '_updatedAt'
  ) {
    return data
  }
  return [...data].sort((left, right) =>
    String(left.__label).localeCompare(String(right.__label)),
  )
}

export function ChartWidgetView({
  widget,
}: {
  widget: ChartWidgetModel
}) {
  const widgets = useBoardStore(
    (state) => state.document.widgets,
  )
  const sourceMissing =
    widget.config.sourceWidgetId !== undefined &&
    !widgets.some(
      (candidate) => candidate.id === widget.config.sourceWidgetId,
    )
  if (sourceMissing) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="Source widget was removed."
        description="Point this chart at another widget with update_widget."
      />
    )
  }

  const dataset = effectiveDataset(widget, widgets)
  if (
    !dataset ||
    dataset.rows.length === 0 ||
    !hasConfiguredFields(widget, dataset)
  ) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="No data yet"
        description="Bind the configured fields and add rows to draw this chart."
      />
    )
  }

  const data = sortChartData(
    prepareChartData(widget, dataset),
    widget,
    dataset,
  )
  if (data.length === 0) {
    return (
      <EmptyState
        isCompact
        headingLevel={3}
        title="No data yet"
        description="The configured fields have no chartable values."
      />
    )
  }

  return (
    <VStack height="100%" xstyle={widgetStyles.chartHost}>
      <Suspense fallback={<Text color="secondary">Loading chart</Text>}>
        <ChartRenderer
          chartType={widget.config.chartType}
          data={data}
          yFields={widget.config.yFields}
        />
      </Suspense>
    </VStack>
  )
}
