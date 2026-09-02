import { useBoardStore } from '../store/boardStore'

export type BoardDensity = {
  /** Astryx Table and List density. */
  rows: 'compact' | 'balanced'
  /** Astryx Markdown density. */
  prose: 'compact' | 'default'
}

const DENSITIES: Record<'comfortable' | 'compact', BoardDensity> = {
  comfortable: { rows: 'balanced', prose: 'default' },
  compact: { rows: 'compact', prose: 'compact' },
}

/** Maps set_theme density onto the component density props that render it. */
export function useBoardDensity(): BoardDensity {
  const density = useBoardStore((state) => state.document.theme.density)
  return DENSITIES[density] ?? DENSITIES.comfortable
}
