import { useRef, useCallback, useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { getDownloadUrl, detectFormat, updateProgress } from '../../services/jellyfin';
import { readBook } from '../../services/storage';
import { BookOpen } from 'lucide-react';
import EpubReader from '../reader/EpubReader';
import PdfReader from '../reader/PdfReader';
import ComicReader from '../reader/ComicReader';
import ReaderControls from '../reader/ReaderControls';

interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

interface ReaderScreenProps {
  onBack: () => void;
}

async function fetchAsBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export default function ReaderScreen({ onBack }: ReaderScreenProps) {
  const {
    config, currentBook, readerSettings, setReaderSettings,
    progress, setProgress, downloads, preloadedBook,
  } = useAppStore();

  const prevPageRef = useRef<() => void>(() => {});
  const nextPageRef = useRef<() => void>(() => {});
  const tocNavRef   = useRef<(href: string) => void>(() => {});
  const [toc,         setToc]         = useState<TocItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number | undefined>();
  const [totalPages,  setTotalPages]  = useState<number | undefined>();
  const [bookData,    setBookData]    = useState<Uint8Array | null>(null);
  const [loadError,   setLoadError]   = useState('');

  /* ── Resolve book bytes ─────────────────────────────────────────── */
  useEffect(() => {
    if (!config || !currentBook) return;
    setBookData(null);
    setLoadError('');

    // Prefer preloaded bytes (DetailScreen fetched these already — zero wait)
    if (preloadedBook?.id === currentBook.Id && preloadedBook.data instanceof Uint8Array) {
      setBookData(preloadedBook.data);
      return;
    }

    // Fallback: read from disk or fetch from server
    const entry = downloads[currentBook.Id];
    if (entry) {
      readBook(entry.localPath)
        .then(setBookData)
        .catch(() => {
          fetchAsBytes(getDownloadUrl(config, currentBook.Id))
            .then(setBookData)
            .catch(err => setLoadError(err instanceof Error ? err.message : 'Cannot load book'));
        });
    } else {
      fetchAsBytes(getDownloadUrl(config, currentBook.Id))
        .then(setBookData)
        .catch(err => setLoadError(err instanceof Error ? err.message : 'Cannot load book'));
    }
  }, [currentBook?.Id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!config || !currentBook) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: 'var(--color-bg)' }}>
        <BookOpen size={40} style={{ color: 'var(--color-faint)' }} />
        <p style={{ color: 'var(--color-muted)' }}>No book selected</p>
      </div>
    );
  }

  const format        = detectFormat(currentBook);
  const author        = currentBook.People?.find(p => p.Type === 'Author')?.Name;
  const savedProgress = progress[currentBook.Id];
  const downloadEntry = downloads[currentBook.Id];
  const isOffline     = !!downloadEntry;

  const handleProgress = useCallback((cfiOrPage: string | number, percentage: number) => {
    const isString = typeof cfiOrPage === 'string';
    if (!isString) setCurrentPage(cfiOrPage as number);
    setProgress(currentBook.Id, {
      itemId:     currentBook.Id,
      cfi:        isString ? (cfiOrPage as string) : undefined,
      page:       isString ? undefined : (cfiOrPage as number),
      percentage,
      updatedAt:  Date.now(),
    });
    if (percentage > 0) {
      updateProgress(config, currentBook.Id, Math.round(percentage * 10_000_000)).catch(() => {});
    }
  }, [config, currentBook.Id, setProgress]);

  const handlePrevPage = useCallback((h: () => void) => { prevPageRef.current = h; }, []);
  const handleNextPage = useCallback((h: () => void) => { nextPageRef.current = h; }, []);
  const handleTocNav   = useCallback((h: (href: string) => void) => { tocNavRef.current = h; }, []);

  if (format === 'unknown' || format === 'mobi') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: 'var(--color-bg)' }}>
        <BookOpen size={40} style={{ color: 'var(--color-faint)' }} />
        <div className="text-center">
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>Format not supported</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {format === 'mobi' ? 'MOBI is not supported — convert to EPUB' : 'Unknown file format'}
          </p>
          <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-faint)' }}>
            {currentBook.Path}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm px-5 py-2.5 mt-2"
          style={{
            color: 'var(--color-accent)',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            background: 'transparent',
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  /* Load error */
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: 'var(--color-bg)' }}>
        <BookOpen size={40} style={{ color: 'var(--color-faint)' }} />
        <p className="text-sm text-center px-8" style={{ color: 'var(--color-red)' }}>{loadError}</p>
        <button onClick={onBack} className="text-sm px-5 py-2.5" style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)', borderRadius: '5px', background: 'transparent' }}>
          ← Back
        </button>
      </div>
    );
  }

  /* CBR: no bytes needed — ComicReader uses localPath + Rust extraction */
  const showCbr = (format === 'cbr');

  /* Waiting for book bytes to resolve */
  if (!bookData && !showCbr) {
    return (
      <div className="w-full h-full relative" style={{ background: 'var(--color-bg)' }}>
        <div className="loading-bar-thin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {format === 'epub' && bookData && (
        <EpubReader
          bookData={bookData}
          settings={readerSettings}
          savedCfi={savedProgress?.cfi}
          onProgress={(cfi, pct) => handleProgress(cfi, pct)}
          onTocReady={setToc}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onTocNavigate={handleTocNav}
        />
      )}
      {format === 'pdf' && bookData && (
        <PdfReader
          bookData={bookData}
          settings={readerSettings}
          savedPage={savedProgress?.page}
          onProgress={(page, pct) => { setCurrentPage(page); handleProgress(page, pct); }}
          onTotalPages={t => setTotalPages(t)}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      )}
      {(format === 'cbz' || format === 'cbr') && (
        <ComicReader
          bookData={bookData ?? new Uint8Array(0)}
          format={format}
          localPath={downloadEntry?.localPath}
          savedPage={savedProgress?.page}
          onProgress={(page, pct) => { setCurrentPage(page); handleProgress(page, pct); }}
          onTotalPages={t => setTotalPages(t)}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      )}

      <ReaderControls
        title={currentBook.Name}
        author={author}
        currentPage={currentPage}
        totalPages={totalPages}
        progress={savedProgress?.percentage ?? 0}
        settings={readerSettings}
        toc={toc}
        isOffline={isOffline}
        onBack={onBack}
        onPrevPage={() => prevPageRef.current()}
        onNextPage={() => nextPageRef.current()}
        onSettingsChange={s => setReaderSettings(s)}
        onTocNavigate={href => tocNavRef.current(href)}
      />
    </div>
  );
}
