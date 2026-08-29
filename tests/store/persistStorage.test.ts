import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  boardPersistStorage,
  getPersistHealth,
} from '../../src/store/persistStorage'

describe('boardPersistStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    boardPersistStorage().setItem('chameleon-board-v1', '{}')
    localStorage.clear()
  })

  it('marks quota health when setItem throws QuotaExceededError', () => {
    const quota = new DOMException('full', 'QuotaExceededError')
    const setItem = vi.fn(() => {
      throw quota
    })
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem,
      removeItem: vi.fn(),
    })
    const storage = boardPersistStorage()
    storage.setItem('chameleon-board-v1', '{"state":{}}')
    expect(getPersistHealth()).toBe('quota')
  })

  it('clears quota health after a successful write', () => {
    const quota = new DOMException('full', 'QuotaExceededError')
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw quota
      },
      removeItem: vi.fn(),
    })
    const storage = boardPersistStorage()
    storage.setItem('chameleon-board-v1', '{"state":{}}')
    expect(getPersistHealth()).toBe('quota')
    vi.unstubAllGlobals()
    storage.setItem('chameleon-board-v1', '{}')
    expect(getPersistHealth()).toBe('ok')
  })
})
