import {
  applyPatches,
  enablePatches,
  produce,
  produceWithPatches,
  type Draft,
} from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { LIMITS } from '../model/limits'
import type {
  BoardDocument,
  Command,
  MutationMeta,
} from '../model/types'
import { initialDocument, migrateDocument } from './migrateDocument'

enablePatches()

const now = () => new Date().toISOString()

type BoardStore = {
  document: BoardDocument
  commands: Command[]
  hydrated: boolean
  mutate: (
    meta: MutationMeta,
    recipe: (draft: Draft<BoardDocument>) => void,
  ) => number
  undo: () => Command | undefined
  reset: () => void
  setHydrated: (hydrated: boolean) => void
  resetHumanEditCount: () => number
}

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      document: structuredClone(initialDocument),
      commands: [],
      hydrated: false,

      mutate: (meta, recipe) => {
        let nextVersion = get().document.stateVersion
        set((state) => {
          const [document, patches, inversePatches] = produceWithPatches(
            state.document,
            (draft) => {
              recipe(draft)
              if (meta.actor === 'human') {
                draft.humanEditsSinceLastDescribe += 1
              }
              draft.stateVersion += 1
            },
          )
          const meaningful = patches.filter(
            (patch) =>
              patch.path[0] !== 'stateVersion' &&
              patch.path[0] !== 'humanEditsSinceLastDescribe',
          )
          if (meaningful.length === 0) {
            return state
          }
          nextVersion = document.stateVersion
          const command: Command = {
            ...meta,
            seq: nextVersion,
            at: now(),
            inversePatches,
            undone: false,
          }
          return {
            document,
            commands: [...state.commands, command].slice(
              -LIMITS.commandLogEntries,
            ),
          }
        })
        return nextVersion
      },

      undo: () => {
        const state = get()
        const index = state.commands.findLastIndex(
          (command) => !command.undone && command.action !== 'undo',
        )
        if (index < 0) return undefined
        const target = state.commands[index]
        set((current) => {
          const version = current.document.stateVersion + 1
          const restored = produce(
            applyPatches(current.document, target.inversePatches),
            (draft) => {
              draft.stateVersion = version
            },
          )
          const commands = current.commands.map((command, commandIndex) =>
            commandIndex === index ? { ...command, undone: true } : command,
          )
          commands.push({
            seq: version,
            at: now(),
            actor: 'human',
            action: 'undo',
            summary: `Undid: ${target.summary}`,
            inversePatches: [],
            undone: false,
          })
          return {
            document: restored,
            commands: commands.slice(-LIMITS.commandLogEntries),
          }
        })
        return target
      },

      reset: () =>
        set({
          document: structuredClone(initialDocument),
          commands: [],
        }),
      setHydrated: (hydrated) => set({ hydrated }),
      resetHumanEditCount: () => {
        const current = get().document.humanEditsSinceLastDescribe
        set((state) => ({
          document: {
            ...state.document,
            humanEditsSinceLastDescribe: 0,
          },
        }))
        return current
      },
    }),
    {
      name: 'chameleon-board-v1',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ document, commands }) => ({ document, commands }),
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as {
          document?: unknown
          commands?: Command[]
        }
        return {
          document: migrateDocument(raw.document),
          commands: Array.isArray(raw.commands) ? raw.commands : [],
        }
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
)

export { initialDocument }
