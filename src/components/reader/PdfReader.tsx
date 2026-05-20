import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ReaderSettings } from '../../types/jellyfin';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfReaderProps {
  bookData: Uint8Array;
  settings: ReaderSettings;
  savedPage?: number;
  onProgress:   (page: number, percentage: number) => void;
  onTotalPages: (total: number) => void;
  onPrevPage: (handler: () => void) => void;
  onNextPage: (handler: () => void) => void;
}

const SCALE = 1.5;

const BG: Record<string, string> = {
  dark:  '#0a0a0f',
  light: '#fafaf5',
  sepia: '#f4e8c1',
};

export default function PdfReader({
  bookData, settings, savedPage,
  onProgress, onTotalPages, onPrevPage, onNextPage,
}: PdfReaderProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const docRef      = useRef<PDFDocumentProxy | null>(null);
  const renderingRef = useRef(false);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(savedPage ?? 1);
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [error, setError] = useState('');

  const renderPage = useCallback(async (pageNum: number, fade = false) => {
    const doc    = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || renderingRef.current) return;

    renderingRef.current = true;
    if (fade) setCanvasOpacity(0);

    try {
      const page     = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: SCALE });
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (settings.theme === 'dark') {
        ctx.fillStyle = BG.dark;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      onProgress(pageNum, (pageNum / doc.numPages) * 100);
      if (fade) setCanvasOpacity(1);
    } finally {
      renderingRef.current = false;
    }
  }, [settings.theme, onProgress]);

  /* ── Load document ────────────────────────────────────────────── */
  useEffect(() => {
    setError('');

    const load = async () => {
      try {
        const doc = await pdfjs.getDocument({ data: bookData }).promise;
        docRef.current = doc;
        setTotalPages(doc.numPages);
        onTotalPages(doc.numPages);
        const start = savedPage ?? 1;
        setCurrentPage(start);
        await renderPage(start);
      } catch (err: unknown) {
        setError(`Failed to open PDF: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    load();
    return () => { docRef.current?.destroy(); };
  }, [bookData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Re-render on page / theme change ─────────────────────────── */
  useEffect(() => {
    if (docRef.current) renderPage(currentPage, true);
  }, [currentPage, renderPage]);

  /* ── Navigation ───────────────────────────────────────────────── */
  const prev = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), []);
  const next = useCallback(() => setCurrentPage(p => Math.min(totalPages || p, p + 1)), [totalPages]);

  useEffect(() => { onPrevPage(prev); onNextPage(next); }, [prev, next, onPrevPage, onNextPage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  return (
    <div
      className="relative w-full h-full overflow-auto flex items-center justify-center reader-content"
      style={{ background: BG[settings.theme] }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-8">
          <p className="text-sm text-center" style={{ color: 'var(--color-red)' }}>{error}</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-w-full shadow-2xl"
        style={{
          filter:     settings.theme === 'dark'  ? 'invert(1) hue-rotate(180deg)'
                    : settings.theme === 'sepia' ? 'sepia(0.4)'
                    : 'none',
          opacity:    canvasOpacity,
          transition: 'opacity 0.18s ease',
        }}
      />
    </div>
  );
}
