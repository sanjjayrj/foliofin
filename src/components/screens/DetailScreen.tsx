import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, BookOpen, User, Calendar, Tag,
  Play, Download, Star, RotateCcw, Check,
  FileText, Layers, FileType, Trash2, HardDrive,
  BookMarked, Globe, Loader,
} from 'lucide-react';
import { useAppStore } from '../../store';
import {
  getCoverUrl, detectFormat, getBookDetail,
  toggleFavorite, getDownloadUrl,
} from '../../services/jellyfin';
import { downloadBook, deleteBook, formatBytes, readBook } from '../../services/storage';
import { fetchWebMetadata, type WebBookMetadata } from '../../services/metadata';
import type { JellyfinItem, BookFormat } from '../../types/jellyfin';

interface DetailScreenProps {
  book: JellyfinItem;
  onBack: () => void;
  onRead: () => void;
}

const FORMAT_INFO: Record<BookFormat, { label: string; icon: React.ReactNode; desc: string }> = {
  epub: { label: 'EPUB', icon: <BookOpen size={13} />, desc: 'Reflowable ebook' },
  pdf:  { label: 'PDF',  icon: <FileType size={13} />, desc: 'Fixed-layout document' },
  cbz:  { label: 'CBZ',  icon: <Layers size={13} />,  desc: 'Comic book archive (ZIP)' },
  cbr:  { label: 'CBR',  icon: <Layers size={13} />,  desc: 'Comic book archive (RAR)' },
  mobi: { label: 'MOBI', icon: <FileText size={13} />, desc: 'Kindle format — not supported' },
  unknown: { label: '?', icon: <FileText size={13} />, desc: 'Unknown format' },
};

const SUPPORTED: BookFormat[] = ['epub', 'pdf', 'cbz', 'cbr'];

