import type { Draft } from 'immer'
import type { BoardDocument, MutationMeta } from '../model/types'
import { useBoardStore } from './boardStore'

export function mutate(
  meta: MutationMeta,
  recipe: (draft: Draft<BoardDocument>) => void,
): number {
  return useBoardStore.getState().mutate(meta, recipe)
}
