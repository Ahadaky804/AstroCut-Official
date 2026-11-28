import {
  ASTROCUT_DB_NAME,
  ASTROCUT_DB_VERSION,
  BLOB_STORE,
  DRAFT_STORE,
  TRANSCRIPT_STORE,
  upgradeAstroCutDatabase,
  VIDEO_STORE,
} from './indexedDbSchema'

export {
  ASTROCUT_DB_NAME,
  ASTROCUT_DB_VERSION,
  BLOB_STORE,
  DRAFT_STORE,
  TRANSCRIPT_STORE,
  upgradeAstroCutDatabase,
  VIDEO_STORE,
}

export function openAstroCutDatabase(
  factory: IDBFactory | undefined = typeof indexedDB !== 'undefined'
    ? indexedDB
    : undefined,
): Promise<IDBDatabase> {
  if (!factory) {
    return Promise.reject(
      new Error('IndexedDB is not supported in this browser.'),
    )
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(ASTROCUT_DB_NAME, ASTROCUT_DB_VERSION)

    request.onupgradeneeded = () => {
      upgradeAstroCutDatabase(request.result)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ?? new Error('Unable to open local AstroCut database.'),
      )
  })
}

export function awaitIdbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

export function awaitIdbTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(tx.error ?? new Error('Storage transaction was aborted.'))
    tx.onerror = () =>
      reject(tx.error ?? new Error('Storage transaction failed.'))
  })
}
