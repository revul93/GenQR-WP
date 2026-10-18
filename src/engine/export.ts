import { canvasToBlob, svgToCanvas } from './raster';

/** Downloads are made in the browser; nothing is sent to the server. */

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'docx';

export const FORMATS: { id: ExportFormat; label: string; unit: 'px' | 'cm' }[] = [
  { id: 'png', label: 'PNG image', unit: 'px' },
  { id: 'jpg', label: 'JPG image', unit: 'px' },
  { id: 'svg', label: 'SVG (vector)', unit: 'px' },
  { id: 'pdf', label: 'PDF', unit: 'cm' },
  { id: 'docx', label: 'Word document', unit: 'cm' },
];

const CM_PER_INCH = 2.54;
const PRINT_DPI = 300;
const MAX_PX = 4096; // larger canvases fail on some phones

/** Re-renders the SVG at a given pixel size. */
export type SvgAtSize = (sizePx: number) => string;

/** Pixels for a printed size at print resolution. */
export const printPx = (cm: number) => Math.min(MAX_PX, Math.round((cm / CM_PER_INCH) * PRINT_DPI));

async function png(svgAt: SvgAtSize, px: number): Promise<Blob> {
  return canvasToBlob(await svgToCanvas(svgAt(px), px), 'image/png');
}

/**
 * `size` is pixels for png/jpg/svg and centimetres for pdf/docx (the printed size).
 * `background` is used for JPEG, which has no transparency.
 */
export async function exportQr(format: ExportFormat, svgAt: SvgAtSize, size: number, background: string): Promise<Blob> {
  switch (format) {
    case 'svg':
      return new Blob([svgAt(size)], { type: 'image/svg+xml' });
    case 'png':
      return png(svgAt, Math.min(MAX_PX, size));
    case 'jpg': {
      const px = Math.min(MAX_PX, size);
      return canvasToBlob(await svgToCanvas(svgAt(px), px, background), 'image/jpeg', 0.92);
    }
    case 'pdf': {
      // Loaded only when needed: the PDF and Word libraries are large.
      const { jsPDF } = await import('jspdf');
      const canvas = await svgToCanvas(svgAt(printPx(size)), printPx(size));
      const mm = size * 10;
      const doc = new jsPDF({ unit: 'mm', format: [mm, mm], orientation: 'portrait', compress: true });
      doc.setProperties({ title: 'QR code', creator: 'GenQR' });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, mm, mm, undefined, 'FAST');
      return doc.output('blob');
    }
    case 'docx': {
      const { Document, ImageRun, Packer, Paragraph } = await import('docx');
      const data = new Uint8Array(await (await png(svgAt, printPx(size))).arrayBuffer());
      const px = Math.round((size / CM_PER_INCH) * 96); // Word sizes images at 96 px per inch
      const doc = new Document({
        creator: 'GenQR',
        title: 'QR code',
        sections: [{ children: [new Paragraph({ children: [new ImageRun({ type: 'png', data, transformation: { width: px, height: px } })] })] }],
      });
      return Packer.toBlob(doc);
    }
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Prints the code at a set size (cm) from a hidden frame, without leaving the page. */
export function printQr(svg: string, sizeCm: number, caption: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>QR code</title><style>` +
      `@page{margin:15mm}body{margin:0;font-family:system-ui,sans-serif;text-align:center}` +
      `svg{width:${sizeCm}cm;height:${sizeCm}cm;display:block;margin:0 auto}p{font-size:10pt;color:#333;word-break:break-all}` +
      `</style></head><body>${svg}${caption ? `<p>${esc(caption)}</p>` : ''}</body></html>`,
  );
  doc.close();
  const win = frame.contentWindow!;
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', cleanup);
  // Give embedded logo images a moment to decode before printing.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 60_000);
  }, 250);
}
