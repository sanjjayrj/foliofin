import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sun, Moon, Coffee, Type,
  ChevronLeft, ChevronRight, List, X, Check
} from 'lucide-react';
import { clsx } from 'clsx';
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
  onBack: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSettingsChange: (s: Partial<ReaderSettings>) => void;
  onTocNavigate?: (href: string) => void;
}

export default function ReaderControls({
  title,
  author,
  currentPage,
  totalPages,
  progress,
  settings,
  toc = [],
  onBack,
  onPrevPage,
  onNextPage,
  onSettingsChange,
  onTocNavigate,
}: ReaderControlsProps) {
  const [showTopBar, setShowTopBar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);

  const themes: { id: ReaderTheme; icon: React.ReactNode; bg: string }[] = [
    { id: 'dark', icon: <Moon size={14} />, bg: '#0a0a0f' },
    { id: 'light', icon: <Sun size={14} />, bg: '#f5f5e8' },
    { id: 'sepia', icon: <Coffee size={14} />, bg: '#f4e8c1' },
  ];

  const fonts: { id: ReaderFont; label: string }[] = [
    { id: 'serif', label: 'Serif' },
    { id: 'sans', label: 'Sans' },
    { id: 'mono', label: 'Mono' },
  ];

  return (
    <>
      {/* Click overlay to toggle bars */}
      <div
        className="absolute inset-0 z-0"
        onClick={() => {
          setShowTopBar((v) => !v);
          if (!showTopBar) {
            setShowSettings(false);
            setShowToc(false);
          }
        }}
      />

      {/* Top bar */}
      <AnimatePresence>
        {showTopBar && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-5 py-3 bg-[#0f0f1a]/95 backdrop-blur-sm border-b border-[#1c1c2e]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onBack}
              className="p-2 rounded-[8px] text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32] transition-all"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#f0f0ff] truncate">{title}</p>
              {author && <p className="text-xs text-[#9898b8] truncate">{author}</p>}
            </div>

            <div className="flex items-center gap-1">
              {toc.length > 0 && (
                <button
                  onClick={() => { setShowToc((v) => !v); setShowSettings(false); }}
                  className={clsx('p-2 rounded-[8px] transition-all', showToc ? 'bg-[#7c3aed]/20 text-[#a78bfa]' : 'text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32]')}
                >
                  <List size={18} />
                </button>
              )}
              <button
                onClick={() => { setShowSettings((v) => !v); setShowToc(false); }}
                className={clsx('p-2 rounded-[8px] transition-all', showSettings ? 'bg-[#7c3aed]/20 text-[#a78bfa]' : 'text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32]')}
              >
                <Type size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <AnimatePresence>
        {showTopBar && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-4 px-5 py-3 bg-[#0f0f1a]/95 backdrop-blur-sm border-t border-[#1c1c2e]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onPrevPage}
              className="p-2 rounded-[8px] text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32] transition-all"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex-1 flex flex-col gap-1">
              <div className="h-1 bg-[#2a2a42] rounded-full overflow-hidden">
                <motion.div
                  className="h-full progress-bar rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#5a5a7a]">
                <span>{Math.round(progress)}%</span>
                {currentPage != null && totalPages != null && (
                  <span>{currentPage} / {totalPages}</span>
                )}
              </div>
            </div>

            <button
              onClick={onNextPage}
              className="p-2 rounded-[8px] text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32] transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-14 right-0 bottom-12 z-20 w-72 bg-[#0f0f1a] border-l border-[#1c1c2e] p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-[#f0f0ff]">Reading Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-[#5a5a7a] hover:text-[#f0f0ff]">
                <X size={16} />
              </button>
            </div>

            {/* Theme */}
            <div className="space-y-2 mb-5">
              <p className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Theme</p>
              <div className="flex gap-2">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSettingsChange({ theme: t.id })}
                    className={clsx(
                      'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-[10px] border transition-all',
                      settings.theme === t.id
                        ? 'border-[#7c3aed] bg-[#7c3aed]/10'
                        : 'border-[#2a2a42] hover:border-[#3a3a52]'
                    )}
                  >
                    <div
                      className="w-8 h-6 rounded-[4px] border border-[#3a3a52] flex items-center justify-center"
                      style={{ background: t.bg }}
                    >
                      <span className={t.id === 'dark' ? 'text-white/60' : 'text-black/40'}>
                        {t.icon}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9898b8] capitalize">{t.id}</span>
                    {settings.theme === t.id && (
                      <Check size={10} className="text-[#7c3aed]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div className="space-y-2 mb-5">
              <p className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Font</p>
              <div className="flex gap-2">
                {fonts.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onSettingsChange({ font: f.id })}
                    className={clsx(
                      'flex-1 py-2 rounded-[8px] text-xs border transition-all',
                      settings.font === f.id
                        ? 'border-[#7c3aed] bg-[#7c3aed]/10 text-[#a78bfa]'
                        : 'border-[#2a2a42] text-[#9898b8] hover:border-[#3a3a52]'
                    )}
                    style={{ fontFamily: f.id === 'serif' ? 'Georgia,serif' : f.id === 'mono' ? 'monospace' : 'system-ui,sans-serif' }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Font Size</p>
                <span className="text-xs text-[#5a5a7a]">{settings.fontSize}px</span>
              </div>
              <input
                type="range"
                min={12}
                max={32}
                value={settings.fontSize}
                onChange={(e) => onSettingsChange({ fontSize: Number(e.target.value) })}
                className="w-full accent-[#7c3aed]"
              />
            </div>

            {/* Line height */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Line Spacing</p>
                <span className="text-xs text-[#5a5a7a]">{settings.lineHeight.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={1.2}
                max={2.4}
                step={0.1}
                value={settings.lineHeight}
                onChange={(e) => onSettingsChange({ lineHeight: Number(e.target.value) })}
                className="w-full accent-[#7c3aed]"
              />
            </div>

            {/* Margins */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Margins</p>
                <span className="text-xs text-[#5a5a7a]">{settings.margins}px</span>
              </div>
              <input
                type="range"
                min={20}
                max={160}
                step={10}
                value={settings.margins}
                onChange={(e) => onSettingsChange({ margins: Number(e.target.value) })}
                className="w-full accent-[#7c3aed]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOC panel */}
      <AnimatePresence>
        {showToc && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-14 left-0 bottom-12 z-20 w-72 bg-[#0f0f1a] border-r border-[#1c1c2e] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#1c1c2e]">
              <h3 className="text-sm font-semibold text-[#f0f0ff]">Contents</h3>
              <button onClick={() => setShowToc(false)} className="text-[#5a5a7a] hover:text-[#f0f0ff]">
                <X size={16} />
              </button>
            </div>
            <div className="py-2">
              {toc.map((item) => (
                <TocEntry
                  key={item.id}
                  item={item}
                  depth={0}
                  onNavigate={(href) => {
                    onTocNavigate?.(href);
                    setShowToc(false);
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TocEntry({
  item,
  depth,
  onNavigate,
}: {
  item: TocItem;
  depth: number;
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      <button
        onClick={() => onNavigate(item.href)}
        className="w-full text-left px-4 py-2 text-sm text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32] transition-colors truncate"
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        {item.label}
      </button>
      {item.subitems?.map((sub) => (
        <TocEntry key={sub.id} item={sub} depth={depth + 1} onNavigate={onNavigate} />
      ))}
    </>
  );
}
