import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Sun, Moon, Coffee, Type,
  ChevronLeft, ChevronRight, List, X, HardDrive, Wifi,
  Bookmark, Search, Loader, Trash2,
} from 'lucide-react';
import type { ReaderSettings, ReaderTheme, ReaderFont, Annotation } from '../../types/jellyfin';
import { HIGHLIGHT_COLORS, type SearchFn } from './EpubReader';

interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

interface ReaderControlsProps {
  title: string;
  author?: string;
  currentPage?: number;
  totalPages?: number;
  progress: number;
  settings: ReaderSettings;
  toc?: TocItem[];
  isOffline?: boolean;
  annotations?: Annotation[];
  selectedCfi?: string | null;
  selectedQuote?: string;
  onBack: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSettingsChange: (s: Partial<ReaderSettings>) => void;
  onTocNavigate?: (href: string) => void;
  onHighlight?: (cfi: string, color: string) => void;
  onClearSelection?: () => void;
  onRemoveAnnotation?: (ann: Annotation) => void;
  onSearch?: SearchFn;
}

type LeftPanel = 'none' | 'toc' | 'annotations' | 'search';

const BAR_BG = 'rgba(14, 13, 15, 0.92)';
const BORDER = '1px solid rgba(44, 41, 48, 0.8)';

