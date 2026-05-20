import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Grid3x3, List, BookOpen, RefreshCw, X } from 'lucide-react';
import BookCard from '../ui/BookCard';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { getBooks, getCoverUrl } from '../../services/jellyfin';
import { useAppStore } from '../../store';
import type { JellyfinItem } from '../../types/jellyfin';

interface LibraryScreenProps {
  onOpenBook: () => void;
}

type SortOption = 'SortName' | 'DateCreated' | 'CommunityRating' | 'PremiereDate';

export default function LibraryScreen({ onOpenBook }: LibraryScreenProps) {
  const { config, activeLibraryId, books, totalBooks, setBooks, setCurrentBook, searchQuery, setSearchQuery } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('SortName');
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (search = '') => {
    if (!config) return;
    setLoading(true);
    setError('');
    try {
      const data = await getBooks(config, {
        parentId: activeLibraryId ?? undefined,
        search: search || undefined,
        sortBy,
        limit: 200,
      });
      setBooks(data.Items, data.TotalRecordCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [config, activeLibraryId, sortBy, setBooks]);

  useEffect(() => { load(searchQuery); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, [setSearchQuery]);

  // Debounce search term changes
  useEffect(() => {
    const t = setTimeout(() => load(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery, load]);

  const handleOpenBook = (book: JellyfinItem) => {
    setCurrentBook(book);
    onOpenBook();
  };

  return (
    <div className="flex flex-col h-full bg-[#08080f]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c2e] bg-[#0f0f1a]/80 backdrop-blur-sm">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a7a]" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search books, authors…"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-[#171726] border border-[#2a2a42] rounded-[10px] text-[#f0f0ff] placeholder-[#5a5a7a] pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a7a] hover:text-[#f0f0ff]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-[#171726] border border-[#2a2a42] rounded-[8px] text-[#9898b8] text-xs px-2.5 py-1.5 focus:outline-none focus:border-[#7c3aed] cursor-pointer"
          >
            <option value="SortName">A – Z</option>
            <option value="DateCreated">Newest</option>
            <option value="CommunityRating">Rating</option>
            <option value="PremiereDate">Year</option>
          </select>

          {/* View toggle */}
          <div className="flex bg-[#171726] border border-[#2a2a42] rounded-[8px] overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[#7c3aed] text-white' : 'text-[#9898b8] hover:text-[#f0f0ff]'}`}
            >
              <Grid3x3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-[#7c3aed] text-white' : 'text-[#9898b8] hover:text-[#f0f0ff]'}`}
            >
              <List size={14} />
            </button>
          </div>

          <button
            onClick={() => load(searchQuery)}
            className="p-1.5 rounded-[8px] text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32] transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-2 flex items-center gap-2">
        <p className="text-xs text-[#5a5a7a]">
          {loading ? 'Loading…' : `${totalBooks} book${totalBooks !== 1 ? 's' : ''}`}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading && books.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" label="Loading your library…" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <X size={20} className="text-red-400" />
            </div>
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => load(searchQuery)}>
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1f1f32] flex items-center justify-center">
              <BookOpen size={24} className="text-[#3a3a52]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#9898b8]">No books found</p>
              <p className="text-xs text-[#5a5a7a] mt-1">
                {searchQuery ? 'Try a different search term' : 'Upload books to your Jellyfin server to get started'}
              </p>
            </div>
          </div>
        )}

        {books.length > 0 && viewMode === 'grid' && (
          <motion.div
            layout
            className="grid gap-4 pt-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            }}
          >
            <AnimatePresence>
              {books.map((book) => (
                <BookCard key={book.Id} book={book} onClick={() => handleOpenBook(book)} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {books.length > 0 && viewMode === 'list' && (
          <div className="space-y-2 pt-2">
            {books.map((book) => (
              <ListBookRow key={book.Id} book={book} onClick={() => handleOpenBook(book)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListBookRow({ book, onClick }: { book: JellyfinItem; onClick: () => void }) {
  const config = useAppStore((s) => s.config)!;
  const progress = useAppStore((s) => s.progress[book.Id]);
  const author = book.People?.find((p) => p.Type === 'Author')?.Name;
  const pct = progress?.percentage ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="flex items-center gap-4 p-3 rounded-[12px] bg-[#171726] border border-[#2a2a42] hover:border-[#7c3aed]/40 hover:bg-[#1f1f32] cursor-pointer transition-all group"
    >
      <div className="w-12 h-16 rounded-[6px] overflow-hidden bg-[#0f0f1a] flex-shrink-0">
        {book.HasPrimaryImage ? (
          <img
            src={getCoverUrl(config, book.Id, 96)}
            alt={book.Name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={16} className="text-[#3a3a52]" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#f0f0ff] truncate">{book.Name}</p>
        {author && <p className="text-xs text-[#9898b8] truncate mt-0.5">{author}</p>}
        {book.ProductionYear && <p className="text-xs text-[#5a5a7a] mt-0.5">{book.ProductionYear}</p>}
      </div>
      {pct > 0 && (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-xs text-[#9898b8]">{Math.round(pct)}%</p>
          <div className="w-16 h-1 bg-[#2a2a42] rounded-full overflow-hidden">
            <div className="h-full progress-bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {book.UserData?.Played && (
        <span className="text-[10px] text-[#10b981] font-medium flex-shrink-0">Read</span>
      )}
    </motion.div>
  );
}
