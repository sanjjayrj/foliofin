import { AnimatePresence, motion } from 'framer-motion';
import {
  Library, Settings, LogOut, ChevronLeft, ChevronRight,
  BookOpen, HardDrive, Clock,
} from 'lucide-react';
import { useAppStore } from '../../store';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  const {
    config, libraries, activeLibraryId, setActiveLibraryId,
    sidebarCollapsed, setSidebarCollapsed, clearConfig,
  } = useAppStore();

  const downloadCount   = useAppStore(s => Object.keys(s.downloads).length);
  const totalBytes      = useAppStore(s =>
    Object.values(s.downloads).reduce((sum, d) => sum + d.fileSize, 0)
  );
  const inProgressCount = useAppStore(s =>
    Object.values(s.progress).filter(p => p.percentage > 1 && p.percentage < 98).length
  );

  const bookLibraries = libraries.filter(
    l => !l.CollectionType || l.CollectionType === 'books'
  );

  const handleLibraryClick = (id: string) => {
    setActiveLibraryId(id);
    onNavigate('library');
  };

  const handleLogout = () => {
    if (confirm('Sign out of FolioFin?')) clearConfig();
  };

  const userInitial = config?.userName?.charAt(0).toUpperCase() ?? '?';

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 76 : 288 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-full flex-shrink-0 overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border-soft)',
      }}
    >
      {/* ── Logo / Brand ── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--color-border-soft)',
          minHeight: 88,
          padding: sidebarCollapsed ? '24px 0' : '24px 24px',
          gap: sidebarCollapsed ? 0 : 14,
          justifyContent: sidebarCollapsed ? 'center' : undefined,
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, var(--color-accent-dim), var(--color-accent))',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(212,146,42,0.28)',
          }}
        >
          <BookOpen size={20} style={{ color: '#1a1208' }} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.12 }}
            >
              <p className="text-base font-bold leading-none" style={{ color: 'var(--color-text)' }}>
                FolioFin
              </p>
              <p className="text-xs mt-1 leading-none" style={{ color: 'var(--color-faint)' }}>
                Jellyfin Reader
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-5">

        {/* Libraries section */}
        <div className="flex flex-col gap-0.5">
          <AnimatePresence>
            {!sidebarCollapsed && bookLibraries.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-bold uppercase tracking-widest pb-2"
                style={{ color: 'var(--color-faint)', paddingLeft: 26 }}
              >
                Libraries
              </motion.p>
            )}
          </AnimatePresence>

          {bookLibraries.length > 0
            ? bookLibraries.map(lib => (
                <NavItem
                  key={lib.ItemId}
                  icon={<Library size={20} />}
                  label={lib.Name}
                  active={activeLibraryId === lib.ItemId && activeScreen === 'library'}
                  collapsed={sidebarCollapsed}
                  onClick={() => handleLibraryClick(lib.ItemId)}
                />
              ))
            : (
              <NavItem
                icon={<Library size={20} />}
                label="Library"
                active={activeScreen === 'library'}
                collapsed={sidebarCollapsed}
                onClick={() => onNavigate('library')}
              />
            )
          }
        </div>

        {/* Collection section */}
        <div className="flex flex-col gap-0.5">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-bold uppercase tracking-widest pb-2"
                style={{ color: 'var(--color-faint)', paddingLeft: 26 }}
              >
                Collection
              </motion.p>
            )}
          </AnimatePresence>

          {inProgressCount > 0 && (
            <NavItem
              icon={<Clock size={20} />}
              label="In Progress"
              badge={inProgressCount}
              active={false}
              collapsed={sidebarCollapsed}
              onClick={() => onNavigate('library')}
            />
          )}

          <NavItem
            icon={<HardDrive size={20} />}
            label="Downloads"
            badge={downloadCount > 0 ? downloadCount : undefined}
            active={activeScreen === 'downloads'}
            collapsed={sidebarCollapsed}
            onClick={() => onNavigate('downloads')}
          />
        </div>
      </nav>

      {/* ── Bottom nav ── */}
      <div
        className="py-4 flex flex-col gap-0.5 flex-shrink-0"
        style={{ borderTop: '1px solid var(--color-border-soft)' }}
      >
        <NavItem
          icon={<Settings size={20} />}
          label="Settings"
          active={activeScreen === 'settings'}
          collapsed={sidebarCollapsed}
          onClick={() => onNavigate('settings')}
        />
        <NavItem
          icon={<LogOut size={20} />}
          label="Sign Out"
          active={false}
          collapsed={sidebarCollapsed}
          onClick={handleLogout}
          danger
        />
      </div>

      {/* ── User info (expanded) ── */}
      <AnimatePresence>
        {!sidebarCollapsed && config && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-shrink-0"
            style={{ borderTop: '1px solid var(--color-border-soft)', padding: '8px 10px' }}
          >
            {/* Pill card — matches nav item margin / floating aesthetic */}
            <div
              className="flex items-center gap-3"
              style={{
                padding: '10px 14px',
                background: 'var(--color-raised)',
                border: '1px solid var(--color-border-soft)',
                borderRadius: 12,
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{
                  width: 30, height: 30,
                  background: 'var(--color-accent-bg)',
                  border: '1px solid rgba(212,146,42,0.3)',
                  borderRadius: '50%',
                  color: 'var(--color-accent)',
                }}
              >
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-none" style={{ color: 'var(--color-text)' }}>
                  {config.userName}
                </p>
                <p className="text-xs truncate mt-1 leading-none" style={{ color: 'var(--color-faint)' }}>
                  {config.serverUrl.replace(/^https?:\/\//, '')}
                </p>
                {downloadCount > 0 && (
                  <p className="text-xs mt-1 leading-none" style={{ color: 'var(--color-green)' }}>
                    {downloadCount} book{downloadCount !== 1 ? 's' : ''} on device
                    {totalBytes > 0 && ` · ${formatMB(totalBytes)}`}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collapsed user avatar ── */}
      <AnimatePresence>
        {sidebarCollapsed && config && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center pb-4"
          >
            <div
              className="flex items-center justify-center text-xs font-bold"
              style={{
                width: 30, height: 30,
                background: 'var(--color-accent-bg)',
                border: '1px solid rgba(212,146,42,0.3)',
                borderRadius: '50%',
                color: 'var(--color-accent)',
              }}
            >
              {userInitial}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3.5 top-16 z-10 flex items-center justify-center"
        style={{
          width: 28, height: 28,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '50%',
          color: 'var(--color-muted)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-dim)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
        }}
      >
        {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}

function formatMB(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── NavItem ── */

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  danger?: boolean;
}

function NavItem({ icon, label, badge, active, collapsed, onClick, danger }: NavItemProps) {
  // Pill shape: inset from sidebar edges with margin so rounded corners are clearly visible.
  // This matches the floating-pill aesthetic of the reader bars.
  const activeColor  = 'var(--color-accent-soft)';
  const defaultColor = danger ? 'var(--color-faint)' : 'var(--color-muted)';

  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3.5 text-base font-medium transition-all ${active ? 'nav-active' : ''}`}
      style={{
        width: 'calc(100% - 24px)',
        margin: '2px 12px',
        padding: collapsed ? '13px 0' : '13px 16px',
        justifyContent: collapsed ? 'center' : undefined,
        borderRadius: '13px',
        border: 'none',
        color: active ? activeColor : defaultColor,
        background: active
          ? 'linear-gradient(135deg, rgba(212,146,42,0.18), rgba(212,146,42,0.12))'
          : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px rgba(212,146,42,0.28)' : 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
          (e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--color-red)' : 'var(--color-text)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = defaultColor;
        }
      }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex-1 truncate whitespace-nowrap text-left"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && badge != null && badge > 0 && (
        <AnimatePresence>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex-shrink-0 text-xs font-bold leading-none"
            style={{
              background: active ? 'rgba(212,146,42,0.28)' : 'var(--color-raised)',
              border: `1px solid ${active ? 'rgba(212,146,42,0.45)' : 'var(--color-border)'}`,
              borderRadius: '12px',
              color: active ? 'var(--color-accent-soft)' : 'var(--color-faint)',
              minWidth: 22, textAlign: 'center',
              padding: '3px 7px',
            }}
          >
            {badge}
          </motion.span>
        </AnimatePresence>
      )}
    </button>
  );
}
