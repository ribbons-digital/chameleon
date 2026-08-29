let syncQueue: Promise<void> = Promise.resolve()

export function queueMintedSync(
  synchronize: () => Promise<void>,
): void {
  syncQueue = syncQueue
    .then(synchronize)
    .catch(() => undefined)
}

export function awaitMintedSync(): Promise<void> {
  return syncQueue.then(() => undefined)
}
