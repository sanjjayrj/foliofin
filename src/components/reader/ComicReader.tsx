import { useEffect, useState, useCallback } from 'react';
import JSZip from 'jszip';
import Spinner from '../ui/Spinner';
import type { BookFormat } from '../../types/jellyfin';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);

function isImage(name: string) {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

interface ComicReaderProps {
  bookData: string | Uint8Array;
  format: BookFormat;
  savedPage?: number;
  onProgress: (page: number, percentage: number) => void;
  onTotalPages: (total: number) => void;
  onPrevPage: (handler: () => void) => void;
  onNextPage: (handler: () => void) => void;
}

export default function ComicReader({
  bookData,
  format,
  savedPage,
  onProgress,
  onTotalPages,
  onPrevPage,
  onNextPage,
}: ComicReaderProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(savedPage ?? 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        const buf = bookData instanceof Uint8Array
          ? bookData.buffer
          : await fetch(bookData).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); });

        if (format === 'cbz') {
          const zip = await JSZip.loadAsync(buf);
          const imageFiles = Object.keys(zip.files)
            .filter((name) => !zip.files[name].dir && isImage(name))
            .sort();

          const urls: string[] = [];
          for (const name of imageFiles) {
            const data = await zip.files[name].async('blob');
            urls.push(URL.createObjectURL(data));
          }
          setPages(urls);
          onTotalPages(urls.length);
        } else if (format === 'cbr') {
          // CBR is RAR format — try to load via libarchive.js WASM
          try {
            const { Archive } = await import('libarchive.js/src/libarchive.js');
            Archive.init({ workerUrl: new URL('libarchive.js/dist/worker-bundle.js', import.meta.url).toString() });
            const archive = await Archive.open(new File([buf], 'comic.cbr'));
            const extracted = await archive.extractFiles();

            const imageFiles = Object.keys(extracted)
              .filter(isImage)
              .sort();

            const urls: string[] = [];
            for (const name of imageFiles) {
              const blob = new Blob([extracted[name]], { type: 'image/jpeg' });
              urls.push(URL.createObjectURL(blob));
            }
            setPages(urls);
            onTotalPages(urls.length);
          } catch {
            throw new Error('CBR extraction failed. Try converting to CBZ for better compatibility.');
          }
        }

        const start = savedPage ?? 0;
        setCurrentPage(start);
        setLoading(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to open comic');
        setLoading(false);
      }
    };

    load();

    return () => {
      // Revoke object URLs on unmount
      setPages((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
    };
  }, [bookData, format]); // eslint-disable-line react-hooks/exhaustive-deps

  const prev = useCallback(() => {
    setCurrentPage((p) => {
      const next = Math.max(0, p - 1);
      if (pages.length) onProgress(next, (next / pages.length) * 100);
      return next;
    });
  }, [pages.length, onProgress]);

  const next = useCallback(() => {
    setCurrentPage((p) => {
      const n = Math.min(pages.length - 1, p + 1);
      if (pages.length) onProgress(n, (n / pages.length) * 100);
      return n;
    });
  }, [pages.length, onProgress]);

  useEffect(() => {
    onPrevPage(prev);
    onNextPage(next);
  }, [prev, next, onPrevPage, onNextPage]);

  useEffect(() => {
    if (pages.length === 0) return;
    onProgress(currentPage, (currentPage / pages.length) * 100);
  }, [currentPage, pages.length, onProgress]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  if (loading) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <Spinner size="lg" label={`Extracting ${format.toUpperCase()}…`} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>
      </div>
    );
  }

  const pageUrl = pages[currentPage];

  return (
    <div
      className="absolute inset-0 flex items-center justify-center reader-content"
      style={{ background: '#0a0a0a' }}
      onClick={next}
    >
      {pageUrl && (
        <img
          key={pageUrl}
          src={pageUrl}
          alt={`Page ${currentPage + 1}`}
          className="comic-page"
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
          draggable={false}
        />
      )}
    </div>
  );
}
