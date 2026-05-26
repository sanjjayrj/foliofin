import { useEffect, useRef, useCallback } from 'react';
import Epub from 'epubjs';
import type { Book, Rendition } from 'epubjs';
import type { NavItem } from 'epubjs/types/navigation';
import type { ReaderSettings, Annotation } from '../../types/jellyfin';

interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

export interface AnnotationControls {
  add: (cfiRange: string, color: string) => void;
  remove: (cfiRange: string) => void;
}

export type SearchFn = (query: string) => Promise<Array<{ cfi: string; excerpt: string }>>;

interface EpubReaderProps {
  bookData: Uint8Array;
  settings: ReaderSettings;
  savedCfi?: string;
  savedAnnotations?: Annotation[];
  onProgress:            (cfi: string, percentage: number) => void;
  onTocReady:            (toc: TocItem[]) => void;
  onPrevPage:            (handler: () => void) => void;
  onNextPage:            (handler: () => void) => void;
  onTocNavigate:         (handler: (href: string) => void) => void;
  onTextSelected?:       (cfiRange: string, quote: string, position?: { x: number; y: number }) => void;
  onAnnotationControls?: (controls: AnnotationControls) => void;
  onSearchReady?:        (fn: SearchFn) => void;
  onSearchNavigate?:     (handler: (cfi: string) => void) => void;
  onEpubPage?:           (current: number, total: number) => void;
}

export const HIGHLIGHT_COLORS: Record<string, { fill: string; hex: string }> = {
  yellow: { fill: 'rgba(255,215,0,0.42)',  hex: '#FFD700' },
  green:  { fill: 'rgba(80,200,120,0.42)', hex: '#50C878' },
  blue:   { fill: 'rgba(100,160,255,0.42)',hex: '#64A0FF' },
  rose:   { fill: 'rgba(255,100,130,0.42)',hex: '#FF6482' },
};

const FONT_FAMILY: Record<string, string> = {
  serif: '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif',
  sans:  '"Inter","Segoe UI",system-ui,sans-serif',
  mono:  '"JetBrains Mono","Fira Code",monospace',
};

const THEME_BG: Record<string, string> = {
  dark:  '#0e0d0f',
  light: '#f8f5ef',
  sepia: '#f4e8c1',
};

const THEME_FG: Record<string, string> = {
  dark:  '#e8e0d0',
  light: '#1a1612',
  sepia: '#3a2e1a',
};

const PEEL_SURFACE: Record<string, string> = {
  dark:  '#1c1a22',
  light: '#ede8e2',
  sepia: '#e8d5a0',
};

const PEEL_DURATION = 520;

function buildTheme(s: ReaderSettings): Record<string, string> {
  return {
    background:    THEME_BG[s.theme],
    color:         THEME_FG[s.theme],
    'font-size':   `${s.fontSize}px`,
    'line-height': String(s.lineHeight),
    'font-family': FONT_FAMILY[s.font],
    'padding':     `0 ${s.margins}px`,
    'max-width':   '75ch',
    'margin':      '0 auto',
  };
}

function navToToc(nav: NavItem[]): TocItem[] {
  return nav.map(n => ({
    id:       n.id ?? n.href,
    href:     n.href,
    label:    n.label.trim(),
    subitems: n.subitems?.length ? navToToc(n.subitems) : undefined,
  }));
}

// Horizontal peel using CSS inset() clip-path.
// dir >= 0 (next page): peel from right edge toward left.
//   inset(0 X% 0 0) clips X% from the RIGHT, so the right side exits first,
//   revealing the new page right→left — natural book-forward motion.
// dir < 0 (prev page): mirror — left side exits first.
function peelClipPath(t: number, dir: number): string {
  const t2    = Math.min(1, Math.max(0, t));
  const eased = 1 - Math.pow(1 - t2, 2.5); // deceleration ease
  const pct   = (eased * 100).toFixed(2);
  return dir >= 0
    ? `inset(0 ${pct}% 0 0)`
    : `inset(0 0 0 ${pct}%)`;
}

