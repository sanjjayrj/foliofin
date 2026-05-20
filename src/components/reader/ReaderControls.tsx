import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Sun, Moon, Coffee, Type,
  ChevronLeft, ChevronRight, List, X, HardDrive, Wifi
} from 'lucide-react';
import type { ReaderSettings, ReaderTheme, ReaderFont } from '../../types/jellyfin';

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
  onBack: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSettingsChange: (s: Partial<ReaderSettings>) => void;
  onTocNavigate?: (href: string) => void;
}

const BAR_BG = 'rgba(14, 13, 15, 0.92)';
const BORDER = '1px solid rgba(44, 41, 48, 0.8)';

export default function ReaderControls({
  title, author, currentPage, totalPages, progress,
  settings, toc = [], isOffline, onBack, onPrevPage, onNextPage,
  onSettingsChange, onTocNavigate,
}: ReaderControlsProps) {
  const [visible, setVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);

  return (
    <>
      {/* Click-through layer */}
      <div
        className="absolute inset-0 z-0"
        onClick={() => {
          setVisible((v) => !v);
          if (!visible) { setShowSettings(false); setShowToc(false); }
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
              style={{
                color: 'var(--color-muted)',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)')}
            >
              <ArrowLeft size={16} />
              <span>Library</span>
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
              {toc.length > 0 && (
                <ControlBtn
                  active={showToc}
                  onClick={() => { setShowToc((v) => !v); setShowSettings(false); }}
                >
                  <List size={17} />
                </ControlBtn>
              )}
              <ControlBtn
                active={showSettings}
                onClick={() => { setShowSettings((v) => !v); setShowToc(false); }}
              >
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
              style={{
                color: 'var(--color-muted)',
                borderRadius: '7px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-card)',
                width: 44,
                height: 44,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-raised)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
              }}
            >
              <ChevronLeft size={22} />
            </button>

            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <motion.div
                  className="h-full"
                  style={{ background: 'var(--color-accent)', borderRadius: '1px' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="flex justify-between" style={{ fontSize: 11, color: 'var(--color-faint)' }}>
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
                color: 'var(--color-accent-soft)',
                borderRadius: '7px',
                border: '1px solid var(--color-accent-dim)',
                background: 'var(--color-accent-bg)',
                width: 44,
                height: 44,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,146,42,0.22)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-bg)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)';
              }}
            >
              <ChevronRight size={22} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings panel ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute top-14 right-0 bottom-12 z-20 overflow-y-auto"
            style={{
              width: 264,
              background: 'var(--color-surface)',
              borderLeft: BORDER,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Reading</p>
              <button onClick={() => setShowSettings(false)} style={{ color: 'var(--color-faint)' }}>
                <X size={15} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-6">
              {/* Theme */}
              <SettingGroup label="Theme">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'dark' as ReaderTheme, label: 'Dark', icon: <Moon size={13} />, bg: '#0a0a0f', fg: '#e8e0d0' },
                    { id: 'light' as ReaderTheme, label: 'Light', icon: <Sun size={13} />, bg: '#f8f5ef', fg: '#1a1612' },
                    { id: 'sepia' as ReaderTheme, label: 'Sepia', icon: <Coffee size={13} />, bg: '#f4e8c1', fg: '#3a2e1a' },
                  ]).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onSettingsChange({ theme: t.id })}
                      className="flex flex-col items-center gap-1.5 py-3 px-2"
                      style={{
                        borderRadius: '5px',
                        border: settings.theme === t.id
                          ? '1px solid var(--color-accent)'
                          : '1px solid var(--color-border)',
                        background: settings.theme === t.id ? 'var(--color-accent-bg)' : 'var(--color-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        className="w-10 h-6 flex items-center justify-center"
                        style={{ background: t.bg, borderRadius: '3px', border: '1px solid rgba(128,128,128,0.2)' }}
                      >
                        <span style={{ color: t.fg }}>{t.icon}</span>
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: settings.theme === t.id ? 'var(--color-accent-soft)' : 'var(--color-muted)' }}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </SettingGroup>

              {/* Font */}
              <SettingGroup label="Typeface">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'serif' as ReaderFont, label: 'Serif', style: 'Georgia,serif' },
                    { id: 'sans' as ReaderFont, label: 'Sans', style: 'system-ui,sans-serif' },
                    { id: 'mono' as ReaderFont, label: 'Mono', style: 'monospace' },
                  ]).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onSettingsChange({ font: f.id })}
                      className="py-2.5 text-xs"
                      style={{
                        fontFamily: f.style,
                        borderRadius: '5px',
                        border: settings.font === f.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: settings.font === f.id ? 'var(--color-accent-bg)' : 'var(--color-card)',
                        color: settings.font === f.id ? 'var(--color-accent-soft)' : 'var(--color-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </SettingGroup>

              {/* Font size */}
              <SettingGroup label="Size" value={`${settings.fontSize}px`}>
                <input type="range" min={12} max={32} value={settings.fontSize}
                  onChange={(e) => onSettingsChange({ fontSize: Number(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                />
              </SettingGroup>

              {/* Line spacing */}
              <SettingGroup label="Line Spacing" value={settings.lineHeight.toFixed(1)}>
                <input type="range" min={1.2} max={2.4} step={0.1} value={settings.lineHeight}
                  onChange={(e) => onSettingsChange({ lineHeight: Number(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                />
              </SettingGroup>

              {/* Margins */}
              <SettingGroup label="Margins" value={`${settings.margins}px`}>
                <input type="range" min={20} max={160} step={10} value={settings.margins}
                  onChange={(e) => onSettingsChange({ margins: Number(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                />
              </SettingGroup>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOC panel ── */}
      <AnimatePresence>
        {showToc && (
          <motion.div
            initial={{ opacity: 0, x: -280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute top-14 left-0 bottom-12 z-20 overflow-y-auto"
            style={{
              width: 264,
              background: 'var(--color-surface)',
              borderRight: BORDER,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Contents</p>
              <button onClick={() => setShowToc(false)} style={{ color: 'var(--color-faint)' }}>
                <X size={15} />
              </button>
            </div>
            <div className="py-2">
              {toc.map((item) => (
                <TocEntry
                  key={item.id}
                  item={item}
                  depth={0}
                  onNavigate={(href) => { onTocNavigate?.(href); setShowToc(false); }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ControlBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2"
      style={{
        borderRadius: '4px',
        border: 'none',
        background: active ? 'var(--color-accent-bg)' : 'transparent',
        color: active ? 'var(--color-accent-soft)' : 'var(--color-muted)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; }}
    >
      {children}
    </button>
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
        style={{
          paddingLeft: `${20 + depth * 16}px`,
          paddingRight: '20px',
          color: 'var(--color-muted)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        {item.label}
      </button>
      {item.subitems?.map((sub) => (
        <TocEntry key={sub.id} item={sub} depth={depth + 1} onNavigate={onNavigate} />
      ))}
    </>
  );
}
