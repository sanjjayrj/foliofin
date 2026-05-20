import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Star } from 'lucide-react';
import type { JellyfinItem } from '../../types/jellyfin';
import { getCoverUrl } from '../../services/jellyfin';
import { useAppStore } from '../../store';

interface BookCardProps {
  book: JellyfinItem;
  onClick: () => void;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const config = useAppStore((s) => s.config)!;
  const progress = useAppStore((s) => s.progress[book.Id]);
  const [imgError, setImgError] = useState(false);

  const author = book.People?.find((p) => p.Type === 'Author')?.Name;
  const coverUrl = book.HasPrimaryImage && !imgError
    ? getCoverUrl(config, book.Id, 320)
    : null;

  const pct = progress?.percentage ?? 0;
  const isRead = book.UserData?.Played ?? false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="group relative cursor-pointer flex flex-col rounded-[14px] overflow-hidden bg-[#171726] border border-[#2a2a42] book-card-hover"
      style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden bg-[#0f0f1a]">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={book.Name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1f1f32] to-[#0f0f1a]">
            <BookOpen size={36} className="text-[#3a3a52]" />
            <p className="text-xs text-[#5a5a7a] text-center px-2 leading-tight">{book.Name}</p>
          </div>
        )}

        {/* Read badge */}
        {isRead && (
          <div className="absolute top-2 right-2 bg-[#10b981]/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Read
          </div>
        )}

        {/* Favorite indicator */}
        {book.UserData?.IsFavorite && (
          <div className="absolute top-2 left-2 text-yellow-400">
            <Star size={14} fill="currentColor" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
          <span className="text-white text-xs font-medium">Open</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-[#f0f0ff] leading-tight line-clamp-2">{book.Name}</h3>
        {author && (
          <p className="text-xs text-[#9898b8] truncate">{author}</p>
        )}
        {book.ProductionYear && (
          <p className="text-xs text-[#5a5a7a]">{book.ProductionYear}</p>
        )}

        {/* Progress bar */}
        {pct > 0 && pct < 100 && (
          <div className="mt-1.5">
            <div className="h-0.5 w-full bg-[#2a2a42] rounded-full overflow-hidden">
              <div
                className="h-full progress-bar rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5a5a7a] mt-0.5">{Math.round(pct)}%</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
