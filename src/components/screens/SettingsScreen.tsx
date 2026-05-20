import { useState } from 'react';
import { Server, User, Trash2, BookOpen, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store';
import { authenticate } from '../../services/jellyfin';
import type { AppConfig } from '../../types/jellyfin';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: '5px',
  color: 'var(--color-text)',
  padding: '9px 12px',
  fontSize: '14px',
  outline: 'none',
};

export default function SettingsScreen() {
  const { config, setConfig, clearConfig, readerSettings, setReaderSettings, progress } = useAppStore();
  const [serverUrl, setServerUrl] = useState(config?.serverUrl ?? '');
  const [username, setUsername] = useState(config?.userName ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const totalTracked = Object.keys(progress).length;
  const readCount = Object.values(progress).filter((p) => p.percentage >= 95).length;

  const handleReconnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { setError('Enter password to reconnect.'); return; }
    setSaving(true); setError(''); setMsg('');
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
      setMsg('Reconnected successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-xl mx-auto px-8 py-8 flex flex-col gap-10">

        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Settings</h1>
        </div>

        {/* Server */}
        <Section icon={<Server size={15} />} title="Server">
          {config && (
            <div
              className="flex items-center gap-3 px-4 py-3 mb-4"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '6px' }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-raised)', border: '1px solid var(--color-border)', borderRadius: '5px' }}
              >
                <User size={15} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{config.userName}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-muted)' }}>{config.serverUrl}</p>
              </div>
              <span
                className="ml-auto text-[11px] font-semibold px-2 py-0.5 flex-shrink-0"
                style={{ color: 'var(--color-green)', background: 'rgba(90,158,111,0.12)', border: '1px solid rgba(90,158,111,0.25)', borderRadius: '3px' }}
              >
                Connected
              </span>
            </div>
          )}
          <form onSubmit={handleReconnect} className="flex flex-col gap-3">
            <FieldGroup label="Server URL">
              <input type="url" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} style={fieldStyle} />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Username">
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={fieldStyle} />
              </FieldGroup>
              <FieldGroup label="Password">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter to reconnect" style={fieldStyle} />
              </FieldGroup>
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
            {msg && <p className="text-sm" style={{ color: 'var(--color-green)' }}>{msg}</p>}
            <div>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2"
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '5px',
                  color: saving ? 'var(--color-faint)' : 'var(--color-text)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={13} className={saving ? 'animate-spin' : ''} />
                {saving ? 'Connecting…' : 'Reconnect'}
              </button>
            </div>
          </form>
        </Section>

        {/* Reading */}
        <Section icon={<BookOpen size={15} />} title="Reading Defaults">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Theme">
                <select
                  value={readerSettings.theme}
                  onChange={(e) => setReaderSettings({ theme: e.target.value as 'dark' | 'light' | 'sepia' })}
                  style={{ ...fieldStyle, cursor: 'pointer' }}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="sepia">Sepia</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Typeface">
                <select
                  value={readerSettings.font}
                  onChange={(e) => setReaderSettings({ font: e.target.value as 'serif' | 'sans' | 'mono' })}
                  style={{ ...fieldStyle, cursor: 'pointer' }}
                >
                  <option value="serif">Serif (Palatino)</option>
                  <option value="sans">Sans Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </FieldGroup>
            </div>
            <FieldGroup label={`Font Size — ${readerSettings.fontSize}px`}>
              <input type="range" min={12} max={32} value={readerSettings.fontSize}
                onChange={(e) => setReaderSettings({ fontSize: Number(e.target.value) })}
                className="w-full" style={{ accentColor: 'var(--color-accent)' }}
              />
            </FieldGroup>
          </div>
        </Section>

        {/* Stats */}
        <Section title="Reading Stats">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'In Progress', value: totalTracked - readCount },
              { label: 'Completed', value: readCount },
              { label: 'Total Tracked', value: totalTracked },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-5"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              >
                <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{s.value}</span>
                <span className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <DangerBtn
              icon={<Trash2 size={13} />}
              onClick={() => { if (confirm('Clear all local reading progress?')) useAppStore.setState({ progress: {} }); }}
            >
              Clear Local Progress
            </DangerBtn>
          </div>
        </Section>

        {/* Danger */}
        <Section title="Account">
          <DangerBtn icon={<Trash2 size={13} />} onClick={clearConfig}>
            Sign Out & Reset App
          </DangerBtn>
        </Section>

        {/* About */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ border: '1px solid var(--color-border-soft)', borderRadius: '6px', background: 'var(--color-surface)' }}
        >
          <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>FolioFin v0.1.0</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-faint)' }}>Jellyfin reading companion for Linux</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--color-border-soft)' }}>
        {icon && <span style={{ color: 'var(--color-accent)' }}>{icon}</span>}
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-faint)', letterSpacing: '0.03em' }}>{label}</label>
      {children}
    </div>
  );
}

function DangerBtn({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-medium px-4 py-2"
      style={{
        color: 'var(--color-red)',
        background: 'rgba(201,95,95,0.08)',
        border: '1px solid rgba(201,95,95,0.2)',
        borderRadius: '5px',
        cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
