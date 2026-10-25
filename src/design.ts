import type { ClientConfig, Link } from './config';
import { normalizeStyle, type QrStyle } from './engine/style';

/**
 * Each QR code stores the design it was made with ({ style, logoId }). Codes made before
 * designs were stored have none and use the site's default design and logo.
 */
export function linkDesign(link: Pick<Link, 'style' | 'logoId'>, config: ClientConfig): { style: QrStyle; logoId: number } {
  if (!link.style) return { style: config.style, logoId: validLogo(config, config.defaultLogo) };
  return { style: normalizeStyle(link.style), logoId: validLogo(config, link.logoId ?? 0) };
}

export function validLogo(config: ClientConfig, id: number): number {
  return config.logos.some((l) => l.id === id) ? id : 0;
}

/** Normalises typed short link text the same way the server does ("Expo 2026" → "expo-2026"). */
export function cleanCode(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '-');
}
