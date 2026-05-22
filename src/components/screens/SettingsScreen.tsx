import { useState } from 'react';
import { Server, User, Trash2, BookOpen, RefreshCw, HardDrive, Palette } from 'lucide-react';
import { useAppStore } from '../../store';
import { authenticate } from '../../services/jellyfin';
import { deleteBook, formatBytes } from '../../services/storage';
import type { AppConfig, BookFormat } from '../../types/jellyfin';

const CARD: React.CSSProperties = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  padding: '24px 28px',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  color: 'var(--color-text)',
  padding: '11px 14px',
  fontSize: '14px',
  outline: 'none',
};

export default function SettingsScreen() {
  const { config, setConfig, clearConfig, readerSettings, setReaderSettings, progress } = useAppStore();
  const downloads = useAppStore((s) => s.downloads);
  const removeDownload = useAppStore((s) => s.removeDownload);

  const [serverUrl, setServerUrl] = useState(config?.serverUrl ?? '');
  const [username, setUsername] = useState(config?.userName ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalTracked = Object.keys(progress).length;
  const readCount = Object.values(progress).filter((p) => p.percentage >= 95).length;

  const downloadList = Object.values(downloads).sort((a, b) => b.downloadedAt - a.downloadedAt);
  const totalBytes = downloadList.reduce((sum, d) => sum + d.fileSize, 0);

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

  const handleDeleteDownload = async (itemId: string, format: BookFormat) => {
    setDeletingId(itemId);
    try {
      await deleteBook(itemId, format);
      removeDownload(itemId);
    } catch {}
    finally { setDeletingId(null); }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${downloadList.length} downloaded books from device?`)) return;
    for (const entry of downloadList) {
      try { await deleteBook(entry.itemId, entry.format); removeDownload(entry.itemId); } catch {}
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-xl mx-auto px-8 py-10 flex flex-col gap-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-faint)' }}>Manage your server connection and reading preferences</p>
        </div>

        {/* ── Server ── */}
        <SectionCard icon={<Server size={16} />} title="Server Connection">
          {config && (
            <div
              className="flex items-center gap-3 px-4 py-3 mb-5"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 10 }}
            >
              <div
                className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-dim)', borderRadius: 8 }}
              >
                <User size={15} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{config.userName}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-muted)' }}>{config.serverUrl.replace(/^https?:\/\//, '')}</p>
              </div>
              <span
                className="text-xs font-bold px-2.5 py-1 flex-shrink-0"
                style={{ color: 'var(--color-green)', background: 'rgba(90,158,111,0.12)', border: '1px solid rgba(90,158,111,0.25)', borderRadius: 20 }}
              >
                Connected
              </span>
            </div>
          )}
          <form onSubmit={handleReconnect} className="flex flex-col gap-5">
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
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5"
                style={{
                  background: saving ? 'var(--color-surface)' : 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 22,
                  color: saving ? 'var(--color-faint)' : 'var(--color-text)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={13} className={saving ? 'animate-spin' : ''} />
                {saving ? 'Connecting…' : 'Reconnect'}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* ── Reading defaults ── */}
        <SectionCard icon={<Palette size={16} />} title="Reading Defaults">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
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
              <div className="flex items-center gap-4">
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-faint)' }}>12</span>
                <input
                  type="range" min={12} max={32} value={readerSettings.fontSize}
                  onChange={(e) => setReaderSettings({ fontSize: Number(e.target.value) })}
                  className="flex-1"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-faint)' }}>32</span>
              </div>
            </FieldGroup>
          </div>
        </SectionCard>

        {/* ── Downloaded books ── */}
        <SectionCard icon={<HardDrive size={16} />} title="Downloaded Books">
          {downloadList.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-faint)' }}>
              No books downloaded yet. Open any book and tap Download to save it for offline reading.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Stats row */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 10 }}
              >
                <div className="flex items-center gap-2">
                  <HardDrive size={14} style={{ color: 'var(--color-accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {downloadList.length} {downloadList.length === 1 ? 'book' : 'books'}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-faint)' }}>
                    · {formatBytes(totalBytes)} total
                  </span>
                </div>
                <button
                  onClick={handleDeleteAll}
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{
                    color: 'var(--color-red)',
                    background: 'rgba(201,95,95,0.08)',
                    border: '1px solid rgba(201,95,95,0.2)',
                    borderRadius: 20,
                    cursor: 'pointer',
                  }}
                >
                  Delete All
                </button>
              </div>

              {/* Book list */}
              <div className="flex flex-col gap-2">
                {downloadList.map((entry) => (
                  <div
                    key={entry.itemId}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 10 }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        {entry.bookName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-faint)' }}>
                        {entry.format.toUpperCase()} · {formatBytes(entry.fileSize)} · {new Date(entry.downloadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDownload(entry.itemId, entry.format)}
                      disabled={deletingId === entry.itemId}
                      title="Remove from device"
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 32, height: 32,
                        color: deletingId === entry.itemId ? 'var(--color-faint)' : 'var(--color-red)',
                        background: 'transparent',
                        border: '1px solid rgba(201,95,95,0.2)',
                        cursor: deletingId === entry.itemId ? 'not-allowed' : 'pointer',
                        borderRadius: 8,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Reading stats ── */}
        <SectionCard icon={<BookOpen size={16} />} title="Reading Stats">
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'In Progress', value: totalTracked - readCount },
              { label: 'Completed',   value: readCount },
              { label: 'Total Tracked', value: totalTracked },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-5"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 12 }}
              >
                <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{s.value}</span>
                <span className="text-xs mt-1.5 text-center" style={{ color: 'var(--color-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <DangerBtn
            icon={<Trash2 size={13} />}
            onClick={() => { if (confirm('Clear all local reading progress?')) useAppStore.setState({ progress: {} }); }}
          >
            Clear Local Progress
          </DangerBtn>
        </SectionCard>

        {/* ── Account ── */}
        <SectionCard title="Account">
          <DangerBtn icon={<Trash2 size={13} />} onClick={clearConfig}>
            Sign Out & Reset App
          </DangerBtn>
        </SectionCard>

        {/* ── About ── */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ border: '1px solid var(--color-border-soft)', borderRadius: 14, background: 'var(--color-surface)' }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--color-accent-dim), var(--color-accent))', borderRadius: 9 }}
          >
            <BookOpen size={16} style={{ color: '#1a1208' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>FolioFin v0.1.0</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-faint)' }}>Jellyfin reading companion for Linux</p>
          </div>
        </div>

      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={CARD}>
      <div className="flex items-center gap-2.5 mb-6 pb-5" style={{ borderBottom: '1px solid var(--color-border-soft)' }}>
        {icon && (
          <span
            className="flex items-center justify-center"
            style={{ width: 28, height: 28, background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-dim)', borderRadius: 7, color: 'var(--color-accent)' }}
          >
            {icon}
          </span>
        )}
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-faint)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DangerBtn({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5"
      style={{
        color: 'var(--color-red)',
        background: 'rgba(201,95,95,0.08)',
        border: '1px solid rgba(201,95,95,0.2)',
        borderRadius: 22,
        cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
