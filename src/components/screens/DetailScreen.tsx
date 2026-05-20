import { useState, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, User, Calendar, Tag,
  Play, Download, Star, RotateCcw, Check,
  FileText, Layers, FileType, Trash2, HardDrive,
} from 'lucide-react';
import { useAppStore } from '../../store';
import {
  getCoverUrl, detectFormat, getBookDetail,
  toggleFavorite, getDownloadUrl,
} from '../../services/jellyfin';
import { downloadBook, deleteBook, formatBytes } from '../../services/storage';
import type { JellyfinItem, BookFormat } from '../../types/jellyfin';

interface DetailScreenProps {
  book: JellyfinItem;
  onBack: () => void;
  onRead: () => void;
}

const FORMAT_INFO: Record<BookFormat, { label: string; icon: React.ReactNode; desc: string }> = {
  epub: { label: 'EPUB', icon: <BookOpen size={13} />, desc: 'Reflowable ebook — text resizes to fit' },
  pdf:  { label: 'PDF',  icon: <FileType size={13} />, desc: 'Fixed-layout document' },
  cbz:  { label: 'CBZ',  icon: <Layers size={13} />,  desc: 'Comic book archive (ZIP)' },
  cbr:  { label: 'CBR',  icon: <Layers size={13} />,  desc: 'Comic book archive (RAR)' },
  mobi: { label: 'MOBI', icon: <FileText size={13} />, desc: 'Kindle format — not yet supported' },
  unknown: { label: '?', icon: <FileText size={13} />, desc: 'Unknown format' },
};

const SUPPORTED: BookFormat[] = ['epub', 'pdf', 'cbz', 'cbr'];

