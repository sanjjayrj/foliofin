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
  bookUrl: string;
  settings: ReaderSettings;
  savedCfi?: string;
  onProgress: (cfi: string, percentage: number) => void;
  onTocReady: (toc: TocItem[]) => void;
  onPrevPage: (handler: () => void) => void;
  onNextPage: (handler: () => void) => void;
  onTocNavigate: (handler: (href: string) => void) => void;
}

const THEME_STYLES: Record<string, Record<string, string>> = {
  dark: {
    background: '#0a0a0f',
    color: '#e8e8f0',
    'font-size': '%%FSize%%px',
    'line-height': '%%LH%%',
    'font-family': '%%FONT%%',
    'padding': '0 %%MARGINS%%px',
  },
  light: {
    background: '#fafaf5',
    color: '#1a1a1a',
    'font-size': '%%FSize%%px',
    'line-height': '%%LH%%',
    'font-family': '%%FONT%%',
    'padding': '0 %%MARGINS%%px',
  },
  sepia: {
    background: '#f4e8c1',
    color: '#3a2e1a',
    'font-size': '%%FSize%%px',
    'line-height': '%%LH%%',
    'font-family': '%%FONT%%',
    'padding': '0 %%MARGINS%%px',
  },
};

const FONT_FAMILY: Record<string, string> = {
  serif: '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif',
  sans: '"Inter","Segoe UI",system-ui,sans-serif',
  mono: '"JetBrains Mono","Cascadia Code",monospace',
};

function buildStyle(settings: ReaderSettings): Record<string, string> {
  const base = { ...THEME_STYLES[settings.theme] };
  for (const [k, v] of Object.entries(base)) {
    base[k] = v
      .replace('%%FSize%%', String(settings.fontSize))
      .replace('%%LH%%', String(settings.lineHeight))
      .replace('%%FONT%%', FONT_FAMILY[settings.font])
      .replace('%%MARGINS%%', String(settings.margins));
  }
  return base;
}

function navToToc(nav: NavItem[]): TocItem[] {
  return nav.map((n) => ({
    id: n.id ?? n.href,
    href: n.href,
    label: n.label.trim(),
    subitems: n.subitems?.length ? navToToc(n.subitems) : undefined,
  }));
}

export default function EpubReader({
  bookUrl,
  settings,
  savedCfi,
  onProgress,
  onTocReady,
  onPrevPage,
  onNextPage,
  onTocNavigate,
}: EpubReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyTheme = useCallback((rendition: Rendition) => {
    const style = buildStyle(settings);
    rendition.themes.register('foliofin', { body: style, p: { margin: '0 0 1em 0' } });
    rendition.themes.select('foliofin');
  }, [settings]);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    setError('');

    const book = Epub(bookUrl);
    bookRef.current = book;

    const rendition = book.renderTo(containerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'none',
    });
    renditionRef.current = rendition;

    applyTheme(rendition);

    book.ready.then(async () => {
      // Load TOC
      const nav = await book.loaded.navigation;
      if (nav?.toc) onTocReady(navToToc(nav.toc));

      // Display from saved position or start
      if (savedCfi) {
        await rendition.display(savedCfi);
      } else {
        await rendition.display();
      }
      setLoading(false);
    }).catch((err: Error) => {
      setError(`Failed to open book: ${err.message}`);
      setLoading(false);
    });

    rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
      if (location?.start) {
        onProgress(location.start.cfi, (location.start.percentage ?? 0) * 100);
      }
    });

    // Wire up page turn handlers
    onPrevPage(() => renditionRef.current?.prev());
    onNextPage(() => renditionRef.current?.next());
    onTocNavigate((href: string) => renditionRef.current?.display(href));

    // Keyboard navigation
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') renditionRef.current?.next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') renditionRef.current?.prev();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
      rendition.destroy();
      book.destroy();
      bookRef.current = null;
      renditionRef.current = null;
    };
  }, [bookUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply theme on settings change without reload
  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current);
    }
  }, [applyTheme]);

  const bgColor = {
    dark: '#0a0a0f',
    light: '#fafaf5',
    sepia: '#f4e8c1',
  }[settings.theme];

  return (
    <div className="relative w-full h-full epub-container reader-content" style={{ background: bgColor }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: bgColor }}>
          <Spinner size="lg" label="Opening book…" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
