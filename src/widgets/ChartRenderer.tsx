import { useTheme } from '@astryxdesign/core/theme'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartConfig } from '../model/types'
import type { ChartDatum } from './chartData'

type ChartRendererProps = {
  chartType: ChartConfig['chartType']
  data: ChartDatum[]
  yFields: string[]
}

export default function ChartRenderer({
  chartType,
  data,
  yFields,
}: ChartRendererProps) {
  const { token } = useTheme()
  const colors = [
    token('--color-accent'),
    token('--color-icon-green'),
    token('--color-icon-purple'),
    token('--color-icon-orange'),
  ]
  const axisColor = token('--color-text-secondary')
  const gridColor = token('--color-border')
  const tooltipStyle = {
    backgroundColor: token('--color-background-popover'),
    borderColor: token('--color-border'),
    borderRadius: token('--radius-element'),
    color: token('--color-text-primary'),
  }

  if (chartType === 'pie') {
    const dataKey = yFields[0]
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey="__label"
            fill={colors[0]}
          >
            {data.map((entry, index) => (
              <Cell
                key={String(entry.__label)}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={gridColor} />
          <XAxis dataKey="__label" stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {yFields.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke={gridColor} />
          <XAxis dataKey="__label" stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {yFields.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={gridColor} />
        <XAxis dataKey="__label" stroke={axisColor} />
        <YAxis stroke={axisColor} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        {yFields.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
