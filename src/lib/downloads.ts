export type DownloadEntry = {
  key: string;
  lessonId: string;
  title: string;
  courseId: string | null;
  size: number;
  at: string;
};

const REG = "jk_downloads_v2";
const LEGACY_REG = "jk_downloads";

function readJson(key: string): unknown[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalize(item: any): DownloadEntry | null {
  if (!item || typeof item !== "object") return null;

  const lessonId = String(item.lessonId || item.key || "");
  if (!lessonId) return null;

  return {
    key: String(item.key || lessonId),
    lessonId,
    title: String(item.title || "Downloaded lesson"),
    courseId: item.courseId ? String(item.courseId) : null,
    size: Number(item.size || 0),
    at: String(item.at || item.downloadedAt || new Date().toISOString()),
  };
}

export function listDownloads(): DownloadEntry[] {
  const current = readJson(REG)
    .map(normalize)
    .filter((item): item is DownloadEntry => item !== null);

  const legacy = readJson(LEGACY_REG)
    .map(normalize)
    .filter((item): item is DownloadEntry => item !== null);

  const merged = new Map<string, DownloadEntry>();

  [...legacy, ...current].forEach((item) => {
    merged.set(item.lessonId, item);
  });

  const result = [...merged.values()].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  try {
    localStorage.setItem(REG, JSON.stringify(result));
  } catch {
    // Preserve returned entries if storage is unavailable.
  }

  return result;
}

function write(entries: DownloadEntry[]) {
  localStorage.setItem(REG, JSON.stringify(entries));
}

export function addDownload(entry: DownloadEntry) {
  const all = listDownloads().filter(
    (item) => item.lessonId !== entry.lessonId && item.key !== entry.key
  );

  all.unshift(entry);
  write(all);
}

export function removeDownload(key: string) {
  write(
    listDownloads().filter(
      (item) => item.key !== key && item.lessonId !== key
    )
  );
}

export function isDownloaded(key: string): boolean {
  return listDownloads().some(
    (item) => item.key === key || item.lessonId === key
  );
}
