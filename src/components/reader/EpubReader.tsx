import { useEffect, useRef, useState, useCallback } from 'react';
import Epub from 'epubjs';
import type { Book, Rendition } from 'epubjs';
import type { NavItem } from 'epubjs/types/navigation';
import Spinner from '../ui/Spinner';
import type { ReaderSettings } from '../../types/jellyfin';

interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

interface EpubReaderProps {
  /** Either a URL string (streaming) or a Uint8Array (local cached file) */
  bookData: string | Uint8Array;
  settings: ReaderSettings;
  savedCfi?: string;
  onProgress: (cfi: string, percentage: number) => void;
  onTocReady: (toc: TocItem[]) => void;
  onPrevPage: (handler: () => void) => void;
  onNextPage: (handler: () => void) => void;
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

function buildTheme(settings: ReaderSettings): Record<string, string> {
  return {
    background:   THEME_BG[settings.theme],
    color:        THEME_FG[settings.theme],
    'font-size':  `${settings.fontSize}px`,
    'line-height': String(settings.lineHeight),
    'font-family': FONT_FAMILY[settings.font],
    'padding':     `0 ${settings.margins}px`,
  };
}

function navToToc(nav: NavItem[]): TocItem[] {
  return nav.map((n) => ({
    id:       n.id ?? n.href,
    href:     n.href,
    label:    n.label.trim(),
    subitems: n.subitems?.length ? navToToc(n.subitems) : undefined,
  }));
}

export default function EpubReader({
  bookData,
  settings,
  savedCfi,
  onProgress,
  onTocReady,
  onPrevPage,
  onNextPage,
  onTocNavigate,
}: EpubReaderProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const renditionRef  = useRef<Rendition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const applyTheme = useCallback((rendition: Rendition) => {
    const style = buildTheme(settings);
    rendition.themes.register('foliofin', { body: style, p: { margin: '0 0 1em 0' } });
    rendition.themes.select('foliofin');
  }, [settings]);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    setError('');

    // Accept either URL string or ArrayBuffer (from local file)
    const input = bookData instanceof Uint8Array
      ? bookData.buffer
      : bookData;

    const book: Book = Epub(input as string);

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
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(`Failed to open EPUB: ${err.message}`);
        setLoading(false);
      });

    rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
      if (location?.start) {
        onProgress(location.start.cfi, (location.start.percentage ?? 0) * 100);
      }
    });

    onPrevPage(() => renditionRef.current?.prev());
    onNextPage(() => renditionRef.current?.next());
    onTocNavigate((href: string) => renditionRef.current?.display(href));

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') renditionRef.current?.next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   renditionRef.current?.prev();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
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
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: THEME_BG[settings.theme] }}
        >
          <Spinner size="lg" label="Opening book…" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
