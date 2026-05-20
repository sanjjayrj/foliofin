import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import LibraryScreen from '../screens/LibraryScreen';
import ReaderScreen from '../screens/ReaderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useAppStore } from '../../store';
import { getLibraries } from '../../services/jellyfin';

type Screen = 'library' | 'reader' | 'settings';

export default function AppShell() {
  const { config, setLibraries } = useAppStore();
  const [screen, setScreen] = useState<Screen>('library');

  const loadLibraries = useCallback(async () => {
    if (!config) return;
    try {
      const libs = await getLibraries(config);
      setLibraries(libs);
    } catch {
      // ignore — user sees empty library list
    }
  }, [config, setLibraries]);

  useEffect(() => {
    loadLibraries();
  }, [loadLibraries]);

  const navigate = (s: string) => setScreen(s as Screen);

  const screenVariants = {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -16 },
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {screen !== 'reader' && (
        <Sidebar activeScreen={screen} onNavigate={navigate} />
      )}

      <main className="flex-1 min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === 'library' && (
            <motion.div
              key="library"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              <LibraryScreen onOpenBook={() => setScreen('reader')} />
            </motion.div>
          )}
          {screen === 'reader' && (
            <motion.div
              key="reader"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              <ReaderScreen onBack={() => setScreen('library')} />
            </motion.div>
          )}
          {screen === 'settings' && (
            <motion.div
              key="settings"
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              <SettingsScreen />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
