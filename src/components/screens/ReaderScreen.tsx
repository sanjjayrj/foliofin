import { useRef, useCallback } from 'react';
import { useAppStore } from '../../store';
import { getDownloadUrl, detectFormat, updateProgress } from '../../services/jellyfin';
import { BookOpen } from 'lucide-react';
import EpubReader from '../reader/EpubReader';
import PdfReader from '../reader/PdfReader';
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

  // Mutable refs for page-turn handlers (avoids re-mounting readers)
  const prevPageRef = useRef<() => void>(() => {});
  const nextPageRef = useRef<() => void>(() => {});
  const tocNavRef = useRef<(href: string) => void>(() => {});
  const tocRef = useRef<TocItem[]>([]);
  const progressRef = useRef({ percentage: 0, cfi: '', page: 1 });

  if (!config || !currentBook) {
    return (
      <div className="flex items-center justify-center h-full bg-[#08080f]">
        <div className="text-center">
          <BookOpen size={48} className="text-[#3a3a52] mx-auto mb-3" />
          <p className="text-[#9898b8]">No book selected</p>
        </div>
      </div>
    );
  }

  const format = detectFormat(currentBook);
  const bookUrl = getDownloadUrl(config, currentBook.Id);
  const author = currentBook.People?.find((p) => p.Type === 'Author')?.Name;
  const savedProgress = progress[currentBook.Id];

  const handleProgress = useCallback((cfiOrPage: string | number, percentage: number) => {
    const isString = typeof cfiOrPage === 'string';
    progressRef.current = {
      percentage,
      cfi: isString ? (cfiOrPage as string) : '',
      page: isString ? 1 : (cfiOrPage as number),
    };
    setProgress(currentBook.Id, {
      itemId: currentBook.Id,
      cfi: isString ? (cfiOrPage as string) : undefined,
      page: isString ? undefined : (cfiOrPage as number),
      percentage,
      updatedAt: Date.now(),
    });
    // Sync to Jellyfin (fire-and-forget)
    if (percentage > 0) {
      updateProgress(config, currentBook.Id, Math.round(percentage * 10_000_000)).catch(() => {});
    }
  }, [config, currentBook.Id, setProgress]);

  const handleTocReady = useCallback((toc: TocItem[]) => {
    tocRef.current = toc;
  }, []);

  const handlePrevPage = useCallback((handler: () => void) => {
    prevPageRef.current = handler;
  }, []);

  const handleNextPage = useCallback((handler: () => void) => {
    nextPageRef.current = handler;
  }, []);

  const handleTocNavigate = useCallback((handler: (href: string) => void) => {
    tocNavRef.current = handler;
  }, []);

  // Unsupported format fallback
  if (format !== 'epub' && format !== 'pdf') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#08080f] gap-4">
        <BookOpen size={48} className="text-[#3a3a52]" />
        <div className="text-center">
          <p className="text-[#f0f0ff] font-medium">Format not supported</p>
          <p className="text-[#9898b8] text-sm mt-1">
            {format === 'unknown' ? 'Unknown format' : `${format.toUpperCase()} files are not yet supported`}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-[#7c3aed] hover:text-[#a78bfa] transition-colors mt-2"
        >
          ← Back to library
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {format === 'epub' ? (
        <EpubReader
          bookUrl={bookUrl}
          settings={readerSettings}
          savedCfi={savedProgress?.cfi}
          onProgress={(cfi, pct) => handleProgress(cfi, pct)}
          onTocReady={handleTocReady}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onTocNavigate={handleTocNavigate}
        />
      ) : (
        <PdfReader
          bookUrl={bookUrl}
          settings={readerSettings}
          savedPage={savedProgress?.page}
          onProgress={(page, pct) => handleProgress(page, pct)}
          onTotalPages={() => {}}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      )}

      <ReaderControls
        title={currentBook.Name}
        author={author}
        progress={savedProgress?.percentage ?? 0}
        settings={readerSettings}
        toc={tocRef.current}
        onBack={onBack}
        onPrevPage={() => prevPageRef.current()}
        onNextPage={() => nextPageRef.current()}
        onSettingsChange={(s) => setReaderSettings(s)}
        onTocNavigate={(href) => tocNavRef.current(href)}
      />
    </div>
  );
}
