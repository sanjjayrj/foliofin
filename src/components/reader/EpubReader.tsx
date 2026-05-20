import { useEffect, useRef, useCallback } from 'react';
import Epub from 'epubjs';
import type { Book, Rendition } from 'epubjs';
import type { NavItem } from 'epubjs/types/navigation';
import type { ReaderSettings } from '../../types/jellyfin';

interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

interface EpubReaderProps {
  bookData: Uint8Array;
  settings: ReaderSettings;
  savedCfi?: string;
  onProgress:    (cfi: string, percentage: number) => void;
  onTocReady:    (toc: TocItem[]) => void;
  onPrevPage:    (handler: () => void) => void;
  onNextPage:    (handler: () => void) => void;
  onTocNavigate: (handler: (href: string) => void) => void;
}

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

// Slightly lifted-page color for the peel overlay surface
const PEEL_SURFACE: Record<string, string> = {
  dark:  '#1c1a22',
  light: '#ede8e2',
  sepia: '#e8d5a0',
};

const PEEL_DURATION = 680; // ms

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

// Returns clip-path polygon that starts at full-page coverage (t=0) and
// peels down to nothing (t=1) using a diagonal sweep from a corner.
//
// dir >= 0 (forward): peel from bottom-right corner toward top-left
//   Phase 1 (t 0→0.5): diagonal sweeps from BR; right-edge Y and
//   bottom-edge X both descend from 100% to 0%.
//   Phase 2 (t 0.5→1): remaining top-left triangle shrinks to a point.
//
// dir < 0 (backward): mirror — peel from bottom-left corner toward top-right.
function peelClipPath(t: number, dir: number): string {
  const t2 = Math.min(1, Math.max(0, t));
  if (dir >= 0) {
    if (t2 <= 0.5) {
      const p  = t2 * 2;
      const rY = ((1 - p) * 100).toFixed(2);
      const bX = ((1 - p) * 100).toFixed(2);
      return `polygon(0% 0%, 100% 0%, 100% ${rY}%, ${bX}% 100%, 0% 100%)`;
    } else {
      const p  = (t2 - 0.5) * 2;
      const tX = ((1 - p) * 100).toFixed(2);
      const lY = ((1 - p) * 100).toFixed(2);
      return `polygon(0% 0%, ${tX}% 0%, 0% ${lY}%, 0% 0%, 0% 0%)`;
    }
  } else {
    if (t2 <= 0.5) {
      const p  = t2 * 2;
      const lY = ((1 - p) * 100).toFixed(2);
      const bX = (p * 100).toFixed(2);
      return `polygon(0% 0%, 100% 0%, 100% 100%, ${bX}% 100%, 0% ${lY}%)`;
    } else {
      const p  = (t2 - 0.5) * 2;
      const tX = (p * 100).toFixed(2);
      const rY = ((1 - p) * 100).toFixed(2);
      return `polygon(${tX}% 0%, 100% 0%, 100% ${rY}%, ${tX}% 0%, ${tX}% 0%)`;
    }
  }
}

export default function EpubReader({
  bookData, settings, savedCfi,
  onProgress, onTocReady, onPrevPage, onNextPage, onTocNavigate,
}: EpubReaderProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const peelRef       = useRef<HTMLDivElement>(null);
  const renditionRef  = useRef<Rendition | null>(null);
  const animRef       = useRef<number | null>(null);
  // Keep latest settings accessible in RAF callbacks without re-running effects
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
  };

  // Trigger a page-peel animation:
  //  1. Call action() immediately (epub.js starts rendering new page behind overlay).
  //  2. Show overlay covering the full page (hides the not-yet-rendered new content).
  //  3. RAF loop clips the overlay with peelClipPath(t, dir), revealing new page below.
  const navigate = useCallback((action: () => void, dir: number) => {
    cancelAnim();
    action();

    const peel = peelRef.current;
    if (!peel) return;

    peel.style.background = PEEL_SURFACE[settingsRef.current.theme];
    peel.style.display    = 'block';
    peel.style.clipPath   = peelClipPath(0, dir);

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
  }, []); // stable — all mutable state via refs

  const applyTheme = useCallback((rendition: Rendition) => {
    const style = buildTheme(settingsRef.current);
    rendition.themes.register('foliofin', { body: style, p: { margin: '0 0 1.1em 0' } });
    rendition.themes.select('foliofin');
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const book: Book = Epub(bookData.buffer as ArrayBuffer);

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
      })
      .catch((err: Error) => {
        console.error('EpubReader: failed to open', err);
      });

    rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
      if (location?.start) {
        onProgress(location.start.cfi, (location.start.percentage ?? 0) * 100);
      }
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

  // Re-apply theme when settings change without remounting the book
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
      {/* Peel overlay: hidden at rest, shown during page-turn animation.
          clip-path is driven by RAF — willChange hints the GPU to composite it. */}
      <div
        ref={peelRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          display:    'none',
          willChange: 'clip-path',
          zIndex:     5,
          background: PEEL_SURFACE[settings.theme],
          boxShadow:  'inset -6px -6px 24px rgba(0,0,0,0.22)',
        }}
      />
    </div>
  );
}
