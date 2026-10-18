import type { QrStyle } from './engine/style';

/**
 * Colour presets taken from the rainbow ring logo. Every colour keeps at least 3:1 contrast
 * on white, so codes stay scannable. Applying a preset changes colours only.
 */
export interface Preset {
  name: string;
  colours: Pick<QrStyle, 'foreground' | 'gradient' | 'eyeColor'>;
}

export const PRESETS: Preset[] = [
  { name: 'Rainbow', colours: { foreground: '#d81b60', gradient: { type: 'linear', color: '#1e88e5', rotation: 45 }, eyeColor: '#6a1b9a' } },
  { name: 'Sunset', colours: { foreground: '#e53935', gradient: { type: 'linear', color: '#8e24aa', rotation: 45 }, eyeColor: '#b71c1c' } },
  { name: 'Ocean', colours: { foreground: '#00838f', gradient: { type: 'linear', color: '#1565c0', rotation: 45 }, eyeColor: '#0d47a1' } },
  { name: 'Forest', colours: { foreground: '#2e7d32', gradient: { type: 'linear', color: '#00838f', rotation: 45 }, eyeColor: '#1b5e20' } },
  { name: 'Royal', colours: { foreground: '#4527a0', gradient: { type: 'radial', color: '#c2185b', rotation: 45 }, eyeColor: '#4527a0' } },
  { name: 'Classic blue', colours: { foreground: '#0b5394', gradient: null, eyeColor: null } },
  { name: 'Black', colours: { foreground: '#000000', gradient: null, eyeColor: null } },
];

/** CSS background for a preset's swatch. */
export function swatch({ colours: c }: Preset): string {
  if (!c.gradient) return c.foreground;
  return c.gradient.type === 'linear'
    ? `linear-gradient(${c.gradient.rotation}deg, ${c.foreground}, ${c.gradient.color})`
    : `radial-gradient(${c.foreground}, ${c.gradient.color})`;
}
