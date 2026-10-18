import { normalizeStyle, type QrStyle } from './engine/style';
import type { Preset } from './presets';

/** Settings the plugin writes into the page (data-config); see GenQR_Shortcode::client_config(). */
export interface Logo {
  id: number;
  name: string;
  url: string;
}

export interface ClientConfig {
  title: string;
  brand: string;
  domains: string[];
  logos: Logo[];
  defaultLogo: number;
  style: QrStyle;
  presets: Preset[];
  publicList: boolean;
  /** Rendering the plugin's own full page (top bar), rather than inside a theme page. */
  appMode: boolean;
  api: string;
  shortBase: string;
}

/** A short link as the REST API returns it. */
export interface PublicLink {
  code: string;
  title: string;
  shortUrl: string;
  destination: string;
  clicks?: number;
  createdAt?: string;
}

export function readConfig(el: HTMLElement): ClientConfig {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(el.dataset.config || '{}');
  } catch {
    // fall through to defaults
  }
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    brand: typeof raw.brand === 'string' && raw.brand ? raw.brand : 'GenQR',
    domains: Array.isArray(raw.domains) ? raw.domains.map(String) : [],
    logos: Array.isArray(raw.logos) ? (raw.logos as Logo[]) : [],
    defaultLogo: Number(raw.defaultLogo) || 0,
    style: normalizeStyle((raw.style as object) ?? {}),
    presets: Array.isArray(raw.presets)
      ? (raw.presets as { name?: unknown; style?: object }[]).filter((p) => typeof p.name === 'string' && p.name).map((p) => ({ name: String(p.name), style: normalizeStyle(p.style ?? {}) }))
      : [],
    publicList: raw.publicList === true,
    appMode: raw.appMode === true,
    api: String(raw.api ?? '/wp-json/genqr/v1/'),
    shortBase: String(raw.shortBase ?? ''),
  };
}
