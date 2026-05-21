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
  onTextSelected?:       (cfiRange: string, quote: string) => void;
  onAnnotationControls?: (controls: AnnotationControls) => void;
  onSearchReady?:        (fn: SearchFn) => void;
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
// dir >= 0 (next page): peel from right edge toward left — natural book forward.
//   inset(0 X% 0 0) clips X% from the RIGHT, so the right side of the overlay
//   disappears first, revealing the new page from the right side inward.
// dir < 0 (prev page): mirror — peel from left edge toward right.
//
// Easing: decelerating curve (fast start, slow settle) mimics a physical page flip.
function peelClipPath(t: number, dir: number): string {
  // Deceleration ease: 1-(1-t)^2.5
  const t2    = Math.min(1, Math.max(0, t));
  const eased = 1 - Math.pow(1 - t2, 2.5);
  const pct   = (eased * 100).toFixed(2);
  return dir >= 0
    ? `inset(0 ${pct}% 0 0)`  // forward: right side exits first → reveals right→left ✓
    : `inset(0 0 0 ${pct}%)`; // backward: left side exits first → reveals left→right ✓
}

export default function EpubReader({
  bookData, settings, savedCfi, savedAnnotations,
  onProgress, onTocReady, onPrevPage, onNextPage, onTocNavigate,
  onTextSelected, onAnnotationControls, onSearchReady,
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
    // Double drop-shadow: diffuse ambient + sharp peel-edge shadow
    peel.style.filter = dir >= 0
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

    // Hook each rendered section to:
    // 1. Disable epub.js's built-in click-to-navigate (which blocks text selection)
    // 2. Allow mousedown/move/up to pass through for text selection
    // Navigation is handled externally via our tap strips, bottom buttons, and keyboard.
    rendition.on('rendered', (_section: unknown, view: any) => {
      const doc: Document | undefined =
        view?.document ?? view?.contents?.document ?? view?.window?.document;
      if (!doc) return;
      // Capture phase: fires before epub.js's bubble-phase click-nav handler.
      // stopImmediatePropagation blocks epub.js navigation while leaving
      // mousedown/mousemove/mouseup events (needed for text selection) untouched.
      doc.addEventListener('click', (e: Event) => {
        e.stopImmediatePropagation();
      }, true);
    });

    book.ready
      .then(async () => {
        const nav = await book.loaded.navigation;
        if (nav?.toc) onTocReady(navToToc(nav.toc));
        await rendition.display(savedCfi ?? undefined);

        if (savedAnnotations?.length) applyAnnotations(rendition, savedAnnotations);

        onSearchReady?.(async (query: string) => {
          if (typeof (book as any).search !== 'function') return [];
          try {
            const res = await (book as any).search(query);
            return Array.isArray(res) ? res : [];
          } catch { return []; }
        });
      })
      .catch((err: Error) => console.error('EpubReader: failed to open', err));

    rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
      if (location?.start) {
        onProgress(location.start.cfi, (location.start.percentage ?? 0) * 100);
      }
    });

    rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
      if (!cfiRange.includes(',')) return;
      const quote = contents.window.getSelection()?.toString().trim() ?? '';
      if (quote.length > 0) onTextSelected?.(cfiRange, quote);
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