export default function DetailScreen({ book, onBack, onRead }: DetailScreenProps) {
  const config = useAppStore((s) => s.config)!;
  const progress = useAppStore((s) => s.progress[book.Id]);
  const downloads = useAppStore((s) => s.downloads);
  const addDownload = useAppStore((s) => s.addDownload);
  const removeDownload = useAppStore((s) => s.removeDownload);

  const [detail, setDetail] = useState<JellyfinItem>(book);
  const [imgError, setImgError] = useState(false);
  const [isFav, setIsFav] = useState(book.UserData?.IsFavorite ?? false);
  const [favLoading, setFavLoading] = useState(false);

  const [dlProgress, setDlProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dlError, setDlError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load full detail (includes Overview and all People)
  useEffect(() => {
    getBookDetail(config, book.Id)
      .then((d) => setDetail(d))
      .catch(() => {});
  }, [book.Id, config]);

  const format = detectFormat(detail);
  const fmt = FORMAT_INFO[format];
  const supported = SUPPORTED.includes(format);
  const hasCover = !!detail.ImageTags?.Primary && !imgError;
  const coverUrl = hasCover ? getCoverUrl(config, detail.Id, 600) : null;
  const author = detail.People?.find((p) => p.Type === 'Author')?.Name;
  const pct = progress?.percentage ?? 0;
  const inProgress = pct > 0 && pct < 98;
  const isRead = detail.UserData?.Played ?? false;
  const cached = downloads[book.Id];

  const handleFavorite = async () => {
    setFavLoading(true);
    const next = !isFav;
    setIsFav(next);
    try {
      await toggleFavorite(config, detail.Id, next);
    } catch {
      setIsFav(!next);
    } finally {
      setFavLoading(false);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDlError('');
    setDlProgress(0);

    try {
      const url = getDownloadUrl(config, book.Id);
      const { localPath, fileSize } = await downloadBook(
        url,
        book.Id,
        format,
        (_, __, pctVal) => setDlProgress(Math.round(pctVal)),
      );
      addDownload({
        itemId: book.Id,
        localPath,
        format,
        fileSize,
        downloadedAt: Date.now(),
        bookName: book.Name,
      });
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
    } catch (err: unknown) {
      setDlError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg)' }}>

      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium px-3 py-1.5"
          style={{
            color: 'var(--color-muted)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
        >
          <ArrowLeft size={15} />
          Library
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-10 p-8 max-w-4xl">

          {/* ── Cover ── */}
          <div className="flex-shrink-0" style={{ width: 220 }}>
            <div
              className="overflow-hidden"
              style={{
                width: 220, aspectRatio: '2/3',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <BookOpen size={40} style={{ color: 'var(--color-faint)' }} />
                  <span className="text-xs text-center px-4" style={{ color: 'var(--color-muted)' }}>
                    No cover
                  </span>
                </div>
              )}
            </div>

            {/* Favorite button */}
            <button
              onClick={handleFavorite}
              disabled={favLoading}
              className="w-full flex items-center justify-center gap-2 mt-3 py-2 text-sm"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '5px',
                color: isFav ? '#d4922a' : 'var(--color-muted)',
                cursor: 'pointer',
              }}
            >
              <Star size={14} fill={isFav ? '#d4922a' : 'none'} />
              {isFav ? 'Favourited' : 'Add to Favourites'}
            </button>
          </div>

          {/* ── Info ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* Title / author */}
            <div className="flex flex-col gap-2">
              {detail.SeriesName && (
                <p className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
                  {detail.SeriesName}
                  {detail.IndexNumber ? ` · Vol. ${detail.IndexNumber}` : ''}
                </p>
              )}
              <h1 className="text-2xl font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
                {detail.Name}
              </h1>
              {author && (
                <div className="flex items-center gap-2">
                  <User size={13} style={{ color: 'var(--color-faint)' }} />
                  <span className="text-base" style={{ color: 'var(--color-muted)' }}>{author}</span>
                </div>
              )}
              {detail.ProductionYear && (
                <div className="flex items-center gap-2">
                  <Calendar size={13} style={{ color: 'var(--color-faint)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{detail.ProductionYear}</span>
                </div>
              )}
            </div>

            {/* Metadata chips */}
            <div className="flex flex-wrap gap-2">
              <Chip icon={fmt.icon} label={fmt.label} accent={supported} title={fmt.desc} />
              {cached && (
                <Chip icon={<HardDrive size={11} />} label={`On device · ${formatBytes(cached.fileSize)}`} green />
              )}
              {detail.Genres?.map((g) => (
                <Chip key={g} icon={<Tag size={11} />} label={g} />
              ))}
              {isRead && <Chip icon={<Check size={11} />} label="Read" green />}
            </div>

            {/* Reading progress */}
            {inProgress && (
              <div className="flex flex-col gap-2 p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-muted)' }}>Reading progress</span>
                  <span style={{ color: 'var(--color-accent)' }}>{Math.round(pct)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full progress-fill" style={{ width: `${pct}%`, borderRadius: '3px' }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {supported ? (
                <ActionButton
                  onClick={onRead}
                  primary
                  icon={inProgress ? <RotateCcw size={16} /> : <Play size={16} />}
                >
                  {inProgress ? 'Continue Reading' : isRead ? 'Read Again' : 'Open Reader'}
                </ActionButton>
              ) : (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 text-sm"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '5px',
                    color: 'var(--color-faint)',
                  }}
                >
                  Format not yet supported ({fmt.label})
                </div>
              )}

              {/* Download / Delete */}
              {supported && !cached && (
                <ActionButton
                  icon={<Download size={16} />}
                  onClick={handleDownload}
                  disabled={isDownloading}
                  title="Save to device for offline reading"
                >
                  {isDownloading ? `Downloading… ${dlProgress}%` : 'Download'}
                </ActionButton>
              )}
              {supported && cached && (
                <ActionButton
                  icon={<Trash2 size={16} />}
                  onClick={handleDelete}
                  danger
                  title="Remove from device"
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
                    style={{
                      width: `${dlProgress}%`,
                      background: 'var(--color-accent)',
                      borderRadius: '3px',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {dlProgress < 100 ? `Downloading… ${dlProgress}%` : 'Saving to device…'}
                </p>
              </div>
            )}

            {/* Download error */}
            {dlError && (
              <p className="text-sm" style={{ color: 'var(--color-red)' }}>{dlError}</p>
            )}

            {/* Unsupported format notice */}
            {!supported && (
              <div
                className="p-4 text-sm"
                style={{
                  background: 'rgba(201,95,95,0.08)',
                  border: '1px solid rgba(201,95,95,0.2)',
                  borderRadius: '5px',
                  color: 'var(--color-red)',
                }}
              >
                <strong>{fmt.label}</strong> format is not currently supported. {fmt.desc}.
              </div>
            )}

            {/* Synopsis */}
            {detail.Overview && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-faint)' }}>
                  Synopsis
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)', maxWidth: 540 }}>
                  {detail.Overview}
                </p>
              </div>
            )}

            {/* File path */}
            {detail.Path && (
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-faint)' }}>
                  File
                </h3>
                <p className="text-xs font-mono break-all" style={{ color: 'var(--color-faint)' }}>
                  {detail.Path}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  icon, label, accent, green, title,
}: {
  icon?: React.ReactNode;
  label: string;
  accent?: boolean;
  green?: boolean;
  title?: string;
}) {
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
      title={title}
      style={{
        background: accent
          ? 'var(--color-accent-bg)'
          : green
          ? 'rgba(90,158,111,0.12)'
          : 'var(--color-card)',
        border: `1px solid ${accent ? 'rgba(212,146,42,0.3)' : green ? 'rgba(90,158,111,0.25)' : 'var(--color-border)'}`,
        borderRadius: '4px',
        color: accent ? 'var(--color-accent-soft)' : green ? 'var(--color-green)' : 'var(--color-muted)',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function ActionButton({
  children, onClick, icon, primary, danger, disabled, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
      style={{
        background: primary
          ? 'var(--color-accent)'
          : danger
          ? 'rgba(201,95,95,0.1)'
          : 'var(--color-card)',
        border: primary
          ? 'none'
          : danger
          ? '1px solid rgba(201,95,95,0.3)'
          : '1px solid var(--color-border)',
        borderRadius: '5px',
        color: primary ? '#111' : danger ? 'var(--color-red)' : 'var(--color-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
