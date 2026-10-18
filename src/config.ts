import { normalizeStyle, type QrStyle } from './engine/style';

/** Settings the plugin writes into the page (data-config); see GenQR_Shortcode::client_config(). */
export interface Logo {
  id: number;
  name: string;
  url: string;
}

export interface ClientConfig {
  title: string;
  domains: string[];
  logos: Logo[];
  defaultLogo: number;
  style: QrStyle;
  api: string;
  shortBase: string;
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
    domains: Array.isArray(raw.domains) ? raw.domains.map(String) : [],
    logos: Array.isArray(raw.logos) ? (raw.logos as Logo[]) : [],
    defaultLogo: Number(raw.defaultLogo) || 0,
    style: normalizeStyle((raw.style as object) ?? {}),
    api: String(raw.api ?? '/wp-json/genqr/v1/'),
    shortBase: String(raw.shortBase ?? ''),
  };
}
