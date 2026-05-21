import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Grid3x3, List, BookOpen, RefreshCw, X, BookMarked, Layers, HardDrive } from 'lucide-react';
import BookCard from '../ui/BookCard';
import Spinner from '../ui/Spinner';
import { getBooks, detectFormat, getCoverUrl } from '../../services/jellyfin';
import { useAppStore } from '../../store';
import type { JellyfinItem } from '../../types/jellyfin';

interface LibraryScreenProps {
  onOpenBook: () => void;
}

type SortOption = 'SortName' | 'DateCreated' | 'CommunityRating' | 'PremiereDate';

const COMIC_FORMATS = new Set(['cbz', 'cbr']);

export default function LibraryScreen({ onOpenBook }: LibraryScreenProps) {
  const {
    config, activeLibraryId, books,
    setBooks, setCurrentBook, searchQuery, setSearchQuery,
  } = useAppStore();
  const downloads = useAppStore((s) => s.downloads);
  const libraries = useAppStore((s) => s.libraries);

  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy]         = useState<SortOption>('SortName');
  const [offlineOnly, setOfflineOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // '/' key focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  useEffect(() => {
    const t = setTimeout(() => load(searchQuery), 380);
    return () => clearTimeout(t);
  }, [searchQuery, load]);

  const handleOpenBook = (book: JellyfinItem) => {
    setCurrentBook(book);
    onOpenBook();
  };

  const visible    = offlineOnly ? books.filter((b) => !!downloads[b.Id]) : books;
  const bookItems  = visible.filter((b) => !COMIC_FORMATS.has(detectFormat(b)));
  const comicItems = visible.filter((b) =>  COMIC_FORMATS.has(detectFormat(b)));

  const activeLib = libraries.find(l => l.ItemId === activeLibraryId);
  const screenTitle = activeLib?.Name ?? 'Library';

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-8 pt-7 pb-5"
        style={{ borderBottom: '1px solid var(--color-border-soft)' }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
              {screenTitle}
            </h1>
            {books.length > 0 && !loading && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-faint)' }}>
                {books.length} title{books.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => load(searchQuery)}
            title="Refresh"
            className="flex items-center justify-center"
            style={{
              width: 40, height: 40,
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-card)',
              color: 'var(--color-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pill search input */}
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 360 }}>
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-faint)' }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search books, authors… ( / )"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '22px',
                color: 'var(--color-text)',
                paddingLeft: 40,
                paddingRight: searchQuery ? 36 : 16,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent-dim)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort pill */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '22px',
              color: 'var(--color-muted)',
              padding: '10px 16px',
              fontSize: 14,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="SortName">A – Z</option>
            <option value="DateCreated">Newest Added</option>
            <option value="CommunityRating">Rating</option>
            <option value="PremiereDate">Year</option>
          </select>

          {/* On Device pill toggle */}
          {Object.keys(downloads).length > 0 && (
            <button
              onClick={() => setOfflineOnly((v) => !v)}
              className="flex items-center gap-2 font-semibold"
              style={{
                padding: '10px 16px',
                background: offlineOnly ? 'linear-gradient(135deg,rgba(212,146,42,0.18),rgba(212,146,42,0.12))' : 'var(--color-card)',
                border: `1px solid ${offlineOnly ? 'rgba(212,146,42,0.35)' : 'var(--color-border)'}`,
                borderRadius: '22px',
                color: offlineOnly ? 'var(--color-accent-soft)' : 'var(--color-muted)',
                fontSize: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <HardDrive size={15} />
              On Device
            </button>
          )}

          {/* View toggle pill */}
          <div
            className="flex overflow-hidden"
            style={{ border: '1px solid var(--color-border)', borderRadius: '22px', background: 'var(--color-card)' }}
          >
            {(['grid', 'list'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="flex items-center justify-center"
                style={{
                  width: 40, height: 40,
                  background: viewMode === m ? 'var(--color-accent-bg)' : 'transparent',
                  color: viewMode === m ? 'var(--color-accent-soft)' : 'var(--color-faint)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {m === 'grid' ? <Grid3x3 size={16} /> : <List size={16} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-7">

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
              className="text-sm px-5 py-2.5"
              style={{
                border: '1px solid var(--color-border)', borderRadius: '10px',
                color: 'var(--color-muted)', background: 'var(--color-card)', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && books.length === 0 && <Empty search={searchQuery} offlineOnly={false} />}
        {!loading && !error && books.length > 0 && bookItems.length === 0 && comicItems.length === 0 && (
          <Empty search={searchQuery} offlineOnly={offlineOnly} />
        )}

        {(bookItems.length > 0 || comicItems.length > 0) && (
          <div className="flex flex-col gap-14">
            {bookItems.length > 0 && (
              <section>
                <SectionHeader icon={<BookOpen size={16} />} label="Books" count={bookItems.length} />
                <div className="mt-5">
                  {viewMode === 'grid'
                    ? <GridLayout items={bookItems} onOpen={handleOpenBook} />
                    : <ListLayout items={bookItems} onOpen={handleOpenBook} />}
                </div>
              </section>
            )}
            {comicItems.length > 0 && (
              <section>
                <SectionHeader icon={<Layers size={16} />} label="Comics" count={comicItems.length} />
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

/* ── Sub-components ── */

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-2.5 font-bold"
        style={{ color: 'var(--color-text)', fontSize: 16 }}
      >
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        {label}
      </div>
      <span
        className="font-semibold"
        style={{
          fontSize: 12,
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          color: 'var(--color-faint)',
          padding: '3px 10px',
        }}
      >
        {count}
      </span>
    </div>
  );
}

function GridLayout({ items, onOpen }: { items: JellyfinItem[]; onOpen: (b: JellyfinItem) => void }) {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
      {items.map((book) => (
        <BookCard key={book.Id} book={book} onClick={() => onOpen(book)} />
      ))}
    </div>
  );
}

function ListLayout({ items, onOpen }: { items: JellyfinItem[]; onOpen: (b: JellyfinItem) => void }) {
  const config   = useAppStore((s) => s.config)!;
  const progress = useAppStore((s) => s.progress);

  return (
    <div className="flex flex-col gap-3">
      {items.map((book) => {
        const author   = book.People?.find((p) => p.Type === 'Author')?.Name;
        const pct      = progress[book.Id]?.percentage ?? 0;
        const hasCover = !!book.ImageTags?.Primary;

        return (
          <div
            key={book.Id}
            className="flex items-center gap-5 cursor-pointer"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '14px 18px',
              transition: 'border-color 0.14s, background 0.14s, box-shadow 0.14s',
            }}
            onClick={() => onOpen(book)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent-dim)';
              (e.currentTarget as HTMLDivElement).style.background = 'var(--color-raised)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
              (e.currentTarget as HTMLDivElement).style.background = 'var(--color-card)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div
              className="flex-shrink-0 overflow-hidden"
              style={{ width: 48, height: 66, background: 'var(--color-surface)', borderRadius: '7px', border: '1px solid var(--color-border-soft)' }}
            >
              {hasCover ? (
                <img src={getCoverUrl(config, book.Id, 100)} alt={book.Name} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen size={16} style={{ color: 'var(--color-faint)' }} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold truncate" style={{ color: 'var(--color-text)' }}>{book.Name}</p>
              {author && <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{author}</p>}
            </div>

            {pct > 0 && (
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="rounded-full overflow-hidden" style={{ width: 80, height: 5, background: 'var(--color-border)' }}>
                  <div className="h-full progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm w-8 text-right" style={{ color: 'var(--color-faint)' }}>{Math.round(pct)}%</span>
              </div>
            )}

            {book.UserData?.Played && (
              <span
                className="flex-shrink-0 text-xs font-semibold"
                style={{
                  color: 'var(--color-green)',
                  background: 'rgba(90,158,111,0.12)',
                  border: '1px solid rgba(90,158,111,0.25)',
                  borderRadius: '10px',
                  padding: '4px 10px',
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

function Empty({ search, offlineOnly }: { search: string; offlineOnly: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <BookMarked size={40} style={{ color: 'var(--color-faint)' }} />
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--color-muted)' }}>
          {offlineOnly ? 'No books on device' : search ? `No results for "${search}"` : 'No books found'}
        </p>
        <p className="text-sm mt-1.5" style={{ color: 'var(--color-faint)' }}>
          {offlineOnly
            ? 'Open a book and tap Download to save it for offline reading'
            : !search ? 'Upload books to your Jellyfin server to get started' : ''}
        </p>
      </div>
    </div>
  );
}