export default function ReaderControls({
  title, author, currentPage, totalPages, progress,
  settings, toc = [], isOffline, annotations = [],
  selectedCfi, selectedQuote,
  onBack, onPrevPage, onNextPage,
  onSettingsChange, onTocNavigate,
  onHighlight, onClearSelection,
  onRemoveAnnotation, onSearch,
}: ReaderControlsProps) {
  const [visible,      setVisible]      = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [leftPanel,    setLeftPanel]    = useState<LeftPanel>('none');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ cfi: string; excerpt: string }>>([]);
  const [isSearching,  setIsSearching]  = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleLeft = (panel: LeftPanel) =>
    setLeftPanel(p => p === panel ? 'none' : panel);

  // Dismiss selection toolbar when controls hide
  useEffect(() => {
    if (!visible && selectedCfi) onClearSelection?.();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !onSearch) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearch(searchQuery.trim());
        setSearchResults(results.slice(0, 60));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, onSearch]);

  return (
    <>
      {/* ── Click zones ── */}
      <div
        className="absolute inset-0 z-0"
        onClick={(e) => {
          if (visible) {
            setVisible(false);
            setShowSettings(false);
            setLeftPanel('none');
            return;
          }
          const x = e.clientX;
          const w = window.innerWidth;
          if (x < w / 3) onPrevPage();
          else if (x > (2 * w) / 3) onNextPage();
          else setVisible(true);
        }}
      />

      {/* ── Top bar ── */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -44 }}
            transition={{ duration: 0.16 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-5 py-3"
            style={{ background: BAR_BG, borderBottom: BORDER, backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium py-1 px-2"
              style={{ color: 'var(--color-muted)', borderRadius: '4px', border: 'none', background: 'transparent' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)')}
            >
              <ArrowLeft size={16} /><span>Library</span>
            </button>

            <div className="flex-1 min-w-0 px-2 flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{title}</p>
                {author && <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{author}</p>}
              </div>
              {isOffline !== undefined && (
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 flex-shrink-0"
                  style={{
                    background: isOffline ? 'rgba(90,158,111,0.15)' : 'rgba(91,133,184,0.15)',
                    border: `1px solid ${isOffline ? 'rgba(90,158,111,0.3)' : 'rgba(91,133,184,0.3)'}`,
                    borderRadius: '3px',
                    color: isOffline ? 'var(--color-green)' : 'var(--color-blue)',
                  }}
                >
                  {isOffline ? <HardDrive size={9} /> : <Wifi size={9} />}
                  {isOffline ? 'Offline' : 'Streaming'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {onSearch && (
                <ControlBtn active={leftPanel === 'search'} onClick={() => { toggleLeft('search'); setShowSettings(false); }}>
                  <Search size={16} />
                </ControlBtn>
              )}
              {annotations.length > 0 && (
                <ControlBtn active={leftPanel === 'annotations'} onClick={() => { toggleLeft('annotations'); setShowSettings(false); }}>
                  <Bookmark size={16} />
                </ControlBtn>
              )}
              {toc.length > 0 && (
                <ControlBtn active={leftPanel === 'toc'} onClick={() => { toggleLeft('toc'); setShowSettings(false); }}>
                  <List size={17} />
                </ControlBtn>
              )}
              <ControlBtn active={showSettings} onClick={() => { setShowSettings(v => !v); setLeftPanel('none'); }}>
                <Type size={17} />
              </ControlBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar ── */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 44 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-4 px-5 py-3"
            style={{ background: BAR_BG, borderTop: BORDER, backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onPrevPage}
              className="flex items-center justify-center flex-shrink-0"
              style={{ color: 'var(--color-muted)', borderRadius: '7px', border: '1px solid var(--color-border)', background: 'var(--color-card)', width: 44, height: 44, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-raised)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)'; }}
            >
              <ChevronLeft size={22} />
            </button>

            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <motion.div className="h-full" style={{ background: 'var(--color-accent)', borderRadius: '1px' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
              </div>
              <div className="flex justify-between" style={{ fontSize: 11, color: 'var(--color-faint)' }}>
                <span>{Math.round(progress)}%</span>
                {currentPage != null && totalPages != null && <span>Page {currentPage} of {totalPages}</span>}
              </div>
            </div>

            <button
              onClick={onNextPage}
              className="flex items-center justify-center flex-shrink-0"
              style={{ color: 'var(--color-accent-soft)', borderRadius: '7px', border: '1px solid var(--color-accent-dim)', background: 'var(--color-accent-bg)', width: 44, height: 44, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,146,42,0.22)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-bg)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)'; }}
            >
              <ChevronRight size={22} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Highlight toolbar (slides up from bottom when text is selected) ── */}
      <AnimatePresence>
        {selectedCfi && visible && (
          <>
            {/* Transparent backdrop to dismiss on outside click */}
            <div className="absolute inset-0 z-20" onClick={onClearSelection} />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3"
              style={{
                bottom: 68,
                background: BAR_BG,
                border: BORDER,
                borderRadius: '12px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                maxWidth: 360,
                width: 'max-content',
              }}
              onClick={e => e.stopPropagation()}
            >
              <span className="text-xs font-medium truncate max-w-40" style={{ color: 'var(--color-muted)' }}>
                "{selectedQuote?.slice(0, 48)}{(selectedQuote?.length ?? 0) > 48 ? '…' : ''}"
              </span>
              <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <div className="flex items-center gap-2">
                {Object.entries(HIGHLIGHT_COLORS).map(([key, { hex }]) => (
                  <button
                    key={key}
                    title={key}
                    onClick={() => { onHighlight?.(selectedCfi, key); onClearSelection?.(); }}
                    className="flex-shrink-0 rounded-full border-2 transition-transform hover:scale-110 active:scale-95"
                    style={{
                      width: 22, height: 22,
                      background: hex,
                      borderColor: 'rgba(255,255,255,0.25)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <button onClick={onClearSelection} style={{ color: 'var(--color-faint)', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Settings panel (right) ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute top-14 right-0 bottom-12 z-20 overflow-y-auto"
            style={{ width: 264, background: 'var(--color-surface)', borderLeft: BORDER }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Reading</p>
              <button onClick={() => setShowSettings(false)} style={{ color: 'var(--color-faint)' }}><X size={15} /></button>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <SettingGroup label="Theme">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'dark' as ReaderTheme,  label: 'Dark',  icon: <Moon size={13} />,    bg: '#0a0a0f', fg: '#e8e0d0' },
                    { id: 'light' as ReaderTheme, label: 'Light', icon: <Sun size={13} />,     bg: '#f8f5ef', fg: '#1a1612' },
                    { id: 'sepia' as ReaderTheme, label: 'Sepia', icon: <Coffee size={13} />,  bg: '#f4e8c1', fg: '#3a2e1a' },
                  ]).map((t) => (
                    <button key={t.id} onClick={() => onSettingsChange({ theme: t.id })}
                      className="flex flex-col items-center gap-1.5 py-3 px-2"
                      style={{ borderRadius: '5px', border: settings.theme === t.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)', background: settings.theme === t.id ? 'var(--color-accent-bg)' : 'var(--color-card)', cursor: 'pointer' }}
                    >
                      <div className="w-10 h-6 flex items-center justify-center" style={{ background: t.bg, borderRadius: '3px', border: '1px solid rgba(128,128,128,0.2)' }}>
                        <span style={{ color: t.fg }}>{t.icon}</span>
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: settings.theme === t.id ? 'var(--color-accent-soft)' : 'var(--color-muted)' }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </SettingGroup>
              <SettingGroup label="Typeface">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'serif' as ReaderFont, label: 'Serif', style: 'Georgia,serif' },
                    { id: 'sans'  as ReaderFont, label: 'Sans',  style: 'system-ui,sans-serif' },
                    { id: 'mono'  as ReaderFont, label: 'Mono',  style: 'monospace' },
                  ]).map((f) => (
                    <button key={f.id} onClick={() => onSettingsChange({ font: f.id })}
                      className="py-2.5 text-xs"
                      style={{ fontFamily: f.style, borderRadius: '5px', border: settings.font === f.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)', background: settings.font === f.id ? 'var(--color-accent-bg)' : 'var(--color-card)', color: settings.font === f.id ? 'var(--color-accent-soft)' : 'var(--color-muted)', cursor: 'pointer' }}
                    >{f.label}</button>
                  ))}
                </div>
              </SettingGroup>
              <SettingGroup label="Size" value={`${settings.fontSize}px`}>
                <input type="range" min={12} max={32} value={settings.fontSize} onChange={e => onSettingsChange({ fontSize: Number(e.target.value) })} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              </SettingGroup>
              <SettingGroup label="Line Spacing" value={settings.lineHeight.toFixed(1)}>
                <input type="range" min={1.2} max={2.4} step={0.1} value={settings.lineHeight} onChange={e => onSettingsChange({ lineHeight: Number(e.target.value) })} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              </SettingGroup>
              <SettingGroup label="Margins" value={`${settings.margins}px`}>
                <input type="range" min={20} max={160} step={10} value={settings.margins} onChange={e => onSettingsChange({ margins: Number(e.target.value) })} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              </SettingGroup>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left panel (TOC / Annotations / Search) ── */}
      <AnimatePresence>
        {leftPanel !== 'none' && (
          <motion.div
            initial={{ opacity: 0, x: -280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute top-14 left-0 bottom-12 z-20 flex flex-col"
            style={{ width: 280, background: 'var(--color-surface)', borderRight: BORDER }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header with tab switcher */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: BORDER }}>
              <div className="flex items-center gap-1">
                {toc.length > 0 && (
                  <TabBtn active={leftPanel === 'toc'} onClick={() => setLeftPanel('toc')}>Contents</TabBtn>
                )}
                {onSearch && (
                  <TabBtn active={leftPanel === 'search'} onClick={() => setLeftPanel('search')}>Search</TabBtn>
                )}
                <TabBtn active={leftPanel === 'annotations'} onClick={() => setLeftPanel('annotations')}>
                  Highlights{annotations.length > 0 ? ` (${annotations.length})` : ''}
                </TabBtn>
              </div>
              <button onClick={() => setLeftPanel('none')} style={{ color: 'var(--color-faint)' }}>
                <X size={15} />
              </button>
            </div>

            {/* TOC */}
            {leftPanel === 'toc' && (
              <div className="flex-1 overflow-y-auto py-2">
                {toc.map(item => (
                  <TocEntry key={item.id} item={item} depth={0} onNavigate={href => { onTocNavigate?.(href); setLeftPanel('none'); }} />
                ))}
              </div>
            )}

            {/* Search */}
            {leftPanel === 'search' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: BORDER }}>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-faint)' }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search in book…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%', paddingLeft: '32px', paddingRight: '10px',
                        paddingTop: '7px', paddingBottom: '7px',
                        background: 'var(--color-card)', border: '1px solid var(--color-border)',
                        borderRadius: '5px', color: 'var(--color-text)', fontSize: '13px', outline: 'none',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--color-accent-dim)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {isSearching && (
                    <div className="flex justify-center py-6">
                      <Loader size={18} className="animate-spin" style={{ color: 'var(--color-faint)' }} />
                    </div>
                  )}
                  {!isSearching && searchQuery && searchResults.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--color-faint)' }}>No results</p>
                  )}
                  {!isSearching && searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { onTocNavigate?.(r.cfi); setLeftPanel('none'); }}
                      className="w-full text-left px-4 py-3 text-xs"
                      style={{ color: 'var(--color-muted)', background: 'transparent', border: 'none', borderBottom: BORDER, cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; }}
                    >
                      <span dangerouslySetInnerHTML={{ __html: r.excerpt }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Annotations */}
            {leftPanel === 'annotations' && (
              <div className="flex-1 overflow-y-auto">
                {annotations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                    <Bookmark size={28} style={{ color: 'var(--color-faint)' }} />
                    <p className="text-xs text-center" style={{ color: 'var(--color-faint)' }}>
                      Select text while reading to add a highlight
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {annotations.map(ann => (
                      <div
                        key={ann.id}
                        className="px-4 py-3 flex items-start gap-3 cursor-pointer"
                        style={{ borderBottom: BORDER }}
                        onClick={() => { onTocNavigate?.(ann.cfiRange); setLeftPanel('none'); }}
                        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--color-card)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                      >
                        <div
                          className="flex-shrink-0 mt-0.5 rounded-full"
                          style={{ width: 10, height: 10, background: HIGHLIGHT_COLORS[ann.color]?.hex ?? '#FFD700' }}
                        />
                        <p className="flex-1 text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--color-muted)' }}>
                          "{ann.quote}"
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveAnnotation?.(ann); }}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: 'var(--color-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-red)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-faint)')}
                          title="Remove highlight"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ControlBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-2"
      style={{ borderRadius: '4px', border: 'none', background: active ? 'var(--color-accent-bg)' : 'transparent', color: active ? 'var(--color-accent-soft)' : 'var(--color-muted)', cursor: 'pointer' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; }}
    >{children}</button>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-xs font-semibold px-2.5 py-1"
      style={{ borderRadius: '4px', background: active ? 'var(--color-accent-bg)' : 'transparent', color: active ? 'var(--color-accent-soft)' : 'var(--color-faint)', border: 'none', cursor: 'pointer' }}
    >{children}</button>
  );
}

function SettingGroup({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{label}</p>
        {value && <span className="text-xs" style={{ color: 'var(--color-faint)' }}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

function TocEntry({ item, depth, onNavigate }: { item: TocItem; depth: number; onNavigate: (h: string) => void }) {
  return (
    <>
      <button
        onClick={() => onNavigate(item.href)}
        className="w-full text-left text-sm py-2.5 truncate"
        style={{ paddingLeft: `${20 + depth * 16}px`, paddingRight: '20px', color: 'var(--color-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >{item.label}</button>
      {item.subitems?.map(sub => <TocEntry key={sub.id} item={sub} depth={depth + 1} onNavigate={onNavigate} />)}
    </>
  );
}
