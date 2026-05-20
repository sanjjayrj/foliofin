import { useRef, useCallback, useState } from 'react';
import { useAppStore } from '../../store';
import { getDownloadUrl, detectFormat, updateProgress } from '../../services/jellyfin';
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

export default function ReaderScreen({ onBack }: ReaderScreenProps) {
  const { config, currentBook, readerSettings, setReaderSettings, progress, setProgress } = useAppStore();

  const prevPageRef = useRef<() => void>(() => {});
  const nextPageRef = useRef<() => void>(() => {});
  const tocNavRef = useRef<(href: string) => void>(() => {});
  const [toc, setToc] = useState<TocItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number | undefined>();
  const [totalPages, setTotalPages] = useState<number | undefined>();

  if (!config || !currentBook) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: 'var(--color-bg)' }}>
        <BookOpen size={40} style={{ color: 'var(--color-faint)' }} />
        <p style={{ color: 'var(--color-muted)' }}>No book selected</p>
      </div>
    );
  }

  const format = detectFormat(currentBook);
  const bookUrl = getDownloadUrl(config, currentBook.Id);
  const author = currentBook.People?.find((p) => p.Type === 'Author')?.Name;
  const savedProgress = progress[currentBook.Id];

  const handleProgress = useCallback((cfiOrPage: string | number, percentage: number) => {
    const isString = typeof cfiOrPage === 'string';
    if (!isString) setCurrentPage(cfiOrPage as number);
    setProgress(currentBook.Id, {
      itemId: currentBook.Id,
      cfi: isString ? (cfiOrPage as string) : undefined,
      page: isString ? undefined : (cfiOrPage as number),
      percentage,
      updatedAt: Date.now(),
    });
    if (percentage > 0) {
      updateProgress(config, currentBook.Id, Math.round(percentage * 10_000_000)).catch(() => {});
    }
  }, [config, currentBook.Id, setProgress]);

  const handlePrevPage = useCallback((h: () => void) => { prevPageRef.current = h; }, []);
  const handleNextPage = useCallback((h: () => void) => { nextPageRef.current = h; }, []);
  const handleTocNav = useCallback((h: (href: string) => void) => { tocNavRef.current = h; }, []);

  if (format === 'unknown' || format === 'mobi') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: 'var(--color-bg)' }}>
        <BookOpen size={40} style={{ color: 'var(--color-faint)' }} />
        <div className="text-center">
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>Format not supported</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {format === 'mobi' ? 'MOBI files are not supported — try EPUB' : 'Could not determine file format'}
          </p>
          <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-faint)' }}>
            Path: {currentBook.Path}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm px-4 py-2 mt-2"
          style={{
            color: 'var(--color-accent)',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            background: 'transparent',
          }}
        >
          ← Back to library
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {format === 'epub' && (
        <EpubReader
          bookUrl={bookUrl}
          settings={readerSettings}
          savedCfi={savedProgress?.cfi}
          onProgress={(cfi, pct) => handleProgress(cfi, pct)}
          onTocReady={setToc}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onTocNavigate={handleTocNav}
        />
      )}
      {format === 'pdf' && (
        <PdfReader
          bookUrl={bookUrl}
          settings={readerSettings}
          savedPage={savedProgress?.page}
          onProgress={(page, pct) => { setCurrentPage(page); handleProgress(page, pct); }}
          onTotalPages={(t) => setTotalPages(t)}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      )}
      {(format === 'cbz' || format === 'cbr') && (
        <ComicReader
          bookUrl={bookUrl}
          format={format}
          savedPage={savedProgress?.page}
          onProgress={(page, pct) => { setCurrentPage(page); handleProgress(page, pct); }}
          onTotalPages={(t) => setTotalPages(t)}
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
        onBack={onBack}
        onPrevPage={() => prevPageRef.current()}
        onNextPage={() => nextPageRef.current()}
        onSettingsChange={(s) => setReaderSettings(s)}
        onTocNavigate={(href) => tocNavRef.current(href)}
      />
    </div>
  );
}
