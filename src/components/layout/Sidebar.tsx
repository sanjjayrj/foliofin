import { AnimatePresence, motion } from 'framer-motion';
import { Library, Settings, LogOut, ChevronLeft, ChevronRight, BookOpen, HardDrive } from 'lucide-react';
import { useAppStore } from '../../store';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  const { config, libraries, activeLibraryId, setActiveLibraryId, sidebarCollapsed, setSidebarCollapsed, clearConfig } = useAppStore();
  const downloadCount = useAppStore((s) => Object.keys(s.downloads).length);

  const bookLibraries = libraries.filter(
    (l) => !l.CollectionType || l.CollectionType === 'books'
  );

  const handleLibraryClick = (id: string) => {
    setActiveLibraryId(id);
    onNavigate('library');
  };

  const handleLogout = () => {
    if (confirm('Sign out of FolioFin?')) clearConfig();
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 56 : 210 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      className="relative flex flex-col h-full flex-shrink-0 overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border-soft)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: '1px solid var(--color-border-soft)', minHeight: 68 }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 28, height: 28,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
          }}
        >
          <BookOpen size={14} style={{ color: 'var(--color-accent)' }} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="text-sm font-semibold whitespace-nowrap"
              style={{ color: 'var(--color-text)' }}
            >
              FolioFin
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 flex flex-col gap-0.5">
        <AnimatePresence>
          {!sidebarCollapsed && bookLibraries.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-bold uppercase tracking-wider px-2 pt-2 pb-2"
              style={{ color: 'var(--color-faint)' }}
            >
              Libraries
            </motion.p>
          )}
        </AnimatePresence>

        {bookLibraries.map((lib) => (
          <NavItem
            key={lib.ItemId}
            icon={<Library size={15} />}
            label={lib.Name}
            active={activeLibraryId === lib.ItemId && activeScreen === 'library'}
            collapsed={sidebarCollapsed}
            onClick={() => handleLibraryClick(lib.ItemId)}
          />
        ))}

        {bookLibraries.length === 0 && (
          <NavItem
            icon={<Library size={15} />}
            label="Library"
            active={activeScreen === 'library'}
            collapsed={sidebarCollapsed}
            onClick={() => onNavigate('library')}
          />
        )}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 flex flex-col gap-0.5" style={{ borderTop: '1px solid var(--color-border-soft)' }}>
        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          active={activeScreen === 'settings'}
          collapsed={sidebarCollapsed}
          onClick={() => onNavigate('settings')}
        />
        <NavItem
          icon={<LogOut size={15} />}
          label="Sign Out"
          active={false}
          collapsed={sidebarCollapsed}
          onClick={handleLogout}
          danger
        />
      </div>

      {/* User info */}
      <AnimatePresence>
        {!sidebarCollapsed && config && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3"
            style={{ borderTop: '1px solid var(--color-border-soft)' }}
          >
            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-muted)' }}>{config.userName}</p>
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--color-faint)' }}>
              {config.serverUrl.replace(/^https?:\/\//, '')}
            </p>
            {downloadCount > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <HardDrive size={10} style={{ color: 'var(--color-green)' }} />
                <span className="text-[10px]" style={{ color: 'var(--color-green)' }}>
                  {downloadCount} on device
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-14 z-10 flex items-center justify-center"
        style={{
          width: 22, height: 22,
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '50%',
          color: 'var(--color-muted)',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)')}
      >
        {sidebarCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </motion.aside>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  danger?: boolean;
}

function NavItem({ icon, label, active, collapsed, onClick, danger }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${active ? 'nav-active' : ''}`}
      style={{
        borderRadius: '4px',
        borderLeft: active ? undefined : '2px solid transparent',
        color: active
          ? 'var(--color-accent-soft)'
          : danger
          ? 'var(--color-faint)'
          : 'var(--color-muted)',
        background: active ? 'var(--color-accent-bg)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
          (e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--color-red)' : 'var(--color-text)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--color-faint)' : 'var(--color-muted)';
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
            className="truncate whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
