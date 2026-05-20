import { useEffect, useRef, useState, useCallback } from 'react';
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

export default function EpubReader({
  bookData, settings, savedCfi,
  onProgress, onTocReady, onPrevPage, onNextPage, onTocNavigate,
}: EpubReaderProps) {
  // bookData is always Uint8Array — epub.js can't reliably stream from a Jellyfin URL
  const containerRef  = useRef<HTMLDivElement>(null);
  const renditionRef  = useRef<Rendition | null>(null);
  const fadeTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error,       setError]       = useState('');
  // Page-turn fade: opacity drops to 0 on navigate, restores to 1 on 'relocated'
  const [pageOpacity, setPageOpacity] = useState(1);

  const applyTheme = useCallback((rendition: Rendition) => {
    const style = buildTheme(settings);
    rendition.themes.register('foliofin', { body: style, p: { margin: '0 0 1.1em 0' } });
    rendition.themes.select('foliofin');
  }, [settings]);

  /* navigate with a cross-fade: fade out → epub.js changes page → fade in */
  const navigate = useCallback((action: () => void) => {
    setPageOpacity(0);
    action();
    // Safety restore — fires if 'relocated' doesn't come back within 800ms
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setPageOpacity(1), 800);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    setError('');

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
      .catch((err: Error) => setError(`Failed to open EPUB: ${err.message}`));

    rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
      // New page is ready — fade back in
      setPageOpacity(1);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (location?.start) {
        onProgress(location.start.cfi, (location.start.percentage ?? 0) * 100);
      }
    });

    // Register prev/next with cross-fade wrapper
    onPrevPage(()  => navigate(() => renditionRef.current?.prev()));
    onNextPage(()  => navigate(() => renditionRef.current?.next()));
    onTocNavigate((href: string) => navigate(() => renditionRef.current?.display(href)));

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(() => renditionRef.current?.next());
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(() => renditionRef.current?.prev());
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      rendition.destroy();
      book.destroy();
      renditionRef.current = null;
    };
  }, [bookData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (renditionRef.current) applyTheme(renditionRef.current);
  }, [applyTheme]);

  return (
    <div
      className="relative w-full h-full epub-container reader-content"
      style={{ background: THEME_BG[settings.theme] }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>
        </div>
      )}
      {/* epub.js renders into this div.
          opacity transitions create the page-turn cross-fade:
          0 → fade out as epub.js loads the new page
          1 → fade in once 'relocated' fires (new content is ready) */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ opacity: pageOpacity, transition: 'opacity 0.22s ease' }}
      />
    </div>
  );
}
