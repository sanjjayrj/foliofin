import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import LibraryScreen from '../screens/LibraryScreen';
import DetailScreen from '../screens/DetailScreen';
import ReaderScreen from '../screens/ReaderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useAppStore } from '../../store';
import { getLibraries } from '../../services/jellyfin';

type Screen = 'library' | 'detail' | 'reader' | 'settings';

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
};

export default function AppShell() {
  const { config, setLibraries, currentBook, setCurrentBook } = useAppStore();
  const [screen, setScreen] = useState<Screen>('library');

  const loadLibraries = useCallback(async () => {
    if (!config) return;
    try {
      const libs = await getLibraries(config);
      setLibraries(libs);
    } catch {}
  }, [config, setLibraries]);

  useEffect(() => { loadLibraries(); }, [loadLibraries]);

  // Hide sidebar inside reader
  const showSidebar = screen !== 'reader';

  const goTo = (s: Screen) => setScreen(s);

  const handleOpenDetail = () => goTo('detail');
  const handleOpenReader = () => goTo('reader');

  const handleBackFromDetail = () => {
    setCurrentBook(null);
    goTo('library');
  };

  const handleBackFromReader = () => {
    // Go back to detail if a book is still selected
    goTo(currentBook ? 'detail' : 'library');
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {showSidebar && (
        <Sidebar
          activeScreen={screen === 'detail' ? 'library' : screen}
          onNavigate={(s) => goTo(s as Screen)}
        />
      )}

      <main className="flex-1 min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === 'library' && (
            <motion.div key="library" {...slide} transition={{ duration: 0.16 }} className="h-full">
              <LibraryScreen onOpenBook={handleOpenDetail} />
            </motion.div>
          )}

          {screen === 'detail' && currentBook && (
            <motion.div key="detail" {...slide} transition={{ duration: 0.16 }} className="h-full">
              <DetailScreen
                book={currentBook}
                onBack={handleBackFromDetail}
                onRead={handleOpenReader}
              />
            </motion.div>
          )}

          {screen === 'reader' && (
            <motion.div key="reader" {...slide} transition={{ duration: 0.16 }} className="h-full">
              <ReaderScreen onBack={handleBackFromReader} />
            </motion.div>
          )}

          {screen === 'settings' && (
            <motion.div key="settings" {...slide} transition={{ duration: 0.16 }} className="h-full">
              <SettingsScreen />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
