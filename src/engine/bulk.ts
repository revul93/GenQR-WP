import { exportQr, printPx, type ExportFormat, type SvgAtSize } from './export';
import { svgToImage } from './raster';

/** One QR code to export in bulk. */
export interface BulkItem {
  svgAt: SvgAtSize;
  background: string;
  title: string;
  shortUrl: string;
  destination: string;
  /** Base file name (no extension). */
  name: string;
}

export type Progress = (done: number, total: number) => void;

const csvCell = (v: string) => {
  // Spreadsheets would run cells starting with = + - @ as formulas.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Gives every item a unique file name: "Brochure", "Brochure-2", … */
function uniqueNames(items: BulkItem[]): string[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const key = it.name.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? it.name : `${it.name}-${n}`;
  });
}

/** A ZIP with one file per code (any download format) plus index.csv. */
export async function zipCodes(items: BulkItem[], format: ExportFormat, size: number, onProgress: Progress): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const names = uniqueNames(items);
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const rows = ['file,title,short_link,destination'];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const file = `${names[i]}.${format}`;
    const data = new Uint8Array(await (await exportQr(format, it.svgAt, size, it.background)).arrayBuffer());
    // PNG, JPG, PDF and Word are already compressed: store them as they are.
    files[file] = format === 'svg' ? data : [data, { level: 0 }];
    rows.push([file, it.title, it.shortUrl, it.destination].map(csvCell).join(','));
    onProgress(i + 1, items.length);
  }
  files['index.csv'] = strToU8('﻿' + rows.join('\r\n') + '\r\n'); // BOM so Excel reads UTF-8
  return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' });
}

export interface SheetOptions {
  /** Codes per row on an A4 page. */
  columns: number;
  showTitle: boolean;
  showLink: boolean;
  cutGuides: boolean;
}

const PAGE = { w: 210, h: 297, margin: 12, gap: 6 }; // mm

/** Ellipsises text to fit a width on a canvas. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > width) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Draws one sheet cell (code plus caption) on a canvas. Text is drawn by the browser so
 * every script, Arabic included, renders correctly in the PDF.
 */
async function cellImage(it: BulkItem, qrMm: number, textMm: number, opts: SheetOptions): Promise<string> {
  const pxPerMm = printPx(2.54) / 25.4; // print resolution
  const qrPx = Math.round(qrMm * pxPerMm);
  const textPx = Math.round(textMm * pxPerMm);
  const canvas = document.createElement('canvas');
  canvas.width = qrPx;
  canvas.height = qrPx + textPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(await svgToImage(it.svgAt(qrPx)), 0, 0, qrPx, qrPx);
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const font = 'system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif';
  let y = qrPx + Math.round(1 * pxPerMm); // captions go under the code
  if (opts.showTitle && it.title) {
    const size = Math.round(3.4 * pxPerMm);
    ctx.font = `600 ${size}px ${font}`;
    ctx.direction = /[֐-ࣿ]/.test(it.title) ? 'rtl' : 'ltr';
    ctx.fillText(fit(ctx, it.title, qrPx), qrPx / 2, y);
    y += Math.round(size * 1.3);
  }
  if (opts.showLink) {
    const size = Math.round(2.6 * pxPerMm);
    ctx.font = `${size}px ${font}`;
    ctx.direction = 'ltr';
    ctx.fillStyle = '#444444';
    ctx.fillText(fit(ctx, it.shortUrl.replace(/^https?:\/\//, ''), qrPx), qrPx / 2, y);
  }
  return canvas.toDataURL('image/png');
}

/** A4 PDF with a grid of codes, each with its title and short link underneath. */
export async function pdfSheet(items: BulkItem[], opts: SheetOptions, onProgress: Progress): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'QR codes', creator: 'GenQR' });
  const usable = PAGE.w - 2 * PAGE.margin;
  const cellW = (usable - (opts.columns - 1) * PAGE.gap) / opts.columns;
  const textMm = (opts.showTitle ? 5.5 : 0) + (opts.showLink ? 4 : 0) + (opts.showTitle || opts.showLink ? 1.5 : 0);
  const cellH = cellW + textMm;
  const rows = Math.max(1, Math.floor((PAGE.h - 2 * PAGE.margin + PAGE.gap) / (cellH + PAGE.gap)));
  const perPage = rows * opts.columns;

  for (let i = 0; i < items.length; i++) {
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();
    const x = PAGE.margin + (slot % opts.columns) * (cellW + PAGE.gap);
    const y = PAGE.margin + Math.floor(slot / opts.columns) * (cellH + PAGE.gap);
    doc.addImage(await cellImage(items[i]!, cellW, textMm, opts), 'PNG', x, y, cellW, cellH, undefined, 'FAST');
    if (opts.cutGuides) {
      doc.setDrawColor(190);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.rect(x - PAGE.gap / 2, y - PAGE.gap / 2, cellW + PAGE.gap, cellH + PAGE.gap);
    }
    onProgress(i + 1, items.length);
  }
  return doc.output('blob');
}
