import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Sun, Moon, Coffee, Type,
  ChevronLeft, ChevronRight, List, X, HardDrive, Wifi,
  Bookmark, Search, Loader, Trash2, Menu,
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

const BAR_BG = 'rgba(14, 13, 15, 0.94)';
const BORDER = '1px solid rgba(44, 41, 48, 0.8)';

// Top/bottom bar heights (px) — kept in sync with panel offsets below
const TOP_H  = 64;
const BOT_H  = 80;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export default function ReaderControls({
  title, author, currentPage, totalPages, progress,
  settings, toc = [], isOffline, annotations = [],
  selectedCfi, selectedQuote,
  onBack, onPrevPage, onNextPage,
  onSettingsChange, onTocNavigate,
  onHighlight, onClearSelection,
  onRemoveAnnotation, onSearch,
}: ReaderControlsProps) {
  const [visible,       setVisible]      = useState(true);
  const [showSettings,  setShowSettings] = useState(false);
  const [leftPanel,     setLeftPanel]    = useState<LeftPanel>('none');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ cfi: string; excerpt: string }>>([]);
  const [isSearching,   setIsSearching]  = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hideControls = () => {
    setVisible(false);
    setShowSettings(false);
    setLeftPanel('none');
  };

  const toggleLeft = (panel: LeftPanel) =>
    setLeftPanel(p => p === panel ? 'none' : panel);

  // Focus search input when search panel opens (autoFocus unreliable inside AnimatePresence)
  useEffect(() => {
    if (leftPanel === 'search') {
      const t = setTimeout(() => searchInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [leftPanel]);

  // Dismiss text selection when controls hide
  useEffect(() => {
    if (!visible && selectedCfi) onClearSelection?.();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !onSearch) { setSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearch(searchQuery.trim());
        setSearchResults(results.slice(0, 60));
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, onSearch]);

  return (
    <>
      {/* ── Navigation tap strips — only rendered when controls are hidden so they
           never block text selection while the bars/panels are visible.
           Left 18% = prev page, Right 18% = next page.
           Center 64% has NO overlay → text selection works freely. ── */}
      {!visible && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{ width: '18%', zIndex: 5, cursor: 'pointer' }}
            onClick={onPrevPage}
          />
          <div
            className="absolute right-0 top-0 bottom-0"
            style={{ width: '18%', zIndex: 5, cursor: 'pointer' }}
            onClick={onNextPage}
          />
        </>
      )}

      {/* ── Floating "show controls" button — visible only when bars are hidden ── */}
      {!visible && (
        <button
          onClick={() => setVisible(true)}
          className="absolute flex items-center justify-center"
          style={{
            top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 15,
            width: 44, height: 44,
            background: 'rgba(14,13,15,0.75)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '22px',
            color: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
          }}
        >
          <Menu size={18} />
        </button>
      )}

      {/* ── Top bar ── */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -TOP_H }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -TOP_H }}
            transition={{ duration: 0.18 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-4"
            style={{ background: BAR_BG, borderBottom: BORDER, backdropFilter: 'blur(10px)', height: TOP_H }}
            onClick={e => e.stopPropagation()}
          >
            {/* Back button — 44px tall minimum */}
            <button
              onClick={onBack}
              className="flex items-center gap-2 font-medium flex-shrink-0"
              style={{
                color: 'var(--color-muted)', borderRadius: '7px',
                border: 'none', background: 'transparent',
                fontSize: 15, height: 44, padding: '0 14px',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)')}
            >
              <ArrowLeft size={18} /><span>Library</span>
            </button>

            {/* Title / author */}
            <div className="flex-1 min-w-0 px-2 flex items-center gap-3 overflow-hidden">
              <div className="min-w-0">
                <p className="text-base font-semibold truncate leading-tight" style={{ color: 'var(--color-text)' }}>{title}</p>
                {author && <p className="text-sm truncate leading-tight mt-0.5" style={{ color: 'var(--color-muted)' }}>{author}</p>}
              </div>
              {isOffline !== undefined && (
                <span
                  className="flex items-center gap-1.5 font-semibold flex-shrink-0"
                  style={{
                    fontSize: 12,
                    background: isOffline ? 'rgba(90,158,111,0.15)' : 'rgba(91,133,184,0.15)',
                    border: `1px solid ${isOffline ? 'rgba(90,158,111,0.3)' : 'rgba(91,133,184,0.3)'}`,
                    borderRadius: '4px',
                    color: isOffline ? 'var(--color-green)' : 'var(--color-blue)',
                    padding: '3px 8px',
                  }}
                >
                  {isOffline ? <HardDrive size={11} /> : <Wifi size={11} />}
                  {isOffline ? 'Offline' : 'Streaming'}
                </span>
              )}
            </div>

            {/* Right-side icon buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onSearch && (
                <ControlBtn active={leftPanel === 'search'} onClick={() => { toggleLeft('search'); setShowSettings(false); }}>
                  <Search size={19} />
                </ControlBtn>
              )}
              {annotations.length > 0 && (
                <ControlBtn active={leftPanel === 'annotations'} onClick={() => { toggleLeft('annotations'); setShowSettings(false); }}>
                  <Bookmark size={19} />
                </ControlBtn>
              )}
              {toc.length > 0 && (
                <ControlBtn active={leftPanel === 'toc'} onClick={() => { toggleLeft('toc'); setShowSettings(false); }}>
                  <List size={19} />
                </ControlBtn>
              )}
              <ControlBtn active={showSettings} onClick={() => { setShowSettings(v => !v); setLeftPanel('none'); }}>
                <Type size={19} />
              </ControlBtn>
              <ControlBtn active={false} onClick={hideControls}>
                <X size={19} />
              </ControlBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar ── */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: BOT_H }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: BOT_H }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-4 px-5"
            style={{ background: BAR_BG, borderTop: BORDER, backdropFilter: 'blur(10px)', height: BOT_H }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onPrevPage}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                color: 'var(--color-muted)', borderRadius: '9px',
                border: '1px solid var(--color-border)', background: 'var(--color-card)',
                width: 52, height: 52, cursor: 'pointer',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-raised)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
              }}
            >
              <ChevronLeft size={26} />
            </button>

            <div className="flex-1 flex flex-col gap-2">
              {/* Progress bar — h-1.5 = 6px, clearly visible */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
              <div className="flex justify-between" style={{ fontSize: 13, color: 'var(--color-faint)' }}>
                <span>{Math.round(progress)}%</span>
                {currentPage != null && totalPages != null && (
                  <span>Page {currentPage} of {totalPages}</span>
                )}
              </div>
            </div>

            <button
              onClick={onNextPage}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                color: 'var(--color-accent-soft)', borderRadius: '9px',
                border: '1px solid var(--color-accent-dim)', background: 'var(--color-accent-bg)',
                width: 52, height: 52, cursor: 'pointer',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,146,42,0.22)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-bg)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)';
              }}
            >
              <ChevronRight size={26} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Highlight toolbar (slides up from bottom when text is selected) ── */}
      <AnimatePresence>
        {selectedCfi && visible && (
          <>
            <div className="absolute inset-0 z-20" onClick={onClearSelection} />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-4"
              style={{
                bottom: BOT_H + 12,
                background: BAR_BG,
                border: BORDER,
                borderRadius: '14px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                maxWidth: 420,
                width: 'max-content',
              }}
              onClick={e => e.stopPropagation()}
            >
              <span className="text-sm font-medium truncate max-w-48" style={{ color: 'var(--color-muted)' }}>
                "{selectedQuote?.slice(0, 48)}{(selectedQuote?.length ?? 0) > 48 ? '…' : ''}"
              </span>
              <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <div className="flex items-center gap-2.5">
                {Object.entries(HIGHLIGHT_COLORS).map(([key, { hex }]) => (
                  <button
                    key={key}
                    title={key}
                    onClick={() => { onHighlight?.(selectedCfi, key); onClearSelection?.(); }}
                    className="flex-shrink-0 rounded-full border-2 transition-transform hover:scale-110 active:scale-95"
                    style={{ width: 30, height: 30, background: hex, borderColor: 'rgba(255,255,255,0.28)', cursor: 'pointer' }}
                  />
                ))}
              </div>
              <button
                onClick={onClearSelection}
                style={{ color: 'var(--color-faint)', flexShrink: 0, padding: 4, cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <X size={17} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Settings panel (right) ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 304 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 304 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute right-0 z-20 overflow-y-auto"
            style={{ width: 304, top: TOP_H, bottom: BOT_H, background: 'var(--color-surface)', borderLeft: BORDER }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
              <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Reading Settings</p>
              <button
                onClick={() => setShowSettings(false)}
                style={{ color: 'var(--color-faint)', padding: 6, cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-7">
              <SettingGroup label="Theme">
                <div className="grid grid-cols-3 gap-2.5">
                  {([
                    { id: 'dark'  as ReaderTheme, label: 'Dark',  icon: <Moon size={15} />,   bg: '#0a0a0f', fg: '#e8e0d0' },
                    { id: 'light' as ReaderTheme, label: 'Light', icon: <Sun size={15} />,    bg: '#f8f5ef', fg: '#1a1612' },
                    { id: 'sepia' as ReaderTheme, label: 'Sepia', icon: <Coffee size={15} />, bg: '#f4e8c1', fg: '#3a2e1a' },
                  ]).map(t => (
                    <button key={t.id} onClick={() => onSettingsChange({ theme: t.id })}
                      className="flex flex-col items-center gap-2 py-4 px-2"
                      style={{
                        borderRadius: '7px',
                        border: settings.theme === t.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: settings.theme === t.id ? 'var(--color-accent-bg)' : 'var(--color-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="w-11 h-7 flex items-center justify-center"
                        style={{ background: t.bg, borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)' }}>
                        <span style={{ color: t.fg }}>{t.icon}</span>
                      </div>
                      <span className="text-xs font-semibold"
                        style={{ color: settings.theme === t.id ? 'var(--color-accent-soft)' : 'var(--color-muted)' }}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup label="Typeface">
                <div className="grid grid-cols-3 gap-2.5">
                  {([
                    { id: 'serif' as ReaderFont, label: 'Serif', style: 'Georgia,serif' },
                    { id: 'sans'  as ReaderFont, label: 'Sans',  style: 'system-ui,sans-serif' },
                    { id: 'mono'  as ReaderFont, label: 'Mono',  style: 'monospace' },
                  ]).map(f => (
                    <button key={f.id} onClick={() => onSettingsChange({ font: f.id })}
                      className="py-3 text-sm font-medium"
                      style={{
                        fontFamily: f.style,
                        borderRadius: '7px',
                        border: settings.font === f.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: settings.font === f.id ? 'var(--color-accent-bg)' : 'var(--color-card)',
                        color: settings.font === f.id ? 'var(--color-accent-soft)' : 'var(--color-muted)',
                        cursor: 'pointer',
                      }}
                    >{f.label}</button>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup label="Font Size" value={`${settings.fontSize}px`}>
                <input type="range" min={12} max={32} value={settings.fontSize}
                  onChange={e => onSettingsChange({ fontSize: Number(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              </SettingGroup>

              <SettingGroup label="Line Spacing" value={settings.lineHeight.toFixed(1)}>
                <input type="range" min={1.2} max={2.4} step={0.1} value={settings.lineHeight}
                  onChange={e => onSettingsChange({ lineHeight: Number(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              </SettingGroup>

              <SettingGroup label="Margins" value={`${settings.margins}px`}>
                <input type="range" min={20} max={160} step={10} value={settings.margins}
                  onChange={e => onSettingsChange({ margins: Number(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              </SettingGroup>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left panel (TOC / Search / Annotations) ── */}
      <AnimatePresence>
        {leftPanel !== 'none' && (
          <motion.div
            initial={{ opacity: 0, x: -308 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -308 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute left-0 z-20 flex flex-col"
            style={{ width: 308, top: TOP_H, bottom: BOT_H, background: 'var(--color-surface)', borderRight: BORDER }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header with tab switcher */}
            <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: BORDER }}>
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
              <button
                onClick={() => setLeftPanel('none')}
                style={{ color: 'var(--color-faint)', padding: 6, cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* TOC */}
            {leftPanel === 'toc' && (
              <div className="flex-1 overflow-y-auto py-2">
                {toc.map(item => (
                  <TocEntry key={item.id} item={item} depth={0}
                    onNavigate={href => { onTocNavigate?.(href); setLeftPanel('none'); }} />
                ))}
              </div>
            )}

            {/* Search */}
            {leftPanel === 'search' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: BORDER }}>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--color-faint)' }} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search in book…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%', paddingLeft: 40, paddingRight: 12,
                        paddingTop: 10, paddingBottom: 10,
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '7px',
                        color: 'var(--color-text)',
                        fontSize: 14,
                        outline: 'none',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--color-accent-dim)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {isSearching && (
                    <div className="flex justify-center py-10">
                      <Loader size={22} className="animate-spin" style={{ color: 'var(--color-faint)' }} />
                    </div>
                  )}
                  {!isSearching && searchQuery && searchResults.length === 0 && (
                    <p className="text-sm text-center py-10" style={{ color: 'var(--color-faint)' }}>No results</p>
                  )}
                  {!isSearching && searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { onTocNavigate?.(r.cfi); setLeftPanel('none'); }}
                      className="w-full text-left px-5 py-4 text-sm"
                      style={{
                        color: 'var(--color-muted)', background: 'transparent',
                        border: 'none', borderBottom: BORDER,
                        cursor: 'pointer', lineHeight: 1.55,
                        display: 'block',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
                      }}
                    >
                      {stripHtml(r.excerpt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Annotations */}
            {leftPanel === 'annotations' && (
              <div className="flex-1 overflow-y-auto">
                {annotations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                    <Bookmark size={34} style={{ color: 'var(--color-faint)' }} />
                    <p className="text-sm text-center" style={{ color: 'var(--color-faint)' }}>
                      Select text while reading to add a highlight
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {annotations.map(ann => (
                      <div
                        key={ann.id}
                        className="px-5 py-4 flex items-start gap-3 cursor-pointer"
                        style={{ borderBottom: BORDER }}
                        onClick={() => { onTocNavigate?.(ann.cfiRange); setLeftPanel('none'); }}
                        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--color-card)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                      >
                        <div
                          className="flex-shrink-0 mt-1 rounded-full"
                          style={{ width: 12, height: 12, background: HIGHLIGHT_COLORS[ann.color]?.hex ?? '#FFD700' }}
                        />
                        <p className="flex-1 text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--color-muted)' }}>
                          "{ann.quote}"
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveAnnotation?.(ann); }}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: 'var(--color-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-red)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-faint)')}
                          title="Remove highlight"
                        >
                          <Trash2 size={15} />
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

/* ── Sub-components ── */

function ControlBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        width: 44, height: 44, flexShrink: 0,
        borderRadius: '7px', border: 'none',
        background: active ? 'var(--color-accent-bg)' : 'transparent',
        color: active ? 'var(--color-accent-soft)' : 'var(--color-muted)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; }}
    >
      {children}
    </button>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-semibold"
      style={{
        borderRadius: '6px', padding: '8px 12px',
        background: active ? 'var(--color-accent-bg)' : 'transparent',
        color: active ? 'var(--color-accent-soft)' : 'var(--color-faint)',
        border: 'none', cursor: 'pointer', minHeight: 38,
      }}
    >
      {children}
    </button>
  );
}

function SettingGroup({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{label}</p>
        {value && <span className="text-sm" style={{ color: 'var(--color-faint)' }}>{value}</span>}
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
        className="w-full text-left text-sm truncate"
        style={{
          paddingLeft: `${20 + depth * 16}px`, paddingRight: 20,
          paddingTop: 14, paddingBottom: 14,
          color: 'var(--color-muted)', background: 'transparent',
          border: 'none', cursor: 'pointer', minHeight: 48, display: 'block',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        {item.label}
      </button>
      {item.subitems?.map(sub => (
        <TocEntry key={sub.id} item={sub} depth={depth + 1} onNavigate={onNavigate} />
      ))}
    </>
  );
}
