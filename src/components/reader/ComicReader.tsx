import { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import JSZip from 'jszip';
import type { BookFormat } from '../../types/jellyfin';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);
function isImage(name: string): boolean {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

/* ── Page flip variants ─────────────────────────────────────────── */
const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.96,
    rotateY: dir > 0 ? 10 : -10,
  }),
  center: { x: 0, opacity: 1, scale: 1, rotateY: 0 },
  exit: (dir: number) => ({
    x: dir > 0 ? '-5%' : '5%',
    opacity: 0,
    scale: 0.92,
    rotateY: dir > 0 ? -7 : 7,
  }),
};

const transition = {
  x:       { type: 'spring' as const, stiffness: 380, damping: 38 },
  opacity: { duration: 0.18 },
  scale:   { duration: 0.22 },
  rotateY: { duration: 0.22 },
};

/* ── Props ──────────────────────────────────────────────────────── */
interface ComicReaderProps {
  /** Raw bytes (local cache) or streaming URL */
  bookData: string | Uint8Array;
  format: BookFormat;
  /** Relative AppData path — required for CBR Rust extraction */
  localPath?: string;
  savedPage?: number;
  onProgress:  (page: number, percentage: number) => void;
  onTotalPages: (total: number) => void;
  onPrevPage: (handler: () => void) => void;
  onNextPage: (handler: () => void) => void;
}

export default function ComicReader({
  bookData, format, localPath, savedPage,
  onProgress, onTotalPages, onPrevPage, onNextPage,
}: ComicReaderProps) {
  const [pages,       setPages]       = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(savedPage ?? 0);
  const [direction,   setDirection]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const blobsRef = useRef<string[]>([]);

  /* ── Load ─────────────────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        let urls: string[] = [];

        if (format === 'cbz') {
          const buf = bookData instanceof Uint8Array
            ? bookData.buffer
            : await fetch(bookData).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.arrayBuffer();
              });

          const zip = await JSZip.loadAsync(buf);
          const names = Object.keys(zip.files)
            .filter(n => !zip.files[n].dir && isImage(n))
            .sort();

          for (const name of names) {
            const blob = await zip.files[name].async('blob');
            const url  = URL.createObjectURL(blob);
            blobsRef.current.push(url);
            urls.push(url);
          }

        } else if (format === 'cbr') {
          if (!localPath) {
            setError('CBR comics must be downloaded first. Tap Download on the book detail page.');
            setLoading(false);
            return;
          }
          // Rust command — requires libarchive-dev: sudo apt install libarchive-dev
          const pages = await invoke<[string, string][]>('extract_cbr_pages', {
            relativePath: localPath,
          });
          urls = pages.map(([, dataUrl]) => dataUrl);
        }

        setPages(urls);
        onTotalPages(urls.length);
        setCurrentPage(Math.min(savedPage ?? 0, Math.max(0, urls.length - 1)));
        setLoading(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to open comic');
        setLoading(false);
      }
    };

    load();

    return () => {
      blobsRef.current.forEach(u => URL.revokeObjectURL(u));
      blobsRef.current = [];
    };
  }, [bookData, format, localPath]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Navigation ───────────────────────────────────────────────── */
  const prev = useCallback(() => {
    setDirection(-1);
    setCurrentPage(p => {
      const n = Math.max(0, p - 1);
      if (pages.length) onProgress(n, (n / pages.length) * 100);
      return n;
    });
  }, [pages.length, onProgress]);

  const next = useCallback(() => {
    setDirection(1);
    setCurrentPage(p => {
      const n = Math.min(pages.length - 1, p + 1);
      if (pages.length) onProgress(n, (n / pages.length) * 100);
      return n;
    });
  }, [pages.length, onProgress]);

  useEffect(() => { onPrevPage(prev); onNextPage(next); }, [prev, next, onPrevPage, onNextPage]);

  useEffect(() => {
    if (pages.length === 0) return;
    onProgress(currentPage, (currentPage / pages.length) * 100);
  }, [currentPage, pages.length, onProgress]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  /* ── Render ───────────────────────────────────────────────────── */
  if (error) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-10 text-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-red)', maxWidth: 400 }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden reader-content"
      style={{ background: '#0a0a0a', perspective: '1200px' }}
      onClick={next}
    >
      {/* Thin loading bar — non-blocking, fades out when done */}
      {loading && (
        <motion.div
          className="absolute top-0 left-0 right-0 z-20"
          style={{ height: 2, background: 'var(--color-accent)', transformOrigin: 'left' }}
          animate={{ scaleX: [0, 0.6, 0.8, 0.95] }}
          transition={{ duration: 2, ease: 'easeOut' }}
        />
      )}

      {/* Pages with flip animation */}
      <AnimatePresence custom={direction} mode="popLayout">
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
            transition={transition}
            draggable={false}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              position: 'absolute',
              willChange: 'transform',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
