/** Visual style of a QR code. The admin sets the defaults; visitors can change them. */

export type ModuleShape = 'square' | 'rounded' | 'dots';
export type CornerShape = 'square' | 'rounded' | 'circle';

export interface QrStyle {
  foreground: string;
  background: string;
  transparentBackground: boolean;
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
