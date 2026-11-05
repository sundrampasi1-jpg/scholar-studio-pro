// Registry of videos saved for offline playback inside the app (Profile → My Downloads).
// Videos live in IndexedDB only — never pushed to the device Gallery or Downloads folder.

export type DownloadEntry = {
  key: string;
  lessonId: string;
  title: string;
  courseId: string | null;
  size: number;
  at: string;
};

const REG = "jk_downloads_v2";

export function listDownloads(): DownloadEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(REG) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(entries: DownloadEntry[]) {
  localStorage.setItem(REG, JSON.stringify(entries));
}

export function addDownload(entry: DownloadEntry) {
  const all = listDownloads().filter((d) => d.key !== entry.key);
  all.unshift(entry);
  write(all);
}

export function removeDownload(key: string) {
  write(listDownloads().filter((d) => d.key !== key));
}

export function isDownloaded(key: string): boolean {
  return listDownloads().some((d) => d.key === key);
}
