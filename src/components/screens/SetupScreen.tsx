import { useState, useEffect } from 'react';
import { Server, User, Lock, BookOpen, Wifi, WifiOff } from 'lucide-react';
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
  const [serverStatus, setServerStatus] = useState<null | { ok: boolean; name?: string }>(null);

  useEffect(() => {
    setServerStatus(null);
    const url = serverUrl.trim().replace(/\/$/, '');
    if (!url) return;
    const t = setTimeout(async () => {
      try {
        const info = await getSystemInfo(url);
        setServerStatus({ ok: true, name: info.ServerName });
      } catch {
        setServerStatus({ ok: false });
      }
    }, 700);
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
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-10">

        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 flex items-center justify-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
          >
            <BookOpen size={26} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>FolioFin</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>Connect to your Jellyfin server</p>
          </div>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 p-7"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
          }}
        >
          {/* Server URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
              Server URL
            </label>
            <div className="relative">
              <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-faint)' }} />
              <input
                type="url"
                placeholder="http://192.168.1.x:8096"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                style={inputStyle}
                className="pl-9"
              />
            </div>
            {serverStatus && (
              <div
                className="flex items-center gap-1.5 text-xs mt-0.5"
                style={{ color: serverStatus.ok ? 'var(--color-green)' : 'var(--color-red)' }}
              >
                {serverStatus.ok
                  ? <><Wifi size={11} /> Connected to <strong>{serverStatus.name}</strong></>
                  : <><WifiOff size={11} /> Server not reachable</>
                }
              </div>
            )}
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
              Username
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-faint)' }} />
              <input
                type="text"
                placeholder="your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                style={inputStyle}
                className="pl-9"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-faint)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle}
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <p
              className="text-sm px-3 py-2"
              style={{
                color: 'var(--color-red)',
                background: 'rgba(201,95,95,0.1)',
                border: '1px solid rgba(201,95,95,0.2)',
                borderRadius: '5px',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold mt-1"
            style={{
              background: loading ? 'var(--color-raised)' : 'var(--color-accent)',
              color: loading ? 'var(--color-muted)' : '#111',
              borderRadius: '5px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: '5px',
  color: 'var(--color-text)',
  padding: '9px 12px',
  fontSize: '14px',
  outline: 'none',
};
