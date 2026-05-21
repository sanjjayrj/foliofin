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
  selectedPosition?: { x: number; y: number } | null;
  onBack: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSettingsChange: (s: Partial<ReaderSettings>) => void;
  onTocNavigate?: (href: string) => void;
  onSearchNavigate?: (cfi: string) => void;
  onHighlight?: (cfi: string, color: string) => void;
  onClearSelection?: () => void;
  onRemoveAnnotation?: (ann: Annotation) => void;
  onSearch?: SearchFn;
}

type LeftPanel = 'none' | 'toc' | 'annotations' | 'search';

const BAR_BG    = 'rgba(14, 13, 15, 0.94)';
const BORDER    = '1px solid rgba(60, 55, 68, 0.85)';
const RADIUS    = 14;
const INS       = 10;
const TOP_H     = 64;
const BOT_H     = 80;
const PANEL_TOP = INS + TOP_H + 6;   // 80
const PANEL_BOT = INS + BOT_H + 6;   // 96
const PANEL_W   = 310;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export default function ReaderControls({
  title, author, currentPage, totalPages, progress,
  settings, toc = [], isOffline, annotations = [],
  selectedCfi, selectedPosition,
  onBack, onPrevPage, onNextPage,
  onSettingsChange, onTocNavigate, onSearchNavigate,
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

  const hideControls = () => { setVisible(false); setShowSettings(false); setLeftPanel('none'); };
  const toggleLeft   = (p: LeftPanel) => setLeftPanel(cur => cur === p ? 'none' : p);

  // Ensure bars are visible whenever the user has an active text selection so the
  // mini-toolbar and bar controls are both accessible.
  const hasSelection = Boolean(selectedCfi);
  useEffect(() => {
    if (selectedCfi) setVisible(true);
  }, [selectedCfi]);

  // Focus the search input when the search panel opens.
  useEffect(() => {
    if (leftPanel === 'search') {
      const t = setTimeout(() => searchInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [leftPanel]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !onSearch) { setSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await onSearch(searchQuery.trim());
        setSearchResults(res.slice(0, 60));
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, onSearch]);

  return (
    <>
      {/* ── Navigation tap strips (left = prev, right = next).
           Rendered only when bars are hidden and no text is selected. ── */}
      {!visible && !hasSelection && (
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

      {/* ── Floating "show controls" button (bars hidden, no selection) ── */}
      {!visible && !hasSelection && (
        <button
          onClick={() => setVisible(true)}
          className="absolute flex items-center justify-center"
          style={{
            top: INS + 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 15, width: 44, height: 44,
            background: 'rgba(14,13,15,0.78)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 22,
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
            initial={{ opacity: 0, y: -(TOP_H + INS) }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -(TOP_H + INS) }}
            transition={{ duration: 0.18 }}
            className="absolute flex items-center gap-2"
            style={{
              top: INS, left: INS, right: INS, height: TOP_H,
              zIndex: 10, paddingLeft: 8, paddingRight: 8,
              background: BAR_BG, border: BORDER,
              borderRadius: RADIUS, backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Back */}
            <button
              onClick={onBack}
              className="flex items-center gap-2 font-medium flex-shrink-0"
              style={{
                color: 'var(--color-muted)', borderRadius: 8,
                border: 'none', background: 'transparent',
                fontSize: 15, height: 44, padding: '0 12px',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)')}
            >
              <ArrowLeft size={18} /><span>Library</span>
            </button>

            {/* Title + author */}
            <div className="flex-1 min-w-0 px-2 flex items-center gap-3 overflow-hidden">
              <div className="min-w-0">
                <p className="text-base font-semibold truncate leading-snug" style={{ color: 'var(--color-text)' }}>{title}</p>
                {author && <p className="text-sm truncate leading-snug" style={{ color: 'var(--color-muted)' }}>{author}</p>}
              </div>
              {isOffline !== undefined && (
                <span
                  className="flex items-center gap-1.5 font-semibold flex-shrink-0"
                  style={{
                    fontSize: 12,
                    background: isOffline ? 'rgba(90,158,111,0.15)' : 'rgba(91,133,184,0.15)',
                    border: `1px solid ${isOffline ? 'rgba(90,158,111,0.3)' : 'rgba(91,133,184,0.3)'}`,
                    borderRadius: 5, padding: '4px 9px',
                    color: isOffline ? 'var(--color-green)' : 'var(--color-blue)',
                  }}
                >
                  {isOffline ? <HardDrive size={11} /> : <Wifi size={11} />}
                  {isOffline ? 'Offline' : 'Streaming'}
                </span>
              )}
            </div>

            {/* Right icon buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {onSearch && (
                <CtrlBtn active={leftPanel === 'search'} onClick={() => { toggleLeft('search'); setShowSettings(false); }}>
                  <Search size={19} />
                </CtrlBtn>
              )}
              <CtrlBtn active={leftPanel === 'annotations'} onClick={() => { toggleLeft('annotations'); setShowSettings(false); }}>
                <Bookmark size={19} />
              </CtrlBtn>
              {toc.length > 0 && (
                <CtrlBtn active={leftPanel === 'toc'} onClick={() => { toggleLeft('toc'); setShowSettings(false); }}>
                  <List size={19} />
                </CtrlBtn>
              )}
              <CtrlBtn active={showSettings} onClick={() => { setShowSettings(v => !v); setLeftPanel('none'); }}>
                <Type size={19} />
              </CtrlBtn>
              <CtrlBtn active={false} onClick={hideControls}>
                <X size={19} />
              </CtrlBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar ── */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: BOT_H + INS }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: BOT_H + INS }}
            transition={{ duration: 0.18 }}
            className="absolute flex items-center gap-4"
            style={{
              bottom: INS, left: INS, right: INS, height: BOT_H,
              zIndex: 10, paddingLeft: 20, paddingRight: 20,
              background: BAR_BG, border: BORDER,
              borderRadius: RADIUS, backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onPrevPage}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                color: 'var(--color-muted)', borderRadius: 9,
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
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                  animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex justify-between" style={{ fontSize: 13, color: 'var(--color-faint)' }}>
                <span>{Math.round(Math.max(0, Math.min(100, progress)))}%</span>
                {currentPage != null && totalPages != null && (
                  <span>Page {currentPage} / {totalPages}</span>
                )}
              </div>
            </div>

            <button
              onClick={onNextPage}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                color: 'var(--color-accent-soft)', borderRadius: 9,
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

      {/* ── Settings panel ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: PANEL_W + INS }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: PANEL_W + INS }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute overflow-y-auto"
            style={{
              top: PANEL_TOP, bottom: PANEL_BOT,
              right: INS, width: PANEL_W,
              zIndex: 20,
              background: 'var(--color-surface)',
              border: BORDER,
              borderRadius: RADIUS,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: BORDER }}>
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
                      className="flex flex-col items-center gap-2 py-4"
                      style={{
                        borderRadius: 8,
                        border: settings.theme === t.id ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: settings.theme === t.id ? 'var(--color-accent-bg)' : 'var(--color-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="w-11 h-7 flex items-center justify-center"
                        style={{ background: t.bg, borderRadius: 4, border: '1px solid rgba(128,128,128,0.2)' }}>
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
                        fontFamily: f.style, borderRadius: 8,
                        border: settings.font === f.id ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
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

      {/* ── Always-visible slim progress strip at the bottom edge ── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: 3, background: 'rgba(255,255,255,0.06)', zIndex: 6 }}
      >
        <motion.div
          className="h-full"
          style={{ background: 'var(--color-accent)', opacity: 0.7 }}
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* ── Floating mini highlight toolbar (appears near the selection) ── */}
      {selectedCfi && (
        <div
          className="fixed flex items-center gap-1.5 px-3 py-2"
          style={{
            left: selectedPosition
              ? Math.max(100, Math.min(window.innerWidth - 100, selectedPosition.x))
              : Math.round(window.innerWidth * 0.62),
            top: selectedPosition
              ? Math.max(INS + TOP_H + 12, selectedPosition.y - 54)
              : Math.round(window.innerHeight * 0.36),
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(14,13,15,0.96)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 12,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
            pointerEvents: 'auto',
          }}
        >
          {/* Down-pointing caret — only when positioned near actual selection */}
          {selectedPosition && (
            <div
              className="absolute"
              style={{
                bottom: -7, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '7px solid rgba(14,13,15,0.96)',
              }}
            />
          )}
          {Object.entries(HIGHLIGHT_COLORS).map(([key, { hex }]) => (
            <button
              key={key}
              title={`Highlight ${key}`}
              onClick={() => onHighlight?.(selectedCfi!, key)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: hex,
                border: '2.5px solid rgba(255,255,255,0.3)',
                cursor: 'pointer', flexShrink: 0,
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.18)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
            />
          ))}
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', margin: '0 4px', flexShrink: 0 }} />
          <button
            onClick={onClearSelection}
            title="Dismiss"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 7,
              color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none',
              cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Left panel: TOC / Search / Annotations ── */}
      <AnimatePresence>
        {leftPanel !== 'none' && (
          <motion.div
            initial={{ opacity: 0, x: -(PANEL_W + INS) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -(PANEL_W + INS) }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute flex flex-col overflow-hidden"
            style={{
              top: PANEL_TOP, bottom: PANEL_BOT,
              left: INS, width: PANEL_W,
              zIndex: 20,
              background: 'var(--color-surface)',
              border: BORDER,
              borderRadius: RADIUS,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Tab header */}
            <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0" style={{ borderBottom: BORDER }}>
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

            {/* TOC tab */}
            {leftPanel === 'toc' && (
              <div className="flex-1 overflow-y-auto py-1">
                {toc.map(item => (
                  <TocEntry key={item.id} item={item} depth={0}
                    onNavigate={href => { onTocNavigate?.(href); setLeftPanel('none'); }} />
                ))}
              </div>
            )}

            {/* Search tab */}
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
                        paddingTop: 11, paddingBottom: 11,
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
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
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <Loader size={22} className="animate-spin" style={{ color: 'var(--color-faint)' }} />
                      <p className="text-xs" style={{ color: 'var(--color-faint)' }}>Searching…</p>
                    </div>
                  )}
                  {!isSearching && searchQuery && searchResults.length === 0 && (
                    <p className="text-sm text-center py-10" style={{ color: 'var(--color-faint)' }}>No results found</p>
                  )}
                  {!isSearching && !searchQuery && (
                    <p className="text-sm text-center py-10" style={{ color: 'var(--color-faint)' }}>Type to search</p>
                  )}
                  {!isSearching && searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { (onSearchNavigate ?? onTocNavigate)?.(r.cfi); setLeftPanel('none'); }}
                      className="w-full text-left px-5 py-4 text-sm"
                      style={{
                        color: 'var(--color-muted)', background: 'transparent',
                        border: 'none', borderBottom: BORDER,
                        cursor: 'pointer', lineHeight: 1.6, display: 'block',
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

            {/* Annotations tab */}
            {leftPanel === 'annotations' && (
              <div className="flex-1 overflow-y-auto">
                {annotations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                    <Bookmark size={34} style={{ color: 'var(--color-faint)' }} />
                    <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--color-faint)' }}>
                      Select text while reading to add a highlight
                    </p>
                  </div>
                ) : (
                  <div className="py-1">
                    {annotations.map(ann => (
                      <div
                        key={ann.id}
                        className="px-5 py-4 flex items-start gap-3 cursor-pointer"
                        style={{ borderBottom: BORDER }}
                        onClick={() => { onTocNavigate?.(ann.cfiRange); setLeftPanel('none'); }}
                        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--color-card)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                      >
                        <div className="flex-shrink-0 mt-1 rounded-full"
                          style={{ width: 12, height: 12, background: HIGHLIGHT_COLORS[ann.color]?.hex ?? '#FFD700' }} />
                        <p className="flex-1 text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--color-muted)' }}>
                          "{ann.quote}"
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveAnnotation?.(ann); }}
                          style={{ color: 'var(--color-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
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

/* ── Shared sub-components ── */

function CtrlBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: 44, height: 44,
        borderRadius: 7, border: 'none',
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
        borderRadius: 7, padding: '8px 12px', minHeight: 38,
        background: active ? 'var(--color-accent-bg)' : 'transparent',
        color: active ? 'var(--color-accent-soft)' : 'var(--color-faint)',
        border: 'none', cursor: 'pointer',
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
          paddingLeft: 20 + depth * 16, paddingRight: 20,
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