async function fetchAsBytes(
  url: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get('content-length') ?? '0', 10);
  const rdr = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await rdr.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress(total > 0 ? (loaded / total) * 100 : 0);
    }
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export default function DetailScreen({ book, onBack, onRead }: DetailScreenProps) {
  const config      = useAppStore(s => s.config)!;
  const progress    = useAppStore(s => s.progress[book.Id]);
  const downloads   = useAppStore(s => s.downloads);
  const addDownload     = useAppStore(s => s.addDownload);
  const removeDownload  = useAppStore(s => s.removeDownload);
  const setPreloadedBook = useAppStore(s => s.setPreloadedBook);

  const [detail,   setDetail]   = useState<JellyfinItem>(book);
  const [imgError, setImgError] = useState(false);
  const [isFav,    setIsFav]    = useState(book.UserData?.IsFavorite ?? false);
  const [favLoading,  setFavLoading]  = useState(false);
  const [dlProgress,  setDlProgress]  = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dlError,     setDlError]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [webMeta,   setWebMeta]   = useState<WebBookMetadata | null>(null);

  /* ── Preload state ────────────────────────────────────────────── */
  const [preloadReady,    setPreloadReady]    = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadError,    setPreloadError]    = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const format    = detectFormat(detail);
  const fmt       = FORMAT_INFO[format];
  const supported = SUPPORTED.includes(format);
  const hasCover  = !!detail.ImageTags?.Primary && !imgError;
  const coverUrl  = hasCover ? getCoverUrl(config, detail.Id, 600) : null;
  const author    = detail.People?.find(p => p.Type === 'Author')?.Name;
  const pct       = progress?.percentage ?? 0;
  const inProgress = pct > 0 && pct < 98;
  const isRead    = detail.UserData?.Played ?? false;
  const cached    = downloads[book.Id];

  /* ── Load full detail ─────────────────────────────────────────── */
  useEffect(() => {
    getBookDetail(config, book.Id)
      .then(d => setDetail(d))
      .catch(() => {});
  }, [book.Id, config]);

  /* ── Fetch web metadata in background ─────────────────────────── */
  useEffect(() => {
    const title  = book.Name;
    const authorName = book.People?.find(p => p.Type === 'Author')?.Name;
    fetchWebMetadata(title, authorName)
      .then(m => setWebMeta(m))
      .catch(() => {});
  }, [book.Id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pre-read book bytes so reader opens instantly ─────────────── */
  useEffect(() => {
    if (!supported) return;

    // CBR is extracted via Rust (localPath) — no byte preload needed
    if (format === 'cbr') {
      setPreloadReady(true);
      return;
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setPreloadReady(false);
    setPreloadProgress(0);
    setPreloadError('');
    setPreloadedBook(null);

    const entry = cached;

    if (entry) {
      readBook(entry.localPath)
        .then(data => {
          if (abort.signal.aborted) return;
          setPreloadedBook({ id: book.Id, data });
          setPreloadReady(true);
          setPreloadProgress(100);
        })
        .catch(() => {
          if (abort.signal.aborted) return;
          fetchAsBytes(getDownloadUrl(config, book.Id), setPreloadProgress, abort.signal)
            .then(data => {
              if (abort.signal.aborted) return;
              setPreloadedBook({ id: book.Id, data });
              setPreloadReady(true);
            })
            .catch(err => {
              if (abort.signal.aborted) return;
              setPreloadError(err instanceof Error ? err.message : 'Failed to load book');
              setPreloadReady(true);
            });
        });
    } else {
      // Streaming: fetch full bytes (epub.js / pdfjs can't stream from a Jellyfin URL)
      fetchAsBytes(getDownloadUrl(config, book.Id), setPreloadProgress, abort.signal)
        .then(data => {
          if (abort.signal.aborted) return;
          setPreloadedBook({ id: book.Id, data });
          setPreloadReady(true);
        })
        .catch(err => {
          if (abort.signal.aborted) return;
          setPreloadError(err instanceof Error ? err.message : 'Failed to load book');
          setPreloadReady(true);
        });
    }

    return () => {
      abort.abort();
      setPreloadedBook(null);
    };
  }, [book.Id, format, cached?.localPath]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ─────────────────────────────────────────────────── */
  const handleFavorite = async () => {
    setFavLoading(true);
    const next = !isFav;
    setIsFav(next);
    try { await toggleFavorite(config, detail.Id, next); }
    catch { setIsFav(!next); }
    finally { setFavLoading(false); }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDlError('');
    setDlProgress(0);
    try {
      const url = getDownloadUrl(config, book.Id);
      const { localPath, fileSize } = await downloadBook(
        url, book.Id, format,
        (_, __, pctVal) => setDlProgress(Math.round(pctVal)),
      );
      addDownload({ itemId: book.Id, localPath, format, fileSize, downloadedAt: Date.now(), bookName: book.Name });
      setDlProgress(100);
    } catch (err: unknown) {
      setDlError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteBook(book.Id, format);
      removeDownload(book.Id);
      setPreloadedBook(null);
    } catch (err: unknown) {
      setDlError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setConfirmDelete(false);
    }
  };

  /* ── Merge descriptions ───────────────────────────────────────── */
  const synopsis   = detail.Overview || webMeta?.description;
  const publisher  = webMeta?.publisher;
  const pageCount  = webMeta?.pageCount;
  const webRating  = webMeta?.rating;
  const webSubjects = webMeta?.subjects?.filter(
    s => !detail.Genres?.includes(s)
  ).slice(0, 5);

  const isLoading = supported && format !== 'cbr' && !preloadReady;
  const openLabel = isLoading
    ? (preloadProgress > 0 ? `Loading ${Math.round(preloadProgress)}%` : 'Loading…')
    : (inProgress ? 'Continue Reading' : isRead ? 'Read Again' : 'Open Reader');
  const openIcon  = isLoading
    ? <Loader size={18} className="animate-spin" />
    : (inProgress ? <RotateCcw size={18} /> : <Play size={18} />);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg)' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-3 px-8 py-5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2"
          style={{
            color: 'var(--color-muted)', background: 'transparent',
            border: '1px solid var(--color-border)', borderRadius: '5px', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}
        >
          <ArrowLeft size={15} /> Library
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-12 p-10 max-w-5xl">

          {/* ── Cover column ── */}
          <div className="flex-shrink-0 flex flex-col gap-4" style={{ width: 230, minWidth: 180 }}>
            <div
              className="overflow-hidden"
              style={{
                width: 230, aspectRatio: '2/3',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
              }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={detail.Name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                  draggable={false}
                />
              ) : webMeta?.openLibraryCoverUrl ? (
                <img
                  src={webMeta.openLibraryCoverUrl}
                  alt={detail.Name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <BookOpen size={44} style={{ color: 'var(--color-faint)' }} />
                  <span className="text-xs text-center px-4" style={{ color: 'var(--color-muted)' }}>No cover</span>
                </div>
              )}
            </div>

            {/* Favorite */}
            <button
              onClick={handleFavorite}
              disabled={favLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
              style={{
                background: 'var(--color-card)', border: '1px solid var(--color-border)',
                borderRadius: '6px', color: isFav ? '#d4922a' : 'var(--color-muted)', cursor: 'pointer',
              }}
            >
              <Star size={14} fill={isFav ? '#d4922a' : 'none'} />
              {isFav ? 'Favourited' : 'Add to Favourites'}
            </button>

            {/* Disk usage if cached */}
            {cached && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: 'rgba(90,158,111,0.08)', border: '1px solid rgba(90,158,111,0.2)', borderRadius: '6px' }}
              >
                <HardDrive size={12} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                <span className="text-xs" style={{ color: 'var(--color-green)' }}>
                  On device · {formatBytes(cached.fileSize)}
                </span>
              </div>
            )}

            {/* Preload progress bar (streaming books only) */}
            {isLoading && (
              <div className="flex flex-col gap-1.5">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: preloadProgress > 0 ? `${preloadProgress}%` : '30%',
                      background: 'var(--color-accent)',
                      borderRadius: '2px',
                      animation: preloadProgress === 0 ? 'loading-bar-sweep 1.6s ease-out infinite' : undefined,
                    }}
                  />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--color-faint)' }}>
                  {preloadProgress > 0 ? `Buffering ${Math.round(preloadProgress)}%` : 'Buffering…'}
                </p>
              </div>
            )}
          </div>

          {/* ── Info column ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-7" style={{ minWidth: 280 }}>

            {/* Title / author / year */}
            <div className="flex flex-col gap-3">
              {detail.SeriesName && (
                <p className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {detail.SeriesName}{detail.IndexNumber ? ` · Vol. ${detail.IndexNumber}` : ''}
                </p>
              )}
              <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                {detail.Name}
              </h1>
              {author && (
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: 'var(--color-faint)' }} />
                  <span className="text-base" style={{ color: 'var(--color-muted)' }}>{author}</span>
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                {detail.ProductionYear && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} style={{ color: 'var(--color-faint)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{detail.ProductionYear}</span>
                  </div>
                )}
                {pageCount && (
                  <div className="flex items-center gap-1.5">
                    <BookMarked size={13} style={{ color: 'var(--color-faint)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{pageCount} pages</span>
                  </div>
                )}
                {publisher && (
                  <span className="text-sm" style={{ color: 'var(--color-faint)' }}>{publisher}</span>
                )}
              </div>
            </div>

            {/* Chips row */}
            <div className="flex flex-wrap gap-2">
              <Chip icon={fmt.icon} label={fmt.label} accent={supported} title={fmt.desc} />
              {detail.Genres?.map(g => <Chip key={g} icon={<Tag size={11} />} label={g} />)}
              {webSubjects?.map(s => <Chip key={s} icon={<Globe size={11} />} label={s} />)}
              {isRead && <Chip icon={<Check size={11} />} label="Read" green />}
              {webRating != null && (
                <Chip icon={<Star size={11} fill="currentColor" />} label={`${webRating} / 5`} accent />
              )}
            </div>

            {/* Reading progress */}
            {inProgress && (
              <div
                className="flex flex-col gap-2 p-4"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-muted)' }}>Reading progress</span>
                  <span style={{ color: 'var(--color-accent)' }}>{Math.round(pct)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full progress-fill" style={{ width: `${pct}%`, borderRadius: '3px' }} />
                </div>
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex flex-wrap gap-3">
              {supported ? (
                <ActionButton
                  onClick={onRead}
                  primary
                  icon={openIcon}
                  disabled={isLoading}
                >
                  {openLabel}
                </ActionButton>
              ) : (
                <div
                  className="flex items-center gap-2 px-6 py-3.5 text-sm"
                  style={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: '7px', color: 'var(--color-faint)',
                  }}
                >
                  Format not yet supported ({fmt.label})
                </div>
              )}

              {supported && !cached && !isDownloading && (
                <ActionButton
                  icon={<Download size={18} />}
                  onClick={handleDownload}
                  title="Save for offline reading"
                >
                  Download
                </ActionButton>
              )}

              {supported && cached && (
                <ActionButton
                  icon={<Trash2 size={18} />}
                  onClick={handleDelete}
                  danger
                >
                  {confirmDelete ? 'Tap again to confirm' : 'Delete from Device'}
                </ActionButton>
              )}
            </div>

            {/* Download progress bar */}
            {isDownloading && (
              <div className="flex flex-col gap-2">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${dlProgress}%`, background: 'var(--color-accent)', borderRadius: '3px' }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {dlProgress < 100 ? `Downloading… ${dlProgress}%` : 'Saving to device…'}
                </p>
              </div>
            )}

            {(dlError || preloadError) && (
              <p className="text-sm" style={{ color: 'var(--color-red)' }}>{dlError || preloadError}</p>
            )}

            {/* Unsupported format notice */}
            {!supported && (
              <div
                className="p-4 text-sm"
                style={{ background: 'rgba(201,95,95,0.08)', border: '1px solid rgba(201,95,95,0.2)', borderRadius: '7px', color: 'var(--color-red)' }}
              >
                <strong>{fmt.label}</strong> — {fmt.desc}.
              </div>
            )}

            {/* Synopsis / description */}
            {synopsis && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-faint)' }}>
                  About this Book
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)', maxWidth: 560 }}>
                  {synopsis}
                </p>
                {!detail.Overview && webMeta?.description && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Globe size={11} style={{ color: 'var(--color-faint)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-faint)' }}>Description via Open Library / Google Books</span>
                  </div>
                )}
              </div>
            )}

            {/* File path */}
            {detail.Path && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-faint)' }}>File</h3>
                <p className="text-xs font-mono break-all" style={{ color: 'var(--color-faint)' }}>{detail.Path}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Chip({ icon, label, accent, green, title }: {
  icon?: React.ReactNode; label: string;
  accent?: boolean; green?: boolean; title?: string;
}) {
  return (
    <span
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
      title={title}
      style={{
        background: accent ? 'var(--color-accent-bg)' : green ? 'rgba(90,158,111,0.12)' : 'var(--color-card)',
        border: `1px solid ${accent ? 'rgba(212,146,42,0.3)' : green ? 'rgba(90,158,111,0.25)' : 'var(--color-border)'}`,
        borderRadius: '5px',
        color: accent ? 'var(--color-accent-soft)' : green ? 'var(--color-green)' : 'var(--color-muted)',
      }}
    >
      {icon}{label}
    </span>
  );
}

function ActionButton({ children, onClick, icon, primary, danger, disabled, title }: {
  children: React.ReactNode; onClick: () => void;
  icon?: React.ReactNode; primary?: boolean; danger?: boolean;
  disabled?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center gap-2.5 px-7 py-4 text-base font-bold"
      style={{
        background: primary ? 'var(--color-accent)' : danger ? 'rgba(201,95,95,0.1)' : 'var(--color-card)',
        border: primary ? 'none' : danger ? '1px solid rgba(201,95,95,0.3)' : '1px solid var(--color-border)',
        borderRadius: '7px',
        color: primary ? '#111' : danger ? 'var(--color-red)' : 'var(--color-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        letterSpacing: '-0.01em',
      }}
    >
      {icon}{children}
    </button>
  );
}
