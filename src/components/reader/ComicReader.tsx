import { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import JSZip from 'jszip';
import { ArrowLeft } from 'lucide-react';
import type { BookFormat } from '../../types/jellyfin';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);
function isImage(name: string): boolean {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

/* ── Page flip animation ─────────────────────────────────────────── */
const variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.88,
    rotateY: dir >= 0 ? 22 : -22,
  }),
  center: { x: 0, opacity: 1, scale: 1, rotateY: 0 },
  exit: (dir: number) => ({
    x: dir >= 0 ? '-30%' : '30%',
    opacity: 0,
    scale: 0.78,
    rotateY: dir >= 0 ? -16 : 16,
  }),
};

const spring = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 24,
  opacity: { duration: 0.25 },
};

/* ── Props ──────────────────────────────────────────────────────── */
interface ComicReaderProps {
  bookData: Uint8Array;
  format: BookFormat;
  localPath?: string;
  savedPage?: number;
  onBack: () => void;
  onProgress:   (page: number, percentage: number) => void;
  onTotalPages: (total: number) => void;
  onPrevPage:   (handler: () => void) => void;
  onNextPage:   (handler: () => void) => void;
}

export default function ComicReader({
  bookData, format, localPath, savedPage, onBack,
  onProgress, onTotalPages, onPrevPage, onNextPage,
}: ComicReaderProps) {
  const [pages,       setPages]       = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(savedPage ?? 0);
  const [direction,   setDirection]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const blobsRef = useRef<string[]>([]);

  // Stable refs for all parent callbacks — avoids any effect re-running on parent re-renders
  const onProgressRef   = useRef(onProgress);
  const onTotalPagesRef = useRef(onTotalPages);
  const onPrevPageRef   = useRef(onPrevPage);
  const onNextPageRef   = useRef(onNextPage);
  onProgressRef.current   = onProgress;
  onTotalPagesRef.current = onTotalPages;
  onPrevPageRef.current   = onPrevPage;
  onNextPageRef.current   = onNextPage;

  // Stable ref for pages array so nav callbacks don't need pages in their dep arrays
  const pagesRef = useRef<string[]>(pages);
  pagesRef.current = pages;

  /* ── Load pages ───────────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setError('');
    setPages([]);
    pagesRef.current = [];
    let cancelled = false;

    const load = async () => {
      try {
        let urls: string[] = [];

        if (format === 'cbz') {
          const zip = await JSZip.loadAsync(bookData.buffer as ArrayBuffer);
          const names = Object.keys(zip.files)
            .filter(n => !zip.files[n].dir && isImage(n))
            .sort();

          for (const name of names) {
            if (cancelled) return;
            const blob = await zip.files[name].async('blob');
            const url  = URL.createObjectURL(blob);
            blobsRef.current.push(url);
            urls.push(url);
          }

        } else if (format === 'cbr') {
          if (!localPath) {
            setError(
              'CBR comics must be downloaded before reading.\n' +
              'Go back and tap "Download" on the book detail page.',
            );
            setLoading(false);
            return;
          }

          const invokePromise = invoke<string[]>('extract_cbr_pages', { relativePath: localPath });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(
              'CBR extraction timed out (60s).\n\n' +
              'Install 7zip for fast RAR support:\n' +
              'sudo apt install p7zip-full'
            )), 60_000)
          );
          const relPaths = await Promise.race([invokePromise, timeoutPromise]);

          if (relPaths.length === 0) {
            setError('No images found in this CBR archive.');
            setLoading(false);
            return;
          }

          for (const relPath of relPaths) {
            if (cancelled) return;
            const bytes = await readFile(relPath, { baseDir: BaseDirectory.AppData });
            const ext   = relPath.split('.').pop()?.toLowerCase() ?? 'jpg';
            const mime  = ext === 'png' ? 'image/png'
                        : ext === 'gif' ? 'image/gif'
                        : 'image/jpeg';
            const blob = new Blob([bytes], { type: mime });
            const url  = URL.createObjectURL(blob);
            blobsRef.current.push(url);
            urls.push(url);
          }
        }

        if (cancelled) return;
        setPages(urls);
        onTotalPagesRef.current(urls.length);
        setCurrentPage(Math.min(savedPage ?? 0, Math.max(0, urls.length - 1)));
        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to open comic');
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      blobsRef.current.forEach(u => URL.revokeObjectURL(u));
      blobsRef.current = [];
    };
  // format + localPath identify the source. bookData.length distinguishes CBZ archives by size.
  // CBR ignores bookData (always 0). savedPage intentionally excluded — first-mount only.
  }, [format, localPath, bookData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Navigation ───────────────────────────────────────────────── */
  const prev = useCallback(() => {
    setDirection(-1);
    setCurrentPage(p => {
      const n = Math.max(0, p - 1);
      const total = pagesRef.current.length;
      if (total) onProgressRef.current(n, (n / total) * 100);
      return n;
    });
  }, []); // stable — reads via refs

  const next = useCallback(() => {
    setDirection(1);
    setCurrentPage(p => {
      const total = pagesRef.current.length;
      const n = Math.min(total - 1, p + 1);
      if (total) onProgressRef.current(n, (n / total) * 100);
      return n;
    });
  }, []); // stable — reads via refs

  // Register nav handlers with parent once (stable because prev/next never change)
  useEffect(() => {
    onPrevPageRef.current(prev);
    onNextPageRef.current(next);
  }, [prev, next]);

  // Report progress when page index changes — NOT when onProgress reference changes
  useEffect(() => {
    if (pages.length === 0) return;
    onProgressRef.current(currentPage, (currentPage / pages.length) * 100);
  }, [currentPage, pages.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  /* ── Error state ─────────────────────────────────────────────── */
  if (error) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-10 text-center z-10"
        style={{ background: 'var(--color-bg)' }}
      >
        <p
          className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: 'var(--color-red)', maxWidth: 380 }}
        >
          {error}
        </p>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium"
          style={{
            color: 'var(--color-accent)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={15} /> Back to Library
        </button>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden reader-content"
      style={{ background: '#0a0a0a', perspective: '1200px' }}
    >
      {loading && <div className="loading-bar-indeterminate z-20" />}

      <AnimatePresence initial={false} custom={direction} mode="sync">
        {!loading && pages[currentPage] && (
          <motion.img
            key={currentPage}
            src={pages[currentPage]}
            alt={`Page ${currentPage + 1}`}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              margin: 'auto',
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              willChange: 'transform',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
