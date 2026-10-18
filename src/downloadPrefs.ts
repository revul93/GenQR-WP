import { useEffect, useState } from 'preact/hooks';
import type { ExportFormat } from './engine/export';

/** The one-click download uses the last options chosen in the Download dialog (per browser). */
export interface DownloadPrefs {
  format: ExportFormat;
  size: number;
}

export const DEFAULT_PREFS: DownloadPrefs = { format: 'png', size: 1024 };
const KEY = 'genqr.download';
const FORMATS: ExportFormat[] = ['png', 'jpg', 'svg', 'pdf', 'docx'];

export function loadPrefs(): DownloadPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && FORMATS.includes(p.format) && Number(p.size) > 0) return { format: p.format, size: Number(p.size) };
  } catch {
    // storage blocked or corrupt: use the default
  }
  return DEFAULT_PREFS;
}

export function savePrefs(p: DownloadPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage blocked: the choice just isn't remembered
  }
  current = p;
  listeners.forEach((l) => l(p));
}

let current: DownloadPrefs | null = null;
const listeners = new Set<(p: DownloadPrefs) => void>();

/** Current prefs; re-renders when the Download dialog saves new ones. */
export function useDownloadPrefs(): DownloadPrefs {
  const [prefs, setPrefs] = useState<DownloadPrefs>(() => current ?? (current = loadPrefs()));
  useEffect(() => {
    listeners.add(setPrefs);
    return () => void listeners.delete(setPrefs);
  }, []);
  return prefs;
}

export function prefsLabel({ format, size }: DownloadPrefs): string {
  const unit = format === 'pdf' || format === 'docx' ? `${size} cm` : `${size} px`;
  return `${format === 'docx' ? 'Word' : format.toUpperCase()} · ${unit}`;
}
