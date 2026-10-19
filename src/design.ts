import type { ClientConfig, PublicLink } from './config';
import { normalizeStyle, type QrStyle } from './engine/style';

/**
 * Each link stores the design it was made with ({ style, logoId }). Links made before
 * designs were stored have none and show the site's default design and logo.
 */
export function linkDesign(link: PublicLink, config: ClientConfig): { style: QrStyle; logoId: number } {
  if (!link.style) return { style: config.style, logoId: config.defaultLogo };
  const logoId = config.logos.some((l) => l.id === link.logoId) ? (link.logoId as number) : 0;
  return { style: normalizeStyle(link.style), logoId };
}

/**
 * Private keys that let this browser keep saving design tweaks to links it created.
 * Kept per browser; without one, a link's design can no longer be changed.
 */
const KEY = 'genqr.editKeys';

function readKeys(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function getEditKey(code: string): string | null {
  return readKeys()[code] ?? null;
}

export function setEditKey(code: string, key: string) {
  try {
    const keys = readKeys();
    keys[code] = key;
    // Keep the newest 200 so storage stays small.
    const entries = Object.entries(keys).slice(-200);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // storage blocked: tweaks are still saved during this visit (the key is also kept in memory)
  }
}
