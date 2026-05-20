import { useState } from 'react';
import { Server, User, Trash2, Info, BookOpen, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAppStore } from '../../store';
import { authenticate } from '../../services/jellyfin';
import type { AppConfig } from '../../types/jellyfin';

export default function SettingsScreen() {
  const { config, setConfig, clearConfig, readerSettings, setReaderSettings, progress } = useAppStore();
  const [serverUrl, setServerUrl] = useState(config?.serverUrl ?? '');
  const [username, setUsername] = useState(config?.userName ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  const totalBooks = Object.keys(progress).length;
  const readBooks = Object.values(progress).filter((p) => p.percentage >= 95).length;

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setError('All fields are required to re-authenticate.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const auth = await authenticate(serverUrl.trim().replace(/\/$/, ''), username, password);
      const cfg: AppConfig = {
        serverUrl: serverUrl.trim().replace(/\/$/, ''),
        token: auth.AccessToken,
        userId: auth.User.Id,
        userName: auth.User.Name,
        serverId: auth.ServerId,
      };
      setConfig(cfg);
      setSaveMsg('Server settings updated!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  const handleClearProgress = () => {
    if (confirm('Clear all local reading progress? This cannot be undone.')) {
      useAppStore.setState({ progress: {} });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#08080f]">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0ff]">Settings</h1>
          <p className="text-sm text-[#9898b8] mt-1">Configure your FolioFin experience</p>
        </div>

        {/* Server settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1c1c2e]">
            <Server size={16} className="text-[#7c3aed]" />
            <h2 className="text-base font-semibold text-[#f0f0ff]">Jellyfin Server</h2>
          </div>

          {config && (
            <div className="bg-[#171726] border border-[#2a2a42] rounded-[12px] p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#7c3aed]/10 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-[#a78bfa]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#f0f0ff]">{config.userName}</p>
                <p className="text-xs text-[#9898b8] truncate">{config.serverUrl}</p>
              </div>
              <span className="ml-auto text-xs text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full font-medium">
                Connected
              </span>
            </div>
          )}

          <form onSubmit={handleSaveServer} className="space-y-3">
            <Input
              label="Server URL"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.x:8096"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter to re-auth"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {saveMsg && <p className="text-sm text-[#10b981]">{saveMsg}</p>}
            <Button type="submit" loading={saving} icon={<RefreshCw size={14} />}>
              Reconnect
            </Button>
          </form>
        </section>

        {/* Reading defaults */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1c1c2e]">
            <BookOpen size={16} className="text-[#7c3aed]" />
            <h2 className="text-base font-semibold text-[#f0f0ff]">Reading Defaults</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Default Theme</label>
              <select
                value={readerSettings.theme}
                onChange={(e) => setReaderSettings({ theme: e.target.value as 'dark' | 'light' | 'sepia' })}
                className="w-full bg-[#0f0f1a] border border-[#2a2a42] rounded-[10px] text-[#f0f0ff] px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="sepia">Sepia</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Default Font</label>
              <select
                value={readerSettings.font}
                onChange={(e) => setReaderSettings({ font: e.target.value as 'serif' | 'sans' | 'mono' })}
                className="w-full bg-[#0f0f1a] border border-[#2a2a42] rounded-[10px] text-[#f0f0ff] px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
              >
                <option value="serif">Serif (Palatino)</option>
                <option value="sans">Sans Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-[#9898b8] uppercase tracking-wider">Font Size</label>
              <span className="text-xs text-[#5a5a7a]">{readerSettings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={32}
              value={readerSettings.fontSize}
              onChange={(e) => setReaderSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-[#7c3aed]"
            />
          </div>
        </section>

        {/* Stats */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1c1c2e]">
            <Info size={16} className="text-[#7c3aed]" />
            <h2 className="text-base font-semibold text-[#f0f0ff]">Reading Stats</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'In Progress', value: totalBooks - readBooks },
              { label: 'Completed', value: readBooks },
              { label: 'Total Tracked', value: totalBooks },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#171726] border border-[#2a2a42] rounded-[12px] p-4 text-center">
                <p className="text-2xl font-bold gradient-text">{stat.value}</p>
                <p className="text-xs text-[#9898b8] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={handleClearProgress}
          >
            Clear Local Progress
          </Button>
        </section>

        {/* Danger zone */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1c1c2e]">
            <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
          </div>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={clearConfig}>
            Sign Out & Reset
          </Button>
        </section>

        {/* About */}
        <section className="pt-4 border-t border-[#1c1c2e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#f0f0ff]">FolioFin</p>
              <p className="text-xs text-[#9898b8]">v0.1.0 · Jellyfin reading companion for Linux</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
