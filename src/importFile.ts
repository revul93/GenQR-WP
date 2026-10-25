import { cleanCode } from './design';

/** One row from an import file, after checking. */
export interface ImportRow {
  /** Row number in the file (1-based, header included), for messages. */
  line: number;
  url: string;
  title: string;
  code: string;
  /** Why the row will be skipped, if it will. */
  error: string | null;
}

export const MAX_ROWS = 2000;

export const TEMPLATE_CSV = '﻿url,title,short_link\r\nhttps://www.example.com/brochure,Product brochure,brochure-2026\r\nhttps://www.example.com/contact,Contact us,\r\n';

const CODE = /^[a-z0-9][a-z0-9_-]{0,30}[a-z0-9]$/;

/** Splits CSV text into rows of cells. Handles quotes, and comma, semicolon or tab separators. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best), ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Reads a .csv or .xlsx file into rows of cells. */
export async function readFile(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    const rows = await readSheet(file); // the first sheet
    return rows.map((r) => r.map((c) => (c == null ? '' : c instanceof Date ? c.toISOString() : String(c))));
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error('Old Excel files (.xls) are not supported. In Excel, use File → Save As → "Excel Workbook (.xlsx)" or "CSV UTF-8".');
  }
  return parseCsv(await file.text());
}

const looksLikeUrl = (v: string) => /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}/i.test(v.trim());

/**
 * Finds the URL, title and short link columns: from a header row if there is one,
 * otherwise in that order. Then checks every row.
 */
export function toImportRows(cells: string[][]): ImportRow[] {
  const nonEmpty = cells.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0]!.map((c) => c.trim().toLowerCase());
  const find = (re: RegExp, not?: RegExp) => header.findIndex((h) => re.test(h) && !(not && not.test(h)));
  let col = { url: find(/url|link|destination|address|website|رابط|عنوان/, /short|code/), title: find(/title|name|label|description|اسم/), code: find(/short|code|slug|alias|text/) };
  const hasHeader = col.url >= 0 && !looksLikeUrl(nonEmpty[0]![col.url] ?? '');
  if (!hasHeader) col = { url: 0, title: 1, code: 2 };

  const seen = new Map<string, number>();
  const firstLine = cells.indexOf(nonEmpty[0]!) + 1;
  return nonEmpty.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + MAX_ROWS).map((r) => {
    const line = cells.indexOf(r) + 1 || firstLine;
    const url = (r[col.url] ?? '').trim();
    const title = col.title >= 0 ? (r[col.title] ?? '').trim().slice(0, 120) : '';
    const rawCode = col.code >= 0 ? (r[col.code] ?? '').trim() : '';
    const code = cleanCode(rawCode);
    let error: string | null = null;
    if (!url) error = 'No link (URL).';
    else if (!looksLikeUrl(url)) error = 'Not a valid web address.';
    else if (code && !CODE.test(code)) error = 'Short link text must be 2–32 letters, numbers, dashes or underscores.';
    else if (code && seen.has(code)) error = `Same short link as line ${seen.get(code)}.`;
    if (code && !seen.has(code)) seen.set(code, line);
    return { line, url, title, code, error };
  });
}
