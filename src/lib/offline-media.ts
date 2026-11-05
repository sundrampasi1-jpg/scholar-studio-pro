// Offline media cache (IndexedDB) + in-app downloads for lesson videos.
// Videos stay inside the app: download fetches the bytes here, saves them for
// offline playback, then hands the file to the device download manager.

const DB_NAME = "jk-offline-media";
const STORE = "media";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

export async function cacheMedia(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Cache write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Cache write failed"));
  });
  db.close();
}

export async function getCachedMedia(key: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Cache read failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function downloadAndCache(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed — try again");
  const blob = await res.blob();
  if (!blob.size) throw new Error("Download failed — empty file");
  try {
    await cacheMedia(url, blob);
  } catch {
    // Caching is best-effort; the download itself still completes.
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function deleteCachedMedia(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Cache delete failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Cache delete failed"));
  });
  db.close();
}

export function mediaExt(url: string): string {
  return url.split("?")[0]?.match(/\.(mp4|webm|mov|mkv|m4v)$/i)?.[1] ?? "mp4";
}
