import {
  applyPatches,
  enablePatches,
  produce,
  produceWithPatches,
  type Draft,
} from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { boardPersistStorage } from './persistStorage'
import { LIMITS } from '../model/limits'
import type {
  Actor,
  BoardDocument,
  Command,
  MutationMeta,
} from '../model/types'
import {
  createSampleDocument,
  createSampleWidgets,
  initialDocument,
  migrateDocument,
} from './migrateDocument'

enablePatches()

const now = () => new Date().toISOString()

function commandPatchesAreSafe(command: Command): boolean {
  return !command.inversePatches.some((patch) =>
    patch.path.includes('content'),
  )
}

type BoardStore = {
  document: BoardDocument
  commands: Command[]
  mutate: (
    meta: MutationMeta,
    recipe: (draft: Draft<BoardDocument>) => void,
  ) => number
  undo: (actor?: Actor) => Command | undefined
  reset: () => void
  loadSample: () => void
  resetHumanEditCount: () => number
}

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      document: structuredClone(initialDocument),
      commands: [],

      mutate: (meta, recipe) => {
        const current = get()
        let nextVersion = current.document.stateVersion
        let document: BoardDocument
        let inversePatches: Command['inversePatches']
        try {
          const produced = produceWithPatches(
            current.document,
            (draft: Draft<BoardDocument>) => {
              recipe(draft)
              if (meta.actor === 'human') {
                draft.humanEditsSinceLastDescribe += 1
              }
              draft.stateVersion += 1
            },
          )
          document = produced[0]
          inversePatches = produced[2]
          const meaningful = produced[1].filter(
            (patch) =>
              patch.path[0] !== 'stateVersion' &&
              patch.path[0] !== 'humanEditsSinceLastDescribe',
          )
          if (meaningful.length === 0) {
            return nextVersion
          }
        } catch {
          return nextVersion
        }
        nextVersion = document.stateVersion
        const command: Command = {
          ...meta,
          seq: nextVersion,
          at: now(),
          inversePatches,
          undone: false,
        }
        set({
          document,
          commands: [...current.commands, command].slice(
            -LIMITS.commandLogEntries,
          ),
        })
        return nextVersion
      },

      undo: (actor: Actor = 'human') => {
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
              if (actor === 'human') draft.humanEditsSinceLastDescribe += 1
            },
          )
          const commands = current.commands.map((command, commandIndex) =>
            commandIndex === index ? { ...command, undone: true } : command,
          )
          commands.push({
            seq: version,
            at: now(),
            actor,
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

      reset: () => {
        const version = get().document.stateVersion
        const document = structuredClone(initialDocument)
        document.stateVersion = version
        set({
          document,
          commands: [],
        })
      },
      loadSample: () => {
        get().mutate(
          {
            actor: 'human',
            action: 'load_sample',
            summary: 'Loaded a sample board',
          },
          (draft) => {
            draft.widgets = createSampleWidgets()
          },
        )
      },
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
      version: 3,
      storage: createJSONStorage(() => boardPersistStorage()),
      partialize: ({ document, commands }) => ({ document, commands }),
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as {
          document?: unknown
          commands?: Command[]
        }
        const commands = Array.isArray(raw.commands) ? raw.commands : []
        return {
          document: migrateDocument(raw.document),
          commands: commands.filter(commandPatchesAreSafe),
        }
      },
    },
  ),
)

export { createSampleDocument, createSampleWidgets, initialDocument }
