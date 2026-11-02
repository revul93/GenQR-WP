import { describe, expect, it } from 'vitest';
import { parseCsv, TEMPLATE_CSV, toImportRows } from '../src/importFile';

describe('parseCsv', () => {
  it('handles quotes, embedded commas, CRLF and a BOM', () => {
    expect(parseCsv('﻿url,title\r\n"https://a.com/x?y=1,2","Say ""hi"""\r\n')).toEqual([
      ['url', 'title'],
      ['https://a.com/x?y=1,2', 'Say "hi"'],
    ]);
  });

  it('detects semicolon separators (Excel in some regions)', () => {
    expect(parseCsv('url;title\nhttps://a.com;A')).toEqual([
      ['url', 'title'],
      ['https://a.com', 'A'],
    ]);
  });
});

describe('toImportRows', () => {
  it('maps columns by header names in any order', () => {
    const rows = toImportRows([
      ['Short link', 'Title', 'Destination URL'],
      ['Expo 2026', 'Brochure', 'https://example.com/b'],
    ]);
    expect(rows).toEqual([{ line: 2, url: 'https://example.com/b', title: 'Brochure', code: 'expo-2026', error: null }]);
  });

  it('reads "QR URL" as the short link, not the destination', () => {
    const rows = toImportRows([
      ['Title', 'QR URL', 'Destination URL'],
      ['Brochure', 'expo-2026', 'https://example.com/b'],
    ]);
    expect(rows).toEqual([{ line: 2, url: 'https://example.com/b', title: 'Brochure', code: 'expo-2026', error: null }]);
  });

  it('reads the download template', () => {
    const rows = toImportRows(parseCsv(TEMPLATE_CSV));
    expect(rows.map((r) => [r.url, r.code, r.error])).toEqual([
      ['https://www.example.com/brochure', 'brochure-2026', null],
      ['https://www.example.com/contact', '', null],
    ]);
  });

  it('assumes url, title, short link order without a header', () => {
    const [row] = toImportRows([['example.com/page', 'Page', '']]);
    expect(row).toMatchObject({ line: 1, url: 'example.com/page', title: 'Page', code: '', error: null });
  });

  it('flags bad rows and duplicate short links', () => {
    const rows = toImportRows([
      ['url', 'title', 'short_link'],
      ['https://a.com', 'A', 'same'],
      ['https://b.com', 'B', 'same'],
      ['not a url', 'C', ''],
      ['https://d.com', 'D', 'x'],
      ['', '', ''],
    ]);
    expect(rows.map((r) => r.error)).toEqual([null, 'Same QR URL as line 2.', 'Not a valid web address.', 'The QR URL must be 2–32 letters, numbers, dashes or underscores.']);
  });
});
