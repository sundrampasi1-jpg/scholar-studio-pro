import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PdfViewer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<HTMLDivElement>(null);
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const pinchAnchorRef = useRef<{ x: number; y: number; scrollX: number; scrollY: number; startZoom: number; horizontal: HTMLElement | null; vertical: HTMLElement | null } | null>(null);
  const renderedZoom = useRef<Map<number, number>>(new Map());
  const scheduleVisiblePagesRef = useRef<() => void>(() => {});
  const pinchPendingZoomRef = useRef<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);
  const pinchZoomRef = useRef(1);
  const [attempt, setAttempt] = useState(0);
  const [pageRatio, setPageRatio] = useState(1.414);
  const pdfDocRef = useRef<any>(null);
  const renderedPages = useRef<Set<number>>(new Set());
  const renderingPages = useRef<Set<number>>(new Set());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasks = useRef<Map<number, any>>(new Map());
  const queue = useRef<number[]>([]);
  const activeRenders = useRef(0);
  const pumpRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setNumPages(0);
    pinchZoomRef.current = 1;
    if (containerRef.current) containerRef.current.style.zoom = "1";
    renderedPages.current.clear();
    renderedZoom.current.clear();
    renderingPages.current.clear();
    pageRefs.current.clear();
    queue.current = [];
    activeRenders.current = 0;

    let loadingTask: any;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // Bundle the worker with the app so PDF rendering does not depend on a third-party CDN.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        // Let PDF.js request byte ranges progressively instead of downloading the
        // entire document into memory before the first page can appear.
        loadingTask = pdfjs.getDocument({
          url,
          rangeChunkSize: 262144,
          disableRange: false,
          disableStream: false,
          disableAutoFetch: false,
        });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        const firstPage = await doc.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        if (!cancelled && firstViewport.width > 0) {
          setPageRatio(firstViewport.height / firstViewport.width);
        }
        firstPage.cleanup();
        setNumPages(doc.numPages);
        setState("ready");
      } catch (e) {
        console.error("PDF load failed", e);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTasks.current.forEach((task) => {
        try { task.cancel(); } catch {}
      });
      renderTasks.current.clear();
      queue.current = [];
      renderingPages.current.clear();
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      if (doc) void doc.destroy().catch(() => {});
      else if (loadingTask) void loadingTask.destroy().catch(() => {});
    };
  }, [url, attempt]);

  useEffect(() => {
    const host = gestureRef.current;
    if (!host) return;
    // Handle pinch zoom directly in CSS. This avoids re-rendering every PDF canvas
    // (which caused mobile browsers to run out of memory and show the app error page).
    host.style.touchAction = "pan-x pan-y";
    const distance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };
    const onStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        if (event.cancelable) event.preventDefault();
        const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        const horizontal = containerRef.current?.parentElement || null;
        let vertical: HTMLElement | null = host;
        while (vertical && vertical !== document.body) {
          const style = window.getComputedStyle(vertical);
          if (/(auto|scroll|overlay)/.test(style.overflowY) && vertical.scrollHeight > vertical.clientHeight + 1) break;
          vertical = vertical.parentElement;
        }
        const hRect = horizontal?.getBoundingClientRect();
        const vRect = vertical?.getBoundingClientRect();
        pinchAnchorRef.current = {
          x: midX - (hRect?.left || 0),
          y: midY - (vRect?.top || 0),
          scrollX: horizontal?.scrollLeft || 0,
          scrollY: vertical?.scrollTop || 0,
          startZoom: pinchZoomRef.current,
          horizontal,
          vertical,
        };
        pinchStartRef.current = { distance: distance(event.touches), zoom: pinchZoomRef.current };
        pinchPendingZoomRef.current = pinchZoomRef.current;
      }
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchStartRef.current) return;
      if (event.cancelable) event.preventDefault();
      const ratio = distance(event.touches) / Math.max(1, pinchStartRef.current.distance);
      const nextZoom = Math.max(0.75, Math.min(2.5, pinchStartRef.current.zoom * ratio));
      pinchPendingZoomRef.current = nextZoom;
      if (containerRef.current) containerRef.current.style.zoom = String(nextZoom);
      const anchor = pinchAnchorRef.current;
      if (anchor) {
        if (anchor.horizontal) anchor.horizontal.scrollLeft = ((anchor.scrollX + anchor.x) / anchor.startZoom) * nextZoom - anchor.x;
        if (anchor.vertical) anchor.vertical.scrollTop = ((anchor.scrollY + anchor.y) / anchor.startZoom) * nextZoom - anchor.y;
      }
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchStartRef.current = null;
        const nextZoom = pinchPendingZoomRef.current;
        pinchPendingZoomRef.current = null;
        if (nextZoom !== null) {
          pinchZoomRef.current = nextZoom;
          if (containerRef.current) containerRef.current.style.zoom = String(nextZoom);
          scheduleVisiblePagesRef.current();
        }
        pinchAnchorRef.current = null;
      }
    };
    host.addEventListener("touchstart", onStart, { passive: false, capture: true });
    host.addEventListener("touchmove", onMove, { passive: false, capture: true });
    host.addEventListener("touchend", onEnd, { passive: true, capture: true });
    host.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
    return () => {
      host.removeEventListener("touchstart", onStart, true);
      host.removeEventListener("touchmove", onMove, true);
      host.removeEventListener("touchend", onEnd, true);
      host.removeEventListener("touchcancel", onEnd, true);
    };
  }, []);

  useEffect(() => {
    if (state !== "ready" || !containerRef.current) return;

    // Keep existing canvases visible while only pages in/near the viewport are
    // upgraded to a sharper backing resolution after a pinch gesture.

    let disposed = false;
    const processPage = async (pageNum: number) => {
      const doc = pdfDocRef.current;
      const host = pageRefs.current.get(pageNum);
      if (!doc || !host || disposed) return;
      try {
        const page = await doc.getPage(pageNum);
        if (disposed || !host.isConnected) {
          page.cleanup();
          return;
        }
        const base = page.getViewport({ scale: 1 });
        // Measure the fixed-width scroll viewport, never the content wrapper: the latter
        // grows with zoom and would multiply the next pinch scale, eventually exhausting memory.
        const fitWidth = containerRef.current?.parentElement?.clientWidth || window.innerWidth || 800;
        const width = Math.max(200, fitWidth);
        const cssHeight = width * (base.height / base.width);
        // Bound each backing canvas so a long PDF cannot exhaust Android WebView memory.
        const pixelBudget = 12_000_000;
        const qualityScale = Math.sqrt(pixelBudget / Math.max(1, width * cssHeight));
        const requestedZoom = Math.max(1, pinchZoomRef.current);
        const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1) * requestedZoom, 3, qualityScale);
        const scale = (width / base.width) * pixelRatio;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = Math.ceil(width) + "px";
        canvas.style.maxWidth = "none";
        canvas.style.flex = "0 0 auto";
        canvas.style.height = "auto";
        canvas.className = "mx-auto block bg-card";
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas is unavailable");
        const task = page.render({ canvasContext: context, viewport });
        renderTasks.current.set(pageNum, task);
        await task.promise;
        if (!disposed && host.isConnected) {
          host.replaceChildren(canvas);
          renderedPages.current.add(pageNum);
          renderedZoom.current.set(pageNum, requestedZoom);
        }
        page.cleanup();
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") {
          console.error("Page render failed", pageNum, e);
          // Keep the previous lower-resolution canvas visible if an HD upgrade fails.
        }
      } finally {
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);
      }
    };

    const pump = () => {
      while (!disposed && activeRenders.current < 1 && queue.current.length) {
        const pageNum = queue.current.shift()!;
        activeRenders.current += 1;
        void processPage(pageNum).finally(() => {
          activeRenders.current = Math.max(0, activeRenders.current - 1);
          pumpRef.current();
        });
      }
    };
    pumpRef.current = pump;

    const schedulePage = (pageNum: number) => {
      if (
        pageNum < 1 ||
        pageNum > numPages ||
        (renderedPages.current.has(pageNum) && (renderedZoom.current.get(pageNum) || 1) >= Math.max(1, pinchZoomRef.current) - 0.05) ||
        renderingPages.current.has(pageNum)
      ) return;
      renderingPages.current.add(pageNum);
      queue.current.push(pageNum);
      pump();
    };

    // Observe against the actual scrollable ancestor, not always the viewport.
    // Notes modal scrolls on the PdfViewer wrapper itself. Use that real vertical
    // scroller as the observer root so pages are rendered as they enter view.
    let scrollRoot: HTMLElement | null = gestureRef.current;
    while (scrollRoot && scrollRoot !== document.body) {
      const overflowY = window.getComputedStyle(scrollRoot).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && scrollRoot.scrollHeight > scrollRoot.clientHeight + 1) break;
      scrollRoot = scrollRoot.parentElement;
    }
    if (scrollRoot === document.body) scrollRoot = null;

    const scheduleVisiblePages = () => {
      const viewportTop = scrollRoot?.getBoundingClientRect().top ?? 0;
      const viewportBottom = scrollRoot ? viewportTop + scrollRoot.clientHeight : window.innerHeight;
      const candidates: number[] = [];
      pageRefs.current.forEach((el, pageNum) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= viewportTop - 500 && rect.top <= viewportBottom + 500) candidates.push(pageNum);
      });
      candidates.sort((a, b) => a - b);
      candidates.forEach(schedulePage);
    };
    scheduleVisiblePagesRef.current = scheduleVisiblePages;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset["page"]))
          .filter((pageNum) => Number.isFinite(pageNum));
        // Prioritize pages nearest the current viewport.
        visible.sort((a, b) => a - b);
        visible.forEach(schedulePage);
      },
      { root: scrollRoot, rootMargin: "900px 0px", threshold: 0.01 }
    );

    pageRefs.current.forEach((el) => observer.observe(el));
    // Start rendering immediately; the observer will queue the remaining pages as needed.
    schedulePage(1);
    schedulePage(2);

    return () => {
      disposed = true;
      observer.disconnect();
      queue.current = [];
      renderTasks.current.forEach((task) => {
        try { task.cancel(); } catch {}
      });
      renderTasks.current.clear();
      renderingPages.current.clear();
      scheduleVisiblePagesRef.current = () => {};
      pumpRef.current = () => {};
    };
  }, [state, numPages]);

  return (
    <div ref={gestureRef} className={className}>
      {state === "loading" && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening PDF…
        </p>
      )}
      {state === "error" && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Could not show this PDF.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}
      {state === "ready" && numPages > 0 && (
        <div className="sticky top-0 z-20 mb-2 bg-surface/95 px-3 py-2 text-center text-xs font-semibold text-foreground shadow-sm">
          Pinch with two fingers to zoom · {numPages} pages
        </div>
      )}
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div ref={containerRef} className="w-max min-w-full">
          {state === "ready" &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
                style={{ aspectRatio: `1 / ${pageRatio}` }}
                className="flex w-max min-w-full items-center justify-center overflow-visible"
              >
                {!renderedPages.current.has(pageNum) && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export async function downloadFile(url: string, title: string) {
  const id = toast.loading("Downloading…");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const bytes = await res.arrayBuffer();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const name = title.replace(/[^\w.-]+/g, "_") + (title.toLowerCase().endsWith(".pdf") ? "" : ".pdf");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    try {
      const raw = localStorage.getItem("jk_downloads");
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({ title, downloadedAt: new Date().toISOString() });
      localStorage.setItem("jk_downloads", JSON.stringify(list.slice(0, 100)));
    } catch {}
    toast.success("Saved to your downloads", { id });
  } catch {
    toast.error("Download failed. Check your connection and try again.", { id });
  }
}
