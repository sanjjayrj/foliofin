import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Spinner from '../ui/Spinner';
import type { ReaderSettings } from '../../types/jellyfin';

// Set worker from CDN bundled build
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfReaderProps {
  bookUrl: string;
  settings: ReaderSettings;
  savedPage?: number;
  onProgress: (page: number, percentage: number) => void;
  onTotalPages: (total: number) => void;
  onPrevPage: (handler: () => void) => void;
  onNextPage: (handler: () => void) => void;
}

const SCALE = 1.5;

const BG: Record<string, string> = {
  dark: '#0a0a0f',
  light: '#fafaf5',
  sepia: '#f4e8c1',
};

export default function PdfReader({
  bookUrl,
  settings,
  savedPage,
  onProgress,
  onTotalPages,
  onPrevPage,
  onNextPage,
}: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(savedPage ?? 1);
  const [totalPages, setTotalPages] = useState(0);

  const renderPage = useCallback(async (pageNum: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (settings.theme === 'dark') {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport, canvas: canvasRef.current! }).promise;
    onProgress(pageNum, (pageNum / doc.numPages) * 100);
  }, [settings.theme, onProgress]);

  useEffect(() => {
    setLoading(true);
    setError('');

    const loadDoc = async () => {
      try {
        const doc = await pdfjs.getDocument(bookUrl).promise;
        docRef.current = doc;
        setTotalPages(doc.numPages);
        onTotalPages(doc.numPages);
        const startPage = savedPage ?? 1;
        setCurrentPage(startPage);
        await renderPage(startPage);
        setLoading(false);
      } catch (err: unknown) {
        setError(`Failed to open PDF: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    loadDoc();
    return () => { docRef.current?.destroy(); };
  }, [bookUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (docRef.current) renderPage(currentPage);
  }, [currentPage, renderPage]);

  const prev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const next = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages || p, p + 1));
  }, [totalPages]);

  useEffect(() => {
    onPrevPage(prev);
    onNextPage(next);
  }, [prev, next, onPrevPage, onNextPage]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next]);

  return (
    <div
      className="relative w-full h-full overflow-auto flex items-center justify-center reader-content"
      style={{ background: BG[settings.theme] }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: BG[settings.theme] }}>
          <Spinner size="lg" label="Rendering PDF…" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-red-400 text-sm text-center px-4">{error}</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-w-full shadow-2xl"
        style={{
          filter: settings.theme === 'dark' ? 'invert(1) hue-rotate(180deg)' : settings.theme === 'sepia' ? 'sepia(0.4)' : 'none',
        }}
      />
    </div>
  );
}
