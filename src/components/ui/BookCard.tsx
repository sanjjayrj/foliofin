import { useState } from 'react';
import { BookOpen, Star, HardDrive } from 'lucide-react';
import type { JellyfinItem } from '../../types/jellyfin';
import { getCoverUrl, detectFormat } from '../../services/jellyfin';
import { useAppStore } from '../../store';

interface BookCardProps {
  book: JellyfinItem;
  onClick: () => void;
}

const FORMAT_LABEL: Record<string, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  cbz: 'CBZ',
  cbr: 'CBR',
  mobi: 'MOBI',
  unknown: '?',
};

export default function BookCard({ book, onClick }: BookCardProps) {
  const config = useAppStore((s) => s.config)!;
  const progress = useAppStore((s) => s.progress[book.Id]);
  const cached = useAppStore((s) => s.downloads[book.Id]);
  const [imgError, setImgError] = useState(false);

  // Use ImageTags.Primary (HasPrimaryImage is unreliable on this server)
  const hasCover = !!book.ImageTags?.Primary && !imgError;
  const coverUrl = hasCover ? getCoverUrl(config, book.Id, 400) : null;

  const author = book.People?.find((p) => p.Type === 'Author')?.Name;
  const fmt = detectFormat(book);
  const pct = progress?.percentage ?? 0;
  const isRead = book.UserData?.Played ?? false;
  const isFav = book.UserData?.IsFavorite ?? false;

  return (
    <div className="book-tile flex flex-col" onClick={onClick}>
      {/* Cover */}
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{ aspectRatio: '2/3', borderRadius: '5px 5px 0 0' }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={book.Name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{ background: 'var(--color-surface)' }}
          >
            <BookOpen size={32} style={{ color: 'var(--color-faint)' }} />
            <span
              className="text-xs text-center px-3 leading-snug"
              style={{ color: 'var(--color-muted)' }}
            >
              {book.Name}
            </span>
          </div>
        )}

        {/* Format badge — top left */}
        <span
          className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5"
          style={{
            background: 'rgba(0,0,0,0.72)',
            color: '#c8bfb0',
            borderRadius: '3px',
            letterSpacing: '0.04em',
          }}
        >
          {FORMAT_LABEL[fmt]}
        </span>

        {/* Favorite — top right */}
        {isFav && (
          <span className="absolute top-2 right-2">
            <Star size={13} fill="#d4922a" color="#d4922a" />
          </span>
        )}

        {/* Bottom-right badges */}
        <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
          {isRead && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5"
              style={{
                background: 'rgba(90,158,111,0.9)',
                color: '#fff',
                borderRadius: '3px',
              }}
            >
              Read
            </span>
          )}
          {cached && (
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5"
              style={{
                background: 'rgba(0,0,0,0.72)',
                color: '#7ec8a0',
                borderRadius: '3px',
              }}
              title="Saved on device"
            >
              <HardDrive size={9} />
              Local
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3">
        <p
          className="text-sm font-semibold leading-snug line-clamp-2"
          style={{ color: 'var(--color-text)' }}
        >
          {book.Name}
        </p>
        {author && (
          <p
            className="text-xs truncate"
            style={{ color: 'var(--color-muted)' }}
          >
            {author}
          </p>
        )}

        {/* Progress */}
        {pct > 0 && pct < 98 && (
          <div className="flex flex-col gap-1 mt-0.5">
            <div
              className="h-0.5 w-full rounded-full overflow-hidden"
              style={{ background: 'var(--color-border)' }}
            >
              <div
                className="h-full progress-fill"
                style={{ width: `${pct}%`, borderRadius: '2px' }}
              />
            </div>
            <span
              className="text-[10px]"
              style={{ color: 'var(--color-faint)' }}
            >
              {Math.round(pct)}% read
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
