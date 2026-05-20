import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppConfig,
  JellyfinItem,
  JellyfinLibrary,
  ReaderSettings,
  BookProgress,
  DownloadEntry,
  ActiveDownload,
  Annotation,
} from '../types/jellyfin';

interface AppStore {
  // Auth / server
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;
  clearConfig: () => void;

  // Libraries
  libraries: JellyfinLibrary[];
  setLibraries: (libs: JellyfinLibrary[]) => void;

  // Active library
  activeLibraryId: string | null;
  setActiveLibraryId: (id: string | null) => void;

  // Books cache
  books: JellyfinItem[];
  totalBooks: number;
  setBooks: (books: JellyfinItem[], total: number) => void;

  // Current book being read
  currentBook: JellyfinItem | null;
  setCurrentBook: (book: JellyfinItem | null) => void;

  // Reader settings
  readerSettings: ReaderSettings;
  setReaderSettings: (settings: Partial<ReaderSettings>) => void;

  // Reading progress (local cache)
  progress: Record<string, BookProgress>;
  setProgress: (itemId: string, progress: BookProgress) => void;

  // Downloaded books — persisted so we know what's on disk
  downloads: Record<string, DownloadEntry>;
  addDownload: (entry: DownloadEntry) => void;
  removeDownload: (itemId: string) => void;

  // Active downloads — transient, cleared on restart
  activeDownloads: Record<string, ActiveDownload>;
  setActiveDownload: (itemId: string, dl: ActiveDownload) => void;
  clearActiveDownload: (itemId: string) => void;

  // UI state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Annotations — highlights saved per book
  annotations: Record<string, Annotation[]>; // keyed by bookId
  addAnnotation: (ann: Annotation) => void;
  removeAnnotation: (bookId: string, annId: string) => void;

  // Transient: pre-read book bytes so reader opens with no I/O wait
  preloadedBook: { id: string; data: string | Uint8Array } | null;
  setPreloadedBook: (pb: { id: string; data: string | Uint8Array } | null) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      config: null,
      setConfig: (config) => set({ config }),
      clearConfig: () => set({
        config: null, libraries: [], books: [],
        currentBook: null, downloads: {}, activeDownloads: {},
      }),

      libraries: [],
      setLibraries: (libraries) => set({ libraries }),

      activeLibraryId: null,
      setActiveLibraryId: (activeLibraryId) => set({ activeLibraryId }),

      books: [],
      totalBooks: 0,
      setBooks: (books, totalBooks) => set({ books, totalBooks }),

      currentBook: null,
      setCurrentBook: (currentBook) => set({ currentBook }),

      readerSettings: {
        theme: 'dark',
        fontSize: 18,
        font: 'serif',
        lineHeight: 1.7,
        margins: 60,
      },
      setReaderSettings: (settings) =>
        set((state) => ({ readerSettings: { ...state.readerSettings, ...settings } })),

      progress: {},
      setProgress: (itemId, progress) =>
        set((state) => ({ progress: { ...state.progress, [itemId]: progress } })),

      downloads: {},
      addDownload: (entry) =>
        set((state) => ({ downloads: { ...state.downloads, [entry.itemId]: entry } })),
      removeDownload: (itemId) =>
        set((state) => {
          const { [itemId]: _, ...rest } = state.downloads;
          return { downloads: rest };
        }),

      activeDownloads: {},
      setActiveDownload: (itemId, dl) =>
        set((state) => ({ activeDownloads: { ...state.activeDownloads, [itemId]: dl } })),
      clearActiveDownload: (itemId) =>
        set((state) => {
          const { [itemId]: _, ...rest } = state.activeDownloads;
          return { activeDownloads: rest };
        }),

      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      annotations: {},
      addAnnotation: (ann) =>
        set((state) => ({
          annotations: {
            ...state.annotations,
            [ann.bookId]: [...(state.annotations[ann.bookId] ?? []), ann],
          },
        })),
      removeAnnotation: (bookId, annId) =>
        set((state) => ({
          annotations: {
            ...state.annotations,
            [bookId]: (state.annotations[bookId] ?? []).filter(a => a.id !== annId),
          },
        })),

      preloadedBook: null,
      setPreloadedBook: (preloadedBook) => set({ preloadedBook }),
    }),
    {
      name: 'foliofin-store',
      partialize: (state) => ({
        config: state.config,
        activeLibraryId: state.activeLibraryId,
        readerSettings: state.readerSettings,
        progress: state.progress,
        downloads: state.downloads,
        sidebarCollapsed: state.sidebarCollapsed,
        annotations: state.annotations,
      }),
    }
  )
);
