import type {
  AppConfig,
  JellyfinAuthResponse,
  JellyfinItem,
  JellyfinItemsResponse,
  JellyfinLibrary,
  JellyfinUserData,
  BookFormat,
} from '../types/jellyfin';

const CLIENT_NAME = 'FolioFin';
const CLIENT_VERSION = '0.1.0';
const DEVICE_NAME = 'Linux Desktop';
const DEVICE_ID = 'foliofin-linux-01';

function authHeader(token?: string): Record<string, string> {
  const parts = [
    `MediaBrowser Client="${CLIENT_NAME}"`,
    `Device="${DEVICE_NAME}"`,
    `DeviceId="${DEVICE_ID}"`,
    `Version="${CLIENT_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return {
    'X-Emby-Authorization': parts.join(', '),
    'Content-Type': 'application/json',
  };
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Jellyfin API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function authenticate(
  serverUrl: string,
  username: string,
  password: string
): Promise<JellyfinAuthResponse> {
  const url = `${serverUrl}/Users/AuthenticateByName`;
  return apiFetch<JellyfinAuthResponse>(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ Username: username, Pw: password }),
  });
}

export async function getSystemInfo(serverUrl: string): Promise<{ ServerName: string; Version: string }> {
  return apiFetch(`${serverUrl}/System/Info/Public`);
}

export async function getLibraries(cfg: AppConfig): Promise<JellyfinLibrary[]> {
  const url = `${cfg.serverUrl}/Library/MediaFolders`;
  const data = await apiFetch<{ Items: JellyfinLibrary[] }>(url, {
    headers: authHeader(cfg.token),
  });
  return data.Items;
}

export async function getBooks(
  cfg: AppConfig,
  options: {
    parentId?: string;
    startIndex?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'Ascending' | 'Descending';
  } = {}
): Promise<JellyfinItemsResponse> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'Book',
    Recursive: 'true',
    Fields: 'Overview,People,MediaSources,UserData,Genres,Tags,SeriesInfo,Path,ImageTags',
    ImageTypeLimit: '1',
    EnableImageTypes: 'Primary,Thumb',
    StartIndex: String(options.startIndex ?? 0),
    Limit: String(options.limit ?? 200),
    SortBy: options.sortBy ?? 'SortName',
    SortOrder: options.sortOrder ?? 'Ascending',
  });
  if (options.parentId) params.set('ParentId', options.parentId);
  if (options.search) params.set('SearchTerm', options.search);

  const url = `${cfg.serverUrl}/Users/${cfg.userId}/Items?${params}`;
  return apiFetch<JellyfinItemsResponse>(url, {
    headers: authHeader(cfg.token),
  });
}

export async function getBookDetail(cfg: AppConfig, itemId: string): Promise<JellyfinItem> {
  const url = `${cfg.serverUrl}/Users/${cfg.userId}/Items/${itemId}?Fields=Overview,People,MediaSources,UserData,Genres,Tags`;
  return apiFetch<JellyfinItem>(url, { headers: authHeader(cfg.token) });
}

export function getCoverUrl(cfg: AppConfig, itemId: string, size = 400): string {
  return `${cfg.serverUrl}/Items/${itemId}/Images/Primary?maxWidth=${size}&quality=90&api_key=${cfg.token}`;
}

export function getDownloadUrl(cfg: AppConfig, itemId: string): string {
  return `${cfg.serverUrl}/Items/${itemId}/Download?api_key=${cfg.token}`;
}

export function detectFormat(item: JellyfinItem): BookFormat {
  // MediaSources.Container is often empty for books — fall back to Path extension
  const container = item.MediaSources?.[0]?.Container?.toLowerCase();
  if (container) {
    if (container === 'epub') return 'epub';
    if (container === 'pdf') return 'pdf';
    if (container === 'cbz') return 'cbz';
    if (container === 'cbr') return 'cbr';
    if (container === 'mobi' || container === 'azw3') return 'mobi';
  }
  const path = item.Path ?? '';
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'epub') return 'epub';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'cbz') return 'cbz';
  if (ext === 'cbr') return 'cbr';
  if (ext === 'mobi' || ext === 'azw3') return 'mobi';
  return 'unknown';
}

export async function updateProgress(
  cfg: AppConfig,
  itemId: string,
  positionTicks: number
): Promise<void> {
  const url = `${cfg.serverUrl}/Sessions/Playing/Progress`;
  await fetch(url, {
    method: 'POST',
    headers: authHeader(cfg.token),
    body: JSON.stringify({
      ItemId: itemId,
      PositionTicks: positionTicks,
      IsPaused: true,
      MediaSourceId: itemId,
    }),
  });
}

export async function markAsRead(cfg: AppConfig, itemId: string): Promise<void> {
  const url = `${cfg.serverUrl}/Users/${cfg.userId}/PlayedItems/${itemId}`;
  await fetch(url, { method: 'POST', headers: authHeader(cfg.token) });
}

export async function getUserData(cfg: AppConfig, itemId: string): Promise<JellyfinUserData> {
  const item = await getBookDetail(cfg, itemId);
  return item.UserData ?? {
    PlaybackPositionTicks: 0,
    PlayCount: 0,
    IsFavorite: false,
    Played: false,
    Key: itemId,
  };
}

export async function toggleFavorite(
  cfg: AppConfig,
  itemId: string,
  favorite: boolean
): Promise<void> {
  const method = favorite ? 'POST' : 'DELETE';
  const url = `${cfg.serverUrl}/Users/${cfg.userId}/FavoriteItems/${itemId}`;
  await fetch(url, { method, headers: authHeader(cfg.token) });
}
