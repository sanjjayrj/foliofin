import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, User, Lock, BookOpen, Wifi, WifiOff } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { authenticate, getSystemInfo } from '../../services/jellyfin';
import { useAppStore } from '../../store';
import type { AppConfig } from '../../types/jellyfin';

export default function SetupScreen() {
  const setConfig = useAppStore((s) => s.setConfig);
  const [serverUrl, setServerUrl] = useState('http://localhost:8096');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [serverName, setServerName] = useState('');

  // Debounced server ping
  useEffect(() => {
    setServerOk(null);
    setServerName('');
    const url = serverUrl.trim().replace(/\/$/, '');
    if (!url) return;
    const t = setTimeout(async () => {
      try {
        const info = await getSystemInfo(url);
        setServerOk(true);
        setServerName(info.ServerName ?? 'Jellyfin');
      } catch {
        setServerOk(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [serverUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!serverUrl.trim() || !username.trim()) {
      setError('Server URL and username are required.');
      return;
    }
    const url = serverUrl.trim().replace(/\/$/, '');
    setLoading(true);
    try {
      const auth = await authenticate(url, username, password);
      const cfg: AppConfig = {
        serverUrl: url,
        token: auth.AccessToken,
        userId: auth.User.Id,
        userName: auth.User.Name,
        serverId: auth.ServerId,
      };
      setConfig(cfg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg.includes('401') ? 'Invalid username or password.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo / branding */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] flex items-center justify-center mb-4 glow-primary"
          >
            <BookOpen size={30} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold gradient-text">FolioFin</h1>
          <p className="text-sm text-[#9898b8] mt-1">Your Jellyfin reading companion</p>
        </div>

        {/* Card */}
        <div className="glass rounded-[20px] p-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Server URL */}
            <div className="space-y-1.5">
              <Input
                label="Server URL"
                type="url"
                placeholder="http://192.168.1.x:8096"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                icon={<Server size={15} />}
              />
              {/* Server status */}
              {serverOk !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-1.5 text-xs px-1 ${serverOk ? 'text-[#10b981]' : 'text-red-400'}`}
                >
                  {serverOk
                    ? <><Wifi size={12} /> Connected to <strong>{serverName}</strong></>
                    : <><WifiOff size={12} /> Server not reachable</>
                  }
                </motion.div>
              )}
            </div>

            <Input
              label="Username"
              type="text"
              placeholder="jellyfin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              icon={<User size={15} />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              icon={<Lock size={15} />}
            />

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-[8px] px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full mt-2 justify-center"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-xs text-[#5a5a7a] pt-2">
            Connect to your Jellyfin server to access your book library
          </p>
        </div>
      </motion.div>
    </div>
  );
}