export default function EpubReader({
  bookData, settings, savedCfi, savedAnnotations,
  onProgress, onTocReady, onPrevPage, onNextPage, onTocNavigate,
  onTextSelected, onAnnotationControls, onSearchReady, onSearchNavigate,
  onEpubPage,
}: EpubReaderProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const peelRef       = useRef<HTMLDivElement>(null);
  const renditionRef  = useRef<Rendition | null>(null);
  const animRef       = useRef<number | null>(null);
  const settingsRef   = useRef(settings);
  settingsRef.current = settings;

  const cancelAnim = () => {
    if (animRef.current != null) { cancelAnimationFrame(animRef.current); animRef.current = null; }
  };

  const hidePeel = () => {
    const el = peelRef.current;
    if (!el) return;
    el.style.display  = 'none';
    el.style.clipPath = '';
    el.style.filter   = '';
  };

  const navigate = useCallback((action: () => void, dir: number) => {
    cancelAnim();
    action();

    const peel = peelRef.current;
    if (!peel) return;

    peel.style.background = PEEL_SURFACE[settingsRef.current.theme];
    peel.style.display    = 'block';
    peel.style.clipPath   = peelClipPath(0, dir);
    peel.style.filter     = dir >= 0
      ? 'drop-shadow(8px 0 28px rgba(0,0,0,0.48)) drop-shadow(2px 0 6px rgba(0,0,0,0.72))'
      : 'drop-shadow(-8px 0 28px rgba(0,0,0,0.48)) drop-shadow(-2px 0 6px rgba(0,0,0,0.72))';

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / PEEL_DURATION, 1);
      if (peel) peel.style.clipPath = peelClipPath(t, dir);
      if (t < 1) { animRef.current = requestAnimationFrame(tick); }
      else { hidePeel(); animRef.current = null; }
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const applyTheme = useCallback((rendition: Rendition) => {
    const style = buildTheme(settingsRef.current);
    rendition.themes.register('foliofin', { body: style, p: { margin: '0 0 1.1em 0' } });
    rendition.themes.select('foliofin');
  }, []);

  const applyAnnotations = useCallback((rendition: Rendition, anns: Annotation[]) => {
    for (const ann of anns) {
      const color = HIGHLIGHT_COLORS[ann.color] ?? HIGHLIGHT_COLORS.yellow;
      rendition.annotations.add('highlight', ann.cfiRange, {}, () => {}, `hl-${ann.color}`, {
        fill: color.fill, 'fill-opacity': '1',
      });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const book: Book = Epub(bookData.buffer as ArrayBuffer);
    const rendition = book.renderTo(containerRef.current, {
      width: '100%', height: '100%', flow: 'paginated', spread: 'none',
    });
    renditionRef.current = rendition;
    applyTheme(rendition);

    // Track which documents already have our listeners, and keep a live reference
    // to the current section's Contents so mouseup can call cfiFromRange.
    const attachedDocs = new WeakSet<Document>();
    let currentContents: any = null;
    // Track whether the mouse button is pressed inside any epub iframe.
    // handleWindowBlur defers window.focus() until mouseup so that drag-based
    // text selection isn't interrupted by focus being stolen mid-drag.
    let isMouseDown = false;
    let shouldReclaimFocus = false;
    // Most-recent relocated CFI — used to push accurate progress once locations finish
    // generating in the background.
    let lastKnownCfi = '';
    // Timestamp of the last mouseup that successfully called onTextSelected.
    // Used to suppress the epub.js 'selected' event that fires ~250 ms later,
    // so it doesn't overwrite the position captured in mouseup.
    let lastMouseUpFiredAt = 0;
    // Position captured from mouseup — saved here so the epub.js 'selected' event
    // (which fires ~250 ms later) can attach a location hint to the CFI it provides.
    // This lets the mini-toolbar appear near the selection even when cfiFromRange fails.
    let pendingPosition: { x: number; y: number } | null = null;
    let pendingQuote = '';

    // ── Attach all per-iframe listeners once per unique Document ──────────────
    const attachToDoc = (doc: Document, iframeEl: HTMLIFrameElement) => {
      if (attachedDocs.has(doc)) return;
      attachedDocs.add(doc);

      // Track mouse button state so handleWindowBlur can defer focus reclaim
      // until after mouseup — preventing window.focus() from collapsing a
      // drag-in-progress text selection before cfiFromRange is called.
      doc.addEventListener('mousedown', () => { isMouseDown = true; });
      doc.addEventListener('mouseup', () => {
        isMouseDown = false;
        if (shouldReclaimFocus) {
          shouldReclaimFocus = false;
          requestAnimationFrame(() => window.focus());
        }
      });

      // Ensure text is selectable even if the EPUB's own CSS sets user-select:none
      try {
        if (!doc.getElementById('_ff_sel')) {
          const s = doc.createElement('style');
          s.id = '_ff_sel';
          s.textContent = '* { -webkit-user-select: text !important; user-select: text !important; }';
          (doc.head || doc.documentElement).appendChild(s);
        }
      } catch { /* cross-origin guard */ }

      // selectionchange fires continuously as the user drags to select.
      // We capture position + quote here so the pending vars are always up-to-date
      // by the time epub.js fires its 'selected' event 250 ms after the final change.
      // This handles WebKit builds that commit the selection slightly after mouseup.
      doc.addEventListener('selectionchange', () => {
        const sel = doc.defaultView?.getSelection?.();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const text = sel.toString().trim();
          if (text.length >= 2) {
            try {
              const range   = sel.getRangeAt(0);
              const selRect = range.getBoundingClientRect();
              const ifrRect = iframeEl.getBoundingClientRect();
              if (selRect.width > 0 || selRect.height > 0) {
                pendingPosition = {
                  x: ifrRect.left + selRect.left + selRect.width / 2,
                  y: ifrRect.top  + selRect.top,
                };
                pendingQuote = text;
              }
            } catch {}
          }
        }
      });

      // mouseup: attempt the fast CFI path immediately so the toolbar appears
      // without waiting 250 ms for the epub.js debounce.
      doc.addEventListener('mouseup', () => {
        const sel = doc.defaultView?.getSelection?.();
        const hasSelection = !!(
          sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length >= 2
        );

        if (hasSelection && sel) {
          try {
            const range   = sel.getRangeAt(0);
            const selRect = range.getBoundingClientRect();
            const ifrRect = iframeEl.getBoundingClientRect();
            const pos = {
              x: ifrRect.left + selRect.left + selRect.width / 2,
              y: ifrRect.top  + selRect.top,
            };
            pendingPosition = pos;
            pendingQuote    = sel.toString().trim();

            // Fast path: compute CFI now so the toolbar appears immediately.
            // Falls back to the epub.js 'selected' event (~250 ms later) if this fails.
            const allContents = (renditionRef.current as any)?.getContents?.() ?? [];
            const liveContents = allContents.find((c: any) => c?.document === doc) ?? allContents[0] ?? currentContents;
            if (liveContents) currentContents = liveContents;

            const cfi: string = currentContents?.cfiFromRange?.(range) ?? '';
            if (cfi) {
              lastMouseUpFiredAt = Date.now();
              onTextSelected?.(cfi, pendingQuote, pendingPosition);
              // pendingPosition/Quote remain set; epub.js 'selected' skips via lastMouseUpFiredAt
            }
          } catch { /* fall through to epub.js 'selected' event */ }
        } else {
          pendingPosition = null;
          pendingQuote    = '';
          // Plain click — keyboard focus is reclaimed by the window-blur handler.
        }
      });
    };

    // ── MutationObserver: detect iframes epub.js injects into the container ───
    // epub.js 0.3.93 passes view.section (not the View object) as the second arg
    // to the 'rendered' event, so we cannot get the iframe from that event.
    // Instead we watch the DOM for iframe elements being added.
    const setupIframeListeners = (iframe: HTMLIFrameElement) => {
      const tryAttach = () => {
        const doc = iframe.contentDocument;
        if (!doc || doc.readyState === 'loading') return;
        // Update currentContents for this iframe's document
        const allContents = (renditionRef.current as any)?.getContents?.() ?? [];
        const c = allContents.find((c: any) => c?.document === doc) ?? allContents[0];
        if (c) currentContents = c;
        attachToDoc(doc, iframe);
      };
      iframe.addEventListener('load', tryAttach);
      tryAttach();
    };

    const iframeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            setupIframeListeners(node);
          } else if (node instanceof Element) {
            node.querySelectorAll('iframe').forEach(el => setupIframeListeners(el as HTMLIFrameElement));
          }
        }
      }
    });

    if (containerRef.current) {
      iframeObserver.observe(containerRef.current, { childList: true, subtree: true });
      // Catch any iframes epub.js already injected before we started observing
      containerRef.current.querySelectorAll('iframe').forEach(el => setupIframeListeners(el as HTMLIFrameElement));
    }

    // 'rendered' fires as (section, view) in epub.js 0.3.93's afterDisplayed path.
    // Use view.contents directly, and call setupIframeListeners as a safety net in
    // case the MutationObserver missed the iframe (e.g., race on first render).
    rendition.on('rendered', (_section: unknown, view: any) => {
      if (view?.contents) currentContents = view.contents;
      if (view?.iframe instanceof HTMLIFrameElement) setupIframeListeners(view.iframe);
      // Fallback via API when view isn't passed (unlikely but safe)
      if (!view?.contents) {
        const all = (renditionRef.current as any)?.getContents?.() ?? [];
        if (all[0]) currentContents = all[0];
      }
    });

    book.ready
      .then(async () => {
        const nav = await book.loaded.navigation;
        if (nav?.toc) onTocReady(navToToc(nav.toc));
        await rendition.display(savedCfi ?? undefined);

        if (savedAnnotations?.length) applyAnnotations(rendition, savedAnnotations);

        // Generate reading locations in the background.
        // epub.js needs this to compute accurate progress percentages and location
        // indices. Without it, percentageFromCfi() always returns null → 0%.
        // We don't await it so the book opens immediately; when it finishes we
        // push a corrected progress + page-number update using the last known CFI.
        book.locations.generate(1024).then(() => {
          const locs = (book as any).locations;
          const locTotal: number = locs?.total ?? 0;
          if (locTotal > 0 && lastKnownCfi) {
            const pct = (((locs.percentageFromCfi?.(lastKnownCfi) as number | null) ?? 0) * 100);
            onProgress(lastKnownCfi, pct);
            const idx: number = (locs.locationFromCfi?.(lastKnownCfi) as number) ?? -1;
            if (idx >= 0) onEpubPage?.(idx + 1, locTotal);
          }
        }).catch(() => { /* locations are optional; progress may be less accurate */ });

        // Spine-based search — book.search() is unreliable across epub.js builds;
        // iterating spine items with item.find() is the stable API.
        onSearchReady?.(async (query: string) => {
          const q = query.trim();
          if (!q) return [];
          const all: Array<{ cfi: string; excerpt: string }> = [];
          try {
            const spine = (book as any).spine;
            const items: any[] = spine?.spineItems ?? spine?.items ?? [];
            for (const item of items) {
              try {
                await item.load(book.load.bind(book));
                const hits: any[] = item.find(q) ?? [];
                for (const h of hits) {
                  all.push({ cfi: String(h.cfi ?? ''), excerpt: String(h.excerpt ?? '') });
                }
                item.unload();
              } catch { /* skip unreachable sections */ }
            }
          } catch { /* ignore */ }
          return all;
        });
      })
      .catch((err: Error) => console.error('EpubReader: failed to open', err));

    rendition.on('relocated', (location: any) => {
      if (!location?.start?.cfi) return;
      lastKnownCfi = location.start.cfi;

      const locs = (book as any).locations;
      const locTotal: number = locs?.total ?? 0;

      if (locTotal > 0) {
        // Locations have been generated — use accurate values.
        const pct = (((locs.percentageFromCfi?.(location.start.cfi) as number | null) ?? 0) * 100);
        onProgress(location.start.cfi, pct);
        const idx: number = (locs.locationFromCfi?.(location.start.cfi) as number) ?? -1;
        if (idx >= 0) onEpubPage?.(idx + 1, locTotal);
      }
      // When locTotal === 0, locations are still generating — don't call onProgress
      // at all, so we don't overwrite the persisted percentage (from last session)
      // with a meaningless 0. The locations.generate().then() callback below will
      // push the correct value once generation completes.
    });

    // epub.js 'selected' event — fires ~250 ms after the user releases the mouse.
    // This is the most reliable source of the CFI for a selection. We pair it with
    // the position we captured earlier in mouseup (pendingPosition), giving us both
    // an accurate CFI AND screen coordinates for the floating mini-toolbar.
    rendition.on('selected', (cfiRange: string, contents: any) => {
      // Skip if mouseup already provided a CFI within the last 600 ms.
      if (Date.now() - lastMouseUpFiredAt < 600) return;
      // Use quote captured at mouseup time; fallback to live selection via Contents API.
      const qt  = pendingQuote || contents?.window?.getSelection?.()?.toString().trim() || '';
      const pos = pendingPosition;
      pendingPosition = null;
      pendingQuote    = '';
      if (cfiRange && qt.length >= 2) {
        onTextSelected?.(cfiRange, qt, pos ?? undefined);
      }
    });

    // epub.js forwards DOM_EVENTS (including 'keydown') from every iframe's document
    // to the rendition via its passEvents hook. This is the reliable channel for
    // arrow-key navigation when the epub iframe has focus — it requires no MutationObserver
    // timing tricks and fires even if the parent window has lost focus.
    rendition.on('keydown', (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          navigate(() => renditionRef.current?.next(),  1);
        } else {
          navigate(() => renditionRef.current?.prev(), -1);
        }
      }
    });

    onAnnotationControls?.({
      add: (cfiRange: string, color: string) => {
        const c = HIGHLIGHT_COLORS[color] ?? HIGHLIGHT_COLORS.yellow;
        rendition.annotations.add('highlight', cfiRange, {}, () => {}, `hl-${color}`, {
          fill: c.fill, 'fill-opacity': '1',
        });
      },
      remove: (cfiRange: string) => rendition.annotations.remove('highlight', cfiRange),
    });

    onPrevPage(()  => navigate(() => renditionRef.current?.prev(), -1));
    onNextPage(()  => navigate(() => renditionRef.current?.next(),  1));
    onTocNavigate((href: string) => navigate(() => renditionRef.current?.display(href), 1));

    // Navigate to a search result CFI and briefly flash a yellow highlight so the
    // user can spot the matched text in context.
    onSearchNavigate?.((cfi: string) => {
      navigate(() => renditionRef.current?.display(cfi), 1);
      setTimeout(() => {
        try {
          renditionRef.current?.annotations.add(
            'highlight', cfi, {}, () => {}, 'search-hit',
            { fill: 'rgba(255,200,0,0.55)', 'fill-opacity': '1' }
          );
          setTimeout(() => {
            try { renditionRef.current?.annotations.remove('highlight', cfi); } catch { /* ignore */ }
          }, 2200);
        } catch { /* ignore */ }
      }, 700);
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(() => renditionRef.current?.next(),  1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(() => renditionRef.current?.prev(), -1);
    };
    window.addEventListener('keydown', handleKey);

    // When the epub iframe captures keyboard focus (on click), reclaim it for the
    // parent window so arrow-key navigation keeps working at all times.
    // If a mouse drag is in progress (isMouseDown), defer the reclaim until the
    // mouseup handler fires — this lets the selection complete and cfiFromRange
    // run before window.focus() collapses the iframe's selection.
    const handleWindowBlur = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (isMouseDown) {
        shouldReclaimFocus = true;
        return;
      }
      requestAnimationFrame(() => window.focus());
    };
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('blur', handleWindowBlur);
      iframeObserver.disconnect();
      cancelAnim();
      rendition.destroy();
      book.destroy();
      renditionRef.current = null;
    };
  }, [bookData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (renditionRef.current) applyTheme(renditionRef.current);
    if (peelRef.current && peelRef.current.style.display !== 'none') {
      peelRef.current.style.background = PEEL_SURFACE[settings.theme];
    }
  }, [settings, applyTheme]);

  return (
    <div
      className="relative w-full h-full epub-container reader-content overflow-hidden"
      style={{ background: THEME_BG[settings.theme] }}
    >
      <div ref={containerRef} className="w-full h-full" />
      <div
        ref={peelRef}
        className="absolute inset-0 pointer-events-none"
        style={{ display: 'none', willChange: 'clip-path', zIndex: 5, background: PEEL_SURFACE[settings.theme] }}
      />
    </div>
  );
}
