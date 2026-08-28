import {
  applyPatches,
  enablePatches,
  produce,
  produceWithPatches,
  type Draft,
} from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  BoardDocument,
  Command,
  MutationMeta,
} from '../model/types'

enablePatches()

const now = () => new Date().toISOString()

export const initialDocument: BoardDocument = {
  title: 'Untitled workspace',
  stateVersion: 0,
  widgets: [
    {
      id: 'w_welcome',
      type: 'note',
      title: 'A canvas that listens',
      content:
        'Tell your agent what you are working on. Chameleon will turn this quiet space into the software you need.',
      position: { x: 0, y: 0, w: 5, h: 5 },
      createdAt: now(),
      updatedAt: now(),
      lastModifiedBy: 'agent',
    },
    {
      id: 'w_first_steps',
      type: 'table',
      title: 'What happens next',
      content: '1. Your agent reads the board\n2. Widgets appear live\n3. You keep editing by hand',
      position: { x: 5, y: 0, w: 7, h: 5 },
      createdAt: now(),
      updatedAt: now(),
      lastModifiedBy: 'agent',
    },
  ],
}

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
}

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      document: initialDocument,
      commands: [],
      hydrated: false,

      mutate: (meta, recipe) => {
        let nextVersion = get().document.stateVersion
        set((state) => {
          const [document, patches, inversePatches] = produceWithPatches(
            state.document,
            (draft) => {
              recipe(draft)
              draft.stateVersion += 1
            },
          )
          if (patches.length === 1 && patches[0]?.path[0] === 'stateVersion') {
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
          return { document, commands: [...state.commands, command].slice(-500) }
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
          return { document: restored, commands: commands.slice(-500) }
        })
        return target
      },

      reset: () => set({ document: initialDocument, commands: [] }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'chameleon-board-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ document, commands }) => ({ document, commands }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
)
