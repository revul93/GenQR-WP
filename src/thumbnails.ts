import type { ClientConfig, Link } from './config';
import { linkDesign } from './design';
import { urlToDataUri } from './engine/raster';
import { renderSvg } from './engine/render';

/**
 * Fills the "QR code" column of the list (placeholders written by GenQR_Links_Table) with
 * each code drawn in its own design and logo.
 */
export async function drawThumbnails(config: ClientConfig) {
  const logos = new Map<number, Promise<string | null>>();
  const logoFor = (id: number) => {
    const logo = config.logos.find((l) => l.id === id);
    if (!logo) return Promise.resolve(null);
    if (!logos.has(id)) logos.set(id, urlToDataUri(logo.url).catch(() => null));
    return logos.get(id)!;
  };
  for (const el of document.querySelectorAll<HTMLElement>('.genqr-thumb[data-link]')) {
    try {
      const link = JSON.parse(el.dataset.link!) as Link;
      const { style, logoId } = linkDesign(link, config);
      const svg = renderSvg({ data: link.shortUrl, style, logoDataUri: await logoFor(logoId), sizePx: 128 });
      const img = new Image(64, 64);
      img.alt = '';
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      el.replaceChildren(img);
    } catch {
      // leave the grey placeholder
    }
  }
}
