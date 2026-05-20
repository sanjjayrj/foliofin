import {
  writeFile,
  readFile,
  mkdir,
  exists,
  remove,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import type { BookFormat } from '../types/jellyfin';

const BOOKS_DIR = 'books';

async function ensureBooksDir(): Promise<void> {
  await mkdir(BOOKS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
}

function localPath(itemId: string, format: BookFormat): string {
  return `${BOOKS_DIR}/${itemId}.${format}`;
}

export type ProgressCallback = (loaded: number, total: number, pct: number) => void;

/**
 * Download a book from a URL and save it to AppData/books/{itemId}.{format}.
 * Streams with progress callbacks. Returns the relative local path on success.
 */
export async function downloadBook(
  url: string,
  itemId: string,
  format: BookFormat,
  onProgress?: ProgressCallback
): Promise<{ localPath: string; fileSize: number }> {
  await ensureBooksDir();

  const path = localPath(itemId, format);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      const pct = contentLength > 0 ? (loaded / contentLength) * 100 : 0;
      onProgress?.(loaded, contentLength, pct);
    }
  }

  // Merge chunks into a single Uint8Array
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  await writeFile(path, data, { baseDir: BaseDirectory.AppData });
  return { localPath: path, fileSize: loaded };
}

/**
 * Read a locally cached book file into a Uint8Array.
 */
export async function readBook(path: string): Promise<Uint8Array> {
  return readFile(path, { baseDir: BaseDirectory.AppData });
}

/**
 * Check whether a book is cached locally.
 */
export async function isDownloaded(itemId: string, format: BookFormat): Promise<boolean> {
  try {
    return await exists(localPath(itemId, format), { baseDir: BaseDirectory.AppData });
  } catch {
    return false;
  }
}

/**
 * Delete a cached book file from disk.
 */
export async function deleteBook(itemId: string, format: BookFormat): Promise<void> {
  await remove(localPath(itemId, format), { baseDir: BaseDirectory.AppData });
}

/**
 * Return a relative path for a cached book (for store persistence).
 */
export function getCachedPath(itemId: string, format: BookFormat): string {
  return localPath(itemId, format);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
