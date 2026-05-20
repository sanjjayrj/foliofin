import { useAppStore } from './store';
import SetupScreen from './components/screens/SetupScreen';
import AppShell from './components/layout/AppShell';

export default function App() {
  const config = useAppStore((s) => s.config);
  return config ? <AppShell /> : <SetupScreen />;
}
