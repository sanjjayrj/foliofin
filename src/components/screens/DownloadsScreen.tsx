import { useState } from 'react';
import { HardDrive, BookOpen, Layers, FileText, Trash2, Play } from 'lucide-react';
import { useAppStore } from '../../store';
import { getCoverUrl } from '../../services/jellyfin';
import { deleteBook, formatBytes } from '../../services/storage';
import type { DownloadEntry } from '../../types/jellyfin';

interface DownloadsScreenProps {
  onOpenBook: () => void;
}

const FORMAT_ICON: Record<string, React.ReactNode> = {
  epub: <BookOpen size={12} />,
  pdf:  <FileText size={12} />,
  cbz:  <Layers size={12} />,
  cbr:  <Layers size={12} />,
};

export default function DownloadsScreen({ onOpenBook }: DownloadsScreenProps) {
  const config       = useAppStore(s => s.config)!;
  const downloads    = useAppStore(s => s.downloads);
  const books        = useAppStore(s => s.books);
  const { setCurrentBook, removeDownload } = useAppStore();

  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const downloadList = Object.values(downloads).sort((a, b) => b.downloadedAt - a.downloadedAt);
  const totalSize    = downloadList.reduce((s, d) => s + d.fileSize, 0);

  const handleOpen = (entry: DownloadEntry) => {
    const book = books.find(b => b.Id === entry.itemId);
    if (book) {
      setCurrentBook(book);
      onOpenBook();
    }
  };

  const handleDelete = async (entry: DownloadEntry) => {
    if (confirmId !== entry.itemId) { setConfirmId(entry.itemId); return; }
    setDeleting(entry.itemId);
    setConfirmId(null);
    try {
      await deleteBook(entry.itemId, entry.format);
      removeDownload(entry.itemId);
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-4 px-10 py-6 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-soft)' }}
      >
        <HardDrive size={20} style={{ color: 'var(--color-accent)' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>Downloads</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-faint)' }}>
            {downloadList.length} book{downloadList.length !== 1 ? 's' : ''} · {formatBytes(totalSize)} on device
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {downloadList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <HardDrive size={36} style={{ color: 'var(--color-faint)' }} />
            <div className="text-center">
              <p className="font-medium" style={{ color: 'var(--color-muted)' }}>No books on device</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-faint)' }}>
                Open a book and tap Download to save it for offline reading
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {downloadList.map(entry => {
              const book    = books.find(b => b.Id === entry.itemId);
              const hasCover = !!book?.ImageTags?.Primary;
              const isConfirm = confirmId === entry.itemId;
              const isDeleting = deleting === entry.itemId;

              return (
                <div
                  key={entry.itemId}
                  className="flex items-center gap-5 px-6 py-4"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '7px',
                  }}
                >
                  {/* Cover thumbnail */}
                  <div
                    className="flex-shrink-0 overflow-hidden"
                    style={{ width: 44, height: 62, background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border-soft)' }}
                  >
                    {hasCover ? (
                      <img
                        src={getCoverUrl(config, entry.itemId, 100)}
                        alt={entry.bookName}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={14} style={{ color: 'var(--color-faint)' }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {entry.bookName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '3px', color: 'var(--color-muted)' }}
                      >
                        {FORMAT_ICON[entry.format] ?? <FileText size={10} />}
                        {entry.format.toUpperCase()}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-faint)' }}>
                        {formatBytes(entry.fileSize)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-faint)' }}>
                        · {new Date(entry.downloadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {book && (
                      <button
                        onClick={() => handleOpen(entry)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2"
                        style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-dim)', borderRadius: '5px', color: 'var(--color-accent-soft)', cursor: 'pointer' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,146,42,0.18)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-bg)')}
                      >
                        <Play size={11} /> Open
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(entry)}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2"
                      style={{
                        background: isConfirm ? 'rgba(201,95,95,0.12)' : 'var(--color-surface)',
                        border: `1px solid ${isConfirm ? 'rgba(201,95,95,0.4)' : 'var(--color-border)'}`,
                        borderRadius: '5px',
                        color: isConfirm ? 'var(--color-red)' : 'var(--color-faint)',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        opacity: isDeleting ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={11} />
                      {isConfirm ? 'Confirm' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
