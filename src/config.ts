import { normalizeStyle, type QrStyle } from './engine/style';
import type { Preset } from './presets';

/** Settings the plugin writes into the page (data-config); see GenQR_Admin::client_config(). */
export interface Logo {
  id: number;
  name: string;
  url: string;
}

export interface ClientConfig {
  logos: Logo[];
  defaultLogo: number;
  style: QrStyle;
  presets: Preset[];
  /** REST base, e.g. https://site/wp-json/genqr/v1/ */
  api: string;
  /** WordPress REST nonce (wp_rest) for the logged-in admin. */
  nonce: string;
  /** e.g. https://site/go/ */
  shortBase: string;
  /** Edit screen URL, missing only the link id. */
  editUrl: string;
  listUrl: string;
}

/** A QR code (short link) as the REST API returns it. */
export interface Link {
  id: number;
  code: string;
  title: string;
  shortUrl: string;
  destination: string;
  active: boolean;
  clicks: number;
  createdAt: string;
  /** The design it was made with; null for links made before designs were stored. */
  style: Partial<QrStyle> | null;
  logoId: number | null;
}

export function readConfig(el: HTMLElement): ClientConfig {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(el.dataset.config || '{}');
  } catch {
    // fall through to defaults
  }
  return {
    logos: Array.isArray(raw.logos) ? (raw.logos as Logo[]) : [],
    defaultLogo: Number(raw.defaultLogo) || 0,
    style: normalizeStyle((raw.style as object) ?? {}),
    presets: Array.isArray(raw.presets)
      ? (raw.presets as { name?: unknown; style?: object }[]).filter((p) => typeof p.name === 'string' && p.name).map((p) => ({ name: String(p.name), style: normalizeStyle(p.style ?? {}) }))
      : [],
    api: String(raw.api ?? '/wp-json/genqr/v1/'),
    nonce: String(raw.nonce ?? ''),
    shortBase: String(raw.shortBase ?? ''),
    editUrl: String(raw.editUrl ?? ''),
    listUrl: String(raw.listUrl ?? ''),
  };
}

/** Calls the plugin's REST API as the logged-in admin. Throws an Error with the server's message. */
export async function api<T>(config: ClientConfig, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(config.api + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': config.nonce, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.code === 'rest_cookie_invalid_nonce' ? 'Your session has expired. Reload the page and try again.' : data?.message || `The server returned an error (${res.status}).`,
    );
  }
  return data as T;
}

/** File-name-safe version of a title or short link text. */
export function fileName(title: string, fallback: string): string {
  return (title.trim() || fallback).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 80) || fallback;
}
