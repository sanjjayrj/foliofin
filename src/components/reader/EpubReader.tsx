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
  onProgress:          (cfi: string, percentage: number) => void;
  onTocReady:          (toc: TocItem[]) => void;
  onPrevPage:          (handler: () => void) => void;
  onNextPage:          (handler: () => void) => void;
  onTocNavigate:       (handler: (href: string) => void) => void;
  onTextSelected?:     (cfiRange: string, quote: string) => void;
  onAnnotationControls?: (controls: AnnotationControls) => void;
  onSearchReady?:      (fn: SearchFn) => void;
}

// Shared highlight fill colors (also used by ReaderControls swatches)
export const HIGHLIGHT_COLORS: Record<string, { fill: string; hex: string }> = {
  yellow: { fill: 'rgba(255,215,0,0.42)',   hex: '#FFD700' },
  green:  { fill: 'rgba(80,200,120,0.42)',   hex: '#50C878' },
  blue:   { fill: 'rgba(100,160,255,0.42)',  hex: '#64A0FF' },
  rose:   { fill: 'rgba(255,100,130,0.42)',  hex: '#FF6482' },
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

const PEEL_DURATION = 560; // ms

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

// Horizontal page-peel: the overlay starts at full coverage and clips
// away horizontally — forward peels from right edge to left,
// backward peels from left edge to right.
// clip-path inset(top right bottom left)
function peelClipPath(t: number, dir: number): string {
  const pct = (t * 100).toFixed(2);
  return dir >= 0
    ? `inset(0 0 0 ${pct}%)`   // forward: overlay left edge retreats rightward
    : `inset(0 ${pct}% 0 0)`;  // backward: overlay right edge retreats leftward
}

export default function EpubReader({
  bookData, settings, savedCfi, savedAnnotations,
  onProgress, onTocReady, onPrevPage, onNextPage, onTocNavigate,
  onTextSelected, onAnnotationControls, onSearchReady,
}: EpubReaderProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const peelRef       = useRef<HTMLDivElement>(null);
  const renditionRef  = useRef<Rendition | null>(null);
  const bookRef       = useRef<Book | null>(null);
  const animRef       = useRef<number | null>(null);
  const settingsRef   = useRef(settings);
  settingsRef.current = settings;

  const cancelAnim = () => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
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
    // Shadow on the leading edge of the peel to suggest depth
    peel.style.filter = dir >= 0
      ? 'drop-shadow(6px 0 18px rgba(0,0,0,0.45))'
      : 'drop-shadow(-6px 0 18px rgba(0,0,0,0.45))';

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / PEEL_DURATION, 1);
      if (peel) peel.style.clipPath = peelClipPath(t, dir);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        hidePeel();
        animRef.current = null;
      }
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
      rendition.annotations.add(
        'highlight', ann.cfiRange, {}, () => {},
        `hl-${ann.color}`,
        { fill: color.fill, 'fill-opacity': '1' },
      );
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const book: Book = Epub(bookData.buffer as ArrayBuffer);
    bookRef.current = book;

    const rendition = book.renderTo(containerRef.current, {
      width:  '100%',
      height: '100%',
      flow:   'paginated',
      spread: 'none',
    });
    renditionRef.current = rendition;
    applyTheme(rendition);

    book.ready
      .then(async () => {
        const nav = await book.loaded.navigation;
        if (nav?.toc) onTocReady(navToToc(nav.toc));
        await rendition.display(savedCfi ?? undefined);

        // Apply saved highlights after first render
        if (savedAnnotations?.length) {
          applyAnnotations(rendition, savedAnnotations);
        }

        // Expose search function to parent
        onSearchReady?.(async (query: string) => {
          const results = await (book as Book & {
            search: (q: string) => Promise<Array<{ cfi: string; excerpt: string }>>;
          }).search(query);
          return results ?? [];
        });
      })
      .catch((err: Error) => {
        console.error('EpubReader: failed to open', err);
      });

    rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
      if (location?.start) {
        onProgress(location.start.cfi, (location.start.percentage ?? 0) * 100);
      }
    });

    // Text selection → show highlight toolbar
    rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
      if (!cfiRange.includes(',')) return; // not a range
      const quote = contents.window.getSelection()?.toString().trim() ?? '';
      if (quote.length === 0) return;
      onTextSelected?.(cfiRange, quote);
    });

    // Expose annotation add/remove methods to parent
    onAnnotationControls?.({
      add: (cfiRange: string, color: string) => {
        const c = HIGHLIGHT_COLORS[color] ?? HIGHLIGHT_COLORS.yellow;
        rendition.annotations.add(
          'highlight', cfiRange, {}, () => {},
          `hl-${color}`,
          { fill: c.fill, 'fill-opacity': '1' },
        );
      },
      remove: (cfiRange: string) => {
        rendition.annotations.remove('highlight', cfiRange);
      },
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
      bookRef.current = null;
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
      {/* Peel overlay: starts hidden, covers page on navigation, clips away horizontally */}
      <div
        ref={peelRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          display:    'none',
          willChange: 'clip-path',
          zIndex:     5,
          background: PEEL_SURFACE[settings.theme],
        }}
      />
    </div>
  );
}
