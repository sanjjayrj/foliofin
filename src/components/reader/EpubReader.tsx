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
    // to the current section's Contents so selectionchange can call cfiFromRange.
    const attachedDocs = new WeakSet<Document>();
    let currentContents: any = null;
    // Most-recent relocated CFI — used to push accurate progress once locations finish
    // generating in the background.
    let lastKnownCfi = '';
    // Timestamp of the last mouseup that successfully called onTextSelected.
    // Used to suppress the epub.js 'selected' event that fires ~250 ms later,
    // so it doesn't overwrite the position captured in mouseup.
    let lastMouseUpFiredAt = 0;

    // ── Attach all per-iframe listeners once per unique Document ──────────────
    const attachToDoc = (doc: Document, iframeEl: HTMLIFrameElement | undefined) => {
      if (attachedDocs.has(doc)) return;
      attachedDocs.add(doc);

      // 1. Block epub.js's capture-phase click-nav so our tap strips handle navigation.
      doc.addEventListener('click', (e: Event) => e.stopImmediatePropagation(), true);

      // 2. Arrow-key mirroring — call navigate() directly from the iframe keydown
      //    event so arrow keys flip pages even when the iframe holds focus.
      //    Calling navigate() directly is more reliable than dispatching a synthetic
      //    KeyboardEvent to the parent window, which can be silently dropped.
      const mirrorArrow = (e: KeyboardEvent) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            navigate(() => renditionRef.current?.next(),  1);
          } else {
            navigate(() => renditionRef.current?.prev(), -1);
          }
        }
      };
      const iframeWin = iframeEl?.contentWindow;
      if (iframeWin && (iframeWin as Window) !== window) {
        iframeWin.addEventListener('keydown', mirrorArrow);
      } else {
        doc.addEventListener('keydown', mirrorArrow);
      }

      // 3. selectionchange — kept for the side-effect of keeping the event chain
      //    alive; actual CFI extraction happens in mouseup (step 4).
      doc.addEventListener('selectionchange', () => { /* tracking */ });

      // 4. Mouseup: primary handler for text-selection events.
      //    On a plain click we reclaim keyboard focus so arrow keys flip pages.
      //    On a selection we compute the bounding rect of the selected range in
      //    parent-window coordinates and call onTextSelected with a position hint
      //    so the floating mini-toolbar can appear near the selected text.
      doc.addEventListener('mouseup', () => {
        const sel = doc.defaultView?.getSelection?.();
        const liveSelection = !!(
          sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length >= 2
        );

        if (liveSelection && sel) {
          try {
            const range   = sel.getRangeAt(0);
            const selRect = range.getBoundingClientRect();
            const ifrRect = iframeEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
            const pos = {
              x: ifrRect.left + selRect.left + selRect.width / 2,
              y: ifrRect.top  + selRect.top,
            };
            const quote = sel.toString().trim();
            const cfi: string = currentContents?.cfiFromRange?.(range) ?? '';
            if (cfi && quote.length >= 2) {
              lastMouseUpFiredAt = Date.now();
              onTextSelected?.(cfi, quote, pos);
            }
          } catch { /* cfiFromRange failed — 'selected' event is the fallback */ }
        } else {
          // Plain click with no selection: reclaim focus → removes text caret from iframe.
          setTimeout(() => window.focus(), 80);
        }
      });
    };

    // ── rendered: fires for every new section view ─────────────────────────────
    rendition.on('rendered', (_section: unknown, view: any) => {
      // Always keep currentContents up to date so the selectionchange handler
      // can call cfiFromRange on the correct section.
      currentContents = view?.contents ?? currentContents;

      const iframeEl = view?.iframe as HTMLIFrameElement | undefined;
      const doc: Document | null =
        (view?.contents as any)?.document ??
        iframeEl?.contentDocument ??
        null;

      if (!doc) {
        // Contents object may not yet be assigned immediately after rendering —
        // retry after a short tick to let the iframe settle.
        setTimeout(() => {
          const retryContents = view?.contents ?? null;
          const retryDoc: Document | null =
            retryContents?.document ?? iframeEl?.contentDocument ?? null;
          if (retryDoc) {
            if (retryContents) currentContents = retryContents;
            attachToDoc(retryDoc, iframeEl);
          }
        }, 80);
        return;
      }

      attachToDoc(doc, iframeEl);
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
      } else {
        // Locations not yet ready — percentage is 0 until generation completes.
        // We still save the CFI so resume-reading works correctly.
        onProgress(location.start.cfi, 0);
      }
    });

    // epub.js 'selected' event — fires ~250 ms after mouseup as a fallback
    // (e.g. keyboard selection where mouseup never fires). Skip it when mouseup
    // already handled this selection so we don't overwrite the position hint.
    rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
      if (Date.now() - lastMouseUpFiredAt < 600) return;
      const quote = contents.window.getSelection()?.toString().trim() ?? '';
      if (cfiRange && quote.length > 0) {
        onTextSelected?.(cfiRange, quote);
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

    return () => {
      window.removeEventListener('keydown', handleKey);
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
