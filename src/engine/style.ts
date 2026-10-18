/** Visual style of a QR code. The admin sets the defaults; visitors can change them. */

export type ModuleShape = 'square' | 'rounded' | 'dots';
export type CornerShape = 'square' | 'rounded' | 'circle';

export interface Gradient {
  type: 'linear' | 'radial';
  color: string; // second colour; the first is `foreground`
  rotation: number; // linear only, degrees
}

export interface QrStyle {
  foreground: string;
  background: string;
  transparentBackground: boolean;
  gradient: Gradient | null;
  moduleShape: ModuleShape;
  eyeFrameShape: CornerShape;
  eyeBallShape: CornerShape;
  eyeColor: string | null; // null = same as the modules
  margin: number; // quiet zone, in modules
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  logoSizePercent: number;
  logoBacking: boolean; // background-coloured plate behind the logo
}

export const DEFAULT_STYLE: QrStyle = {
  foreground: '#000000',
  background: '#ffffff',
  transparentBackground: false,
  gradient: null,
  moduleShape: 'square',
  eyeFrameShape: 'square',
  eyeBallShape: 'square',
  eyeColor: null,
  margin: 4,
  errorCorrection: 'M',
  logoSizePercent: 22,
  logoBacking: true,
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Fills missing or invalid fields with defaults (input comes from the page or the user). */
export function normalizeStyle(input: Partial<Record<keyof QrStyle, unknown>> = {}): QrStyle {
  const d = DEFAULT_STYLE;
  const shapes = ['square', 'rounded', 'circle'] as const;
  return {
    foreground: HEX.test(String(input.foreground)) ? String(input.foreground) : d.foreground,
    background: HEX.test(String(input.background)) ? String(input.background) : d.background,
    transparentBackground: input.transparentBackground === true,
    gradient: normalizeGradient(input.gradient),
    moduleShape: pick(input.moduleShape, ['square', 'rounded', 'dots'] as const, d.moduleShape),
    eyeFrameShape: pick(input.eyeFrameShape, shapes, d.eyeFrameShape),
    eyeBallShape: pick(input.eyeBallShape, shapes, d.eyeBallShape),
    eyeColor: HEX.test(String(input.eyeColor)) ? String(input.eyeColor) : null,
    margin: Math.round(num(input.margin, 0, 10, d.margin)),
    errorCorrection: pick(input.errorCorrection, ['L', 'M', 'Q', 'H'] as const, d.errorCorrection),
    logoSizePercent: num(input.logoSizePercent, 10, 30, d.logoSizePercent),
    logoBacking: input.logoBacking !== false,
  };
}

function normalizeGradient(value: unknown): Gradient | null {
  if (!value || typeof value !== 'object') return null;
  const g = value as Record<string, unknown>;
  if (g.type !== 'linear' && g.type !== 'radial') return null;
  if (!HEX.test(String(g.color))) return null;
  return { type: g.type, color: String(g.color), rotation: num(g.rotation, 0, 360, 45) };
}

// WCAG relative luminance / contrast, used to warn about hard-to-scan colour choices.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

/** Human-readable warnings about colours that scanners may struggle with. */
export function colourWarnings(style: QrStyle): string[] {
  const bg = style.transparentBackground ? '#ffffff' : style.background;
  const warnings: string[] = [];
  const check = (colour: string, what: string) => {
    if (luminance(colour) > luminance(bg)) warnings.push(`The ${what} is lighter than the background. Many scanners need dark-on-light codes.`);
    else if (contrast(colour, bg) < 3) warnings.push(`The ${what} has low contrast against the background (${contrast(colour, bg).toFixed(1)}:1). Aim for at least 3:1.`);
  };
  check(style.foreground, 'code colour');
  if (style.gradient) check(style.gradient.color, 'gradient end colour');
  if (style.eyeColor) check(style.eyeColor, 'corner (eye) colour');
  if (style.transparentBackground) warnings.push('Transparent codes rely on whatever they are printed on; make sure that surface is light.');
  return warnings;
}
