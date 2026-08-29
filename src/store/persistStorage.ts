import { useEffect, useState } from 'react'
import type { StateStorage } from 'zustand/middleware'

export type PersistHealth = 'ok' | 'quota'

let health: PersistHealth = 'ok'
const listeners = new Set<(next: PersistHealth) => void>()

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.code === 22)
  )
}

function setHealth(next: PersistHealth): void {
  if (next === health) return
  health = next
  for (const listener of listeners) listener(next)
}

export function getPersistHealth(): PersistHealth {
  return health
}

export function subscribePersistHealth(
  listener: (next: PersistHealth) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePersistHealth(): PersistHealth {
  const [current, setCurrent] = useState(getPersistHealth)
  useEffect(() => subscribePersistHealth(setCurrent), [])
  return current
}

export function boardPersistStorage(): StateStorage {
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value)
        setHealth('ok')
      } catch (error) {
        if (isQuotaError(error)) {
          setHealth('quota')
          return
        }
        throw error
      }
    },
    removeItem: (name) => localStorage.removeItem(name),
  }
}
