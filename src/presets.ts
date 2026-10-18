import type { QrStyle } from './engine/style';

/** A design the admin defines in Settings → Presets. */
export interface Preset {
  name: string;
  style: QrStyle;
}

/** The fields a preset sets; logo size and spacing stay as the visitor left them. */
const PRESET_KEYS = ['foreground', 'background', 'transparentBackground', 'gradient', 'eyeColor', 'moduleShape', 'eyeFrameShape', 'eyeBallShape'] as const;

export function applyPreset(current: QrStyle, preset: Preset): QrStyle {
  const next = { ...current };
  for (const k of PRESET_KEYS) (next as Record<string, unknown>)[k] = preset.style[k];
  return next;
}

export function matchesPreset(style: QrStyle, preset: Preset): boolean {
  return PRESET_KEYS.every((k) => JSON.stringify(style[k]) === JSON.stringify(preset.style[k]));
}

/** CSS background for a preset's swatch. */
export function swatch({ style: s }: Preset): string {
  if (!s.gradient) return s.foreground;
  return s.gradient.type === 'linear'
    ? `linear-gradient(${s.gradient.rotation}deg, ${s.foreground}, ${s.gradient.color})`
    : `radial-gradient(${s.foreground}, ${s.gradient.color})`;
}
