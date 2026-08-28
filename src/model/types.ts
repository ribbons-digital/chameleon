import type { Patch } from 'immer'

export type Actor = 'human' | 'agent'
export type WidgetType = 'note' | 'table'

export type GridPosition = {
  x: number
  y: number
  w: number
  h: number
}

export type Widget = {
  id: string
  type: WidgetType
  title: string
  position: GridPosition
  content: string
  createdAt: string
  updatedAt: string
  lastModifiedBy: Actor
}

export type BoardDocument = {
  title: string
  stateVersion: number
  widgets: Widget[]
}

export type Command = {
  seq: number
  at: string
  actor: Actor
  action: string
  summary: string
  rationale?: string
  inversePatches: Patch[]
  undone: boolean
}

export type MutationMeta = Omit<Command, 'seq' | 'at' | 'inversePatches' | 'undone'>
