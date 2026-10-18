import { describe, expect, it } from 'vitest';
import { renderSvg } from '../src/engine/render';
import { colourWarnings, DEFAULT_STYLE, normalizeStyle } from '../src/engine/style';
import { printPx } from '../src/engine/export';

describe('normalizeStyle', () => {
  it('fills defaults and rejects bad values', () => {
    const s = normalizeStyle({ foreground: 'red', moduleShape: 'stars', margin: 99, eyeColor: '#123456' });
    expect(s.foreground).toBe(DEFAULT_STYLE.foreground);
    expect(s.moduleShape).toBe('square');
    expect(s.margin).toBe(10);
    expect(s.eyeColor).toBe('#123456');
  });
});

describe('renderSvg', () => {
  const data = 'https://example.com/go/abc2345';

  it('renders a square SVG sized in modules plus margin', () => {
    const svg = renderSvg({ data, style: DEFAULT_STYLE, sizePx: 300 });
    const [, total] = svg.match(/viewBox="0 0 (\d+) \1"/) ?? [];
    expect(Number(total)).toBeGreaterThan(21 + 2 * DEFAULT_STYLE.margin - 1);
    expect(svg).toContain('width="300"');
    expect(svg).not.toContain('<image');
  });

  it('embeds the logo and uses the background plate', () => {
    const logo = 'data:image/png;base64,AAAA';
    const svg = renderSvg({ data, style: { ...DEFAULT_STYLE, background: '#fafafa' }, logoDataUri: logo });
    expect(svg).toContain(`href="${logo}"`);
    expect(svg).toContain('fill="#fafafa"');
  });

  it('fills modules with a gradient and keeps a separate corner colour', () => {
    const svg = renderSvg({ data, style: { ...DEFAULT_STYLE, gradient: { type: 'linear', color: '#ff0000', rotation: 90 }, eyeColor: '#00ff00' } });
    expect(svg).toContain('<linearGradient id="fg"');
    expect(svg).toContain('fill="url(#fg)"');
    expect(svg).toContain('<g fill="#00ff00"');
  });

  it('omits the background when transparent', () => {
    const svg = renderSvg({ data, style: { ...DEFAULT_STYLE, transparentBackground: true } });
    expect(svg).not.toMatch(/<rect[^>]*fill="#ffffff"/);
  });

  it('escapes attribute values in the logo URI', () => {
    const svg = renderSvg({ data, style: DEFAULT_STYLE, logoDataUri: 'data:x"><script>' });
    expect(svg).not.toContain('"><script>');
  });
});

describe('printPx', () => {
  it('converts centimetres to 300 dpi pixels, capped', () => {
    expect(printPx(2.54)).toBe(300);
    expect(printPx(100)).toBe(4096);
  });
});

describe('colourWarnings', () => {
  it('warns about light-on-dark and low contrast', () => {
    expect(colourWarnings(DEFAULT_STYLE)).toEqual([]);
    expect(colourWarnings({ ...DEFAULT_STYLE, foreground: '#ffffff', background: '#000000' })[0]).toMatch(/lighter than the background/);
    expect(colourWarnings({ ...DEFAULT_STYLE, foreground: '#dddddd' })[0]).toMatch(/low contrast/);
  });
});
