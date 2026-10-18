import { useEffect, useMemo, useState } from 'preact/hooks';
import { renderSvg } from './engine/render';
import { scanCheck } from './engine/scan';
import { urlToDataUri } from './engine/raster';
import type { QrStyle } from './engine/style';
import type { Logo } from './config';

const logoCache = new Map<number, Promise<string>>();

/** The selected admin logo as a data URI (null while loading or when none is chosen). */
export function useLogo(logos: Logo[], id: number): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    const logo = logos.find((l) => l.id === id);
    setUri(null);
    if (!logo) return;
    let current = true;
    if (!logoCache.has(id)) logoCache.set(id, urlToDataUri(logo.url));
    logoCache.get(id)!.then(
      (u) => current && setUri(u),
      () => logoCache.delete(id),
    );
    return () => {
      current = false;
    };
  }, [logos, id]);
  return uri;
}

export type ScanState = 'checking' | 'ok' | 'fail';

/** Renders the code and checks it can be read back whenever the content or design changes. */
export function useQr(data: string, style: QrStyle, logo: string | null) {
  const svgAt = useMemo(() => (sizePx: number) => renderSvg({ data, style, logoDataUri: logo, sizePx }), [data, style, logo]);
  const svg = useMemo(() => (data ? svgAt(512) : ''), [data, svgAt]);
  const [scan, setScan] = useState<ScanState>('checking');
  useEffect(() => {
    if (!svg) return;
    setScan('checking');
    let current = true;
    const t = setTimeout(() => {
      scanCheck(svg, data).then(
        (ok) => current && setScan(ok ? 'ok' : 'fail'),
        () => current && setScan('fail'),
      );
    }, 250);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [svg, data]);
  return { svg, svgAt, scan };
}
