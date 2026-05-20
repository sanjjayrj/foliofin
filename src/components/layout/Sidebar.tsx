import { motion, AnimatePresence } from 'framer-motion';
import { Library, Settings, LogOut, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../../store';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  const { config, libraries, activeLibraryId, setActiveLibraryId, sidebarCollapsed, setSidebarCollapsed, clearConfig } = useAppStore();

  const bookLibraries = libraries.filter(
    (l) => !l.CollectionType || l.CollectionType === 'books'
  );

  const handleLibraryClick = (id: string) => {
    setActiveLibraryId(id);
    onNavigate('library');
  };

  const handleLogout = () => {
    if (confirm('Sign out of FolioFin?')) {
      clearConfig();
    }
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col bg-[#0f0f1a] border-r border-[#1c1c2e] overflow-hidden flex-shrink-0 h-full"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1c1c2e]">
        <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="font-bold text-base gradient-text whitespace-nowrap"
            >
              FolioFin
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {/* Libraries section */}
        <AnimatePresence>
          {!sidebarCollapsed && bookLibraries.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-semibold uppercase tracking-wider text-[#5a5a7a] px-2 pt-2 pb-1"
            >
              Libraries
            </motion.p>
          )}
        </AnimatePresence>

        {bookLibraries.map((lib) => (
          <NavItem
            key={lib.ItemId}
            icon={<Library size={16} />}
            label={lib.Name}
            active={activeLibraryId === lib.ItemId && activeScreen === 'library'}
            collapsed={sidebarCollapsed}
            onClick={() => handleLibraryClick(lib.ItemId)}
          />
        ))}

        {bookLibraries.length === 0 && (
          <NavItem
            icon={<Library size={16} />}
            label="Library"
            active={activeScreen === 'library'}
            collapsed={sidebarCollapsed}
            onClick={() => onNavigate('library')}
          />
        )}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-[#1c1c2e] space-y-0.5">
        <NavItem
          icon={<Settings size={16} />}
          label="Settings"
          active={activeScreen === 'settings'}
          collapsed={sidebarCollapsed}
          onClick={() => onNavigate('settings')}
        />
        <NavItem
          icon={<LogOut size={16} />}
          label="Sign Out"
          active={false}
          collapsed={sidebarCollapsed}
          onClick={handleLogout}
          danger
        />
      </div>

      {/* Server indicator */}
      <AnimatePresence>
        {!sidebarCollapsed && config && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 py-2 border-t border-[#1c1c2e]"
          >
            <p className="text-[10px] text-[#5a5a7a] truncate">{config.userName}</p>
            <p className="text-[10px] text-[#3a3a52] truncate">{config.serverUrl.replace(/^https?:\/\//, '')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-[#1f1f32] border border-[#2a2a42] flex items-center justify-center text-[#9898b8] hover:text-[#f0f0ff] hover:border-[#7c3aed]/50 transition-all"
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
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
      className={clsx(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-sm font-medium transition-all duration-150',
        active
          ? 'sidebar-active text-[#a78bfa]'
          : danger
          ? 'text-[#5a5a7a] hover:text-red-400 hover:bg-red-500/10'
          : 'text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32]',
        collapsed && 'justify-center'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.12 }}
            className="truncate whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
