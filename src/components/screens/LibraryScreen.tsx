import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Grid3x3, List, BookOpen, RefreshCw, X, BookMarked, Layers } from 'lucide-react';
import BookCard from '../ui/BookCard';
import Spinner from '../ui/Spinner';
import { getBooks, detectFormat, getCoverUrl } from '../../services/jellyfin';
import { useAppStore } from '../../store';
import type { JellyfinItem } from '../../types/jellyfin';

interface LibraryScreenProps {
  onOpenBook: () => void;
}

type SortOption = 'SortName' | 'DateCreated' | 'CommunityRating' | 'PremiereDate';

const COMIC_FORMATS = new Set(['cbz', 'cbr', 'cbr']);

export default function LibraryScreen({ onOpenBook }: LibraryScreenProps) {
  const {
    config, activeLibraryId, books,
    setBooks, setCurrentBook, searchQuery, setSearchQuery,
  } = useAppStore();

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
        limit: 500,
      });
      setBooks(data.Items, data.TotalRecordCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [config, activeLibraryId, sortBy, setBooks]);

  useEffect(() => { load(searchQuery); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(searchQuery), 380);
    return () => clearTimeout(t);
  }, [searchQuery, load]);

  const handleOpenBook = (book: JellyfinItem) => {
    setCurrentBook(book);
    onOpenBook();
  };

  // Split books vs comics
  const bookItems = books.filter((b) => !COMIC_FORMATS.has(detectFormat(b)));
  const comicItems = books.filter((b) => COMIC_FORMATS.has(detectFormat(b)));

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>

      {/* ── Top bar ──────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-8 py-5"
        style={{ borderBottom: '1px solid var(--color-border-soft)' }}
      >
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-faint)' }}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search books, authors…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '5px',
              color: 'var(--color-text)',
              paddingLeft: '38px',
              paddingRight: searchQuery ? '34px' : '14px',
              paddingTop: '8px',
              paddingBottom: '8px',
              fontSize: '14px',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent-dim)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-faint)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            color: 'var(--color-muted)',
            padding: '7px 10px',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="SortName">A – Z</option>
          <option value="DateCreated">Newest Added</option>
          <option value="CommunityRating">Rating</option>
          <option value="PremiereDate">Year</option>
        </select>

        {/* View toggle */}
        <div
          className="flex overflow-hidden"
          style={{ border: '1px solid var(--color-border)', borderRadius: '5px' }}
        >
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className="p-2"
              style={{
                background: viewMode === m ? 'var(--color-accent-bg)' : 'var(--color-surface)',
                color: viewMode === m ? 'var(--color-accent-soft)' : 'var(--color-faint)',
              }}
            >
              {m === 'grid' ? <Grid3x3 size={15} /> : <List size={15} />}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => load(searchQuery)}
          title="Refresh"
          style={{ color: 'var(--color-faint)', padding: '6px' }}
          className="rounded"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {loading && books.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" label="Loading library…" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <X size={28} style={{ color: 'var(--color-red)' }} />
            <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>
            <button
              onClick={() => load(searchQuery)}
              className="text-sm px-4 py-2 rounded"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <Empty search={searchQuery} />
        )}

        {books.length > 0 && (
          <div className="flex flex-col gap-12">
            {/* Books section */}
            {bookItems.length > 0 && (
              <section>
                <SectionHeader
                  icon={<BookOpen size={14} />}
                  label="Books"
                  count={bookItems.length}
                />
                <div className="mt-5">
                  {viewMode === 'grid'
                    ? <GridLayout items={bookItems} onOpen={handleOpenBook} />
                    : <ListLayout items={bookItems} onOpen={handleOpenBook} />}
                </div>
              </section>
            )}

            {/* Comics section */}
            {comicItems.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Layers size={14} />}
                  label="Comics"
                  count={comicItems.length}
                />
                <div className="mt-5">
                  {viewMode === 'grid'
                    ? <GridLayout items={comicItems} onOpen={handleOpenBook} />
                    : <ListLayout items={comicItems} onOpen={handleOpenBook} />}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 section-header">
      <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
      <span>{label}</span>
      <span
        className="ml-1 text-[11px] px-2 py-0.5 font-semibold"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '20px',
          color: 'var(--color-muted)',
          letterSpacing: 'normal',
          textTransform: 'none',
        }}
      >
        {count}
      </span>
    </div>
  );
}

function GridLayout({ items, onOpen }: { items: JellyfinItem[]; onOpen: (b: JellyfinItem) => void }) {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}
    >
      {items.map((book) => (
        <BookCard key={book.Id} book={book} onClick={() => onOpen(book)} />
      ))}
    </div>
  );
}

function ListLayout({ items, onOpen }: { items: JellyfinItem[]; onOpen: (b: JellyfinItem) => void }) {
  const config = useAppStore((s) => s.config)!;
  const progress = useAppStore((s) => s.progress);

  return (
    <div className="flex flex-col gap-2">
      {items.map((book) => {
        const author = book.People?.find((p) => p.Type === 'Author')?.Name;
        const pct = progress[book.Id]?.percentage ?? 0;
        const hasCover = !!book.ImageTags?.Primary;

        return (
          <div
            key={book.Id}
            className="flex items-center gap-5 px-5 py-4 cursor-pointer"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onClick={() => onOpen(book)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent-dim)';
              (e.currentTarget as HTMLDivElement).style.background = 'var(--color-raised)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
              (e.currentTarget as HTMLDivElement).style.background = 'var(--color-card)';
            }}
          >
            {/* Tiny cover */}
            <div
              className="flex-shrink-0 overflow-hidden"
              style={{
                width: 44, height: 62,
                background: 'var(--color-surface)',
                borderRadius: '4px',
                border: '1px solid var(--color-border-soft)',
              }}
            >
              {hasCover ? (
                <img
                  src={getCoverUrl(config, book.Id, 100)}
                  alt={book.Name}
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
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {book.Name}
              </p>
              {author && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
                  {author}
                </p>
              )}
            </div>

            {/* Progress */}
            {pct > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="w-20 h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--color-border)' }}
                >
                  <div
                    className="h-full progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs w-8 text-right" style={{ color: 'var(--color-faint)' }}>
                  {Math.round(pct)}%
                </span>
              </div>
            )}

            {book.UserData?.Played && (
              <span
                className="flex-shrink-0 text-xs font-medium px-2 py-0.5"
                style={{
                  color: 'var(--color-green)',
                  background: 'rgba(90,158,111,0.12)',
                  border: '1px solid rgba(90,158,111,0.25)',
                  borderRadius: '3px',
                }}
              >
                Read
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Empty({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <BookMarked size={36} style={{ color: 'var(--color-faint)' }} />
      <div className="text-center">
        <p className="font-medium" style={{ color: 'var(--color-muted)' }}>
          {search ? `No results for "${search}"` : 'No books found'}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-faint)' }}>
          {!search && 'Upload books to your Jellyfin server to get started'}
        </p>
      </div>
    </div>
  );
}
