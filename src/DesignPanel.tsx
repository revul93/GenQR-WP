import { useState } from 'preact/hooks';
import type { ClientConfig } from './config';
import type { QrStyle } from './engine/style';
import { applyPreset, matchesPreset, swatch } from './presets';
import { Check, ColourField, Icon, Section, Select, Slider, ToggleGroup } from './ui';

const MODULES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
] as const;
const CORNERS = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
] as const;

interface Props {
  config: ClientConfig;
  style: QrStyle;
  setStyle(update: (s: QrStyle) => QrStyle): void;
  logoId: number;
  setLogoId(id: number): void;
}

/** Presets, then colours, shapes, logo and error correction under a collapsed "Advanced". */
export function DesignPanel({ config, style, setStyle, logoId, setLogoId }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const patch = (p: Partial<QrStyle>) => setStyle((s) => ({ ...s, ...p }));
  const hasLogo = logoId !== 0;

  return (
    <>
      {config.presets.length > 0 && (
        <Section title="Presets">
          <div class="preset-grid" role="radiogroup" aria-label="Presets">
            {config.presets.map((p) => {
              const on = matchesPreset(style, p);
              return (
                <button key={p.name} type="button" role="radio" aria-checked={on} class={on ? 'preset selected' : 'preset'} onClick={() => setStyle((st) => applyPreset(st, p))}>
                  <span class="swatch big" style={{ background: swatch(p) }} />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {config.logos.length > 0 && (
        <Section title="Logo">
          <div class="row tiles">
            <button type="button" class={!hasLogo ? 'tile selected' : 'tile'} title="No logo" aria-label="No logo" aria-pressed={!hasLogo} onClick={() => setLogoId(0)}>
              <Icon name="block" class="muted" />
            </button>
            {config.logos.map((l) => (
              <button type="button" key={l.id} class={logoId === l.id ? 'tile selected' : 'tile'} title={l.name} aria-label={l.name} aria-pressed={logoId === l.id} onClick={() => setLogoId(l.id)}>
                <img src={l.url} alt="" />
              </button>
            ))}
          </div>
        </Section>
      )}

      <button type="button" class="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>
        <Icon name={advanced ? 'less' : 'more'} />
        Advanced{advanced ? '' : ': colours, shapes, logo size and error correction'}
      </button>

      {advanced && (
        <>
          <Section title="Colours">
            <div class="row">
              <ColourField label="Code colour" value={style.foreground} onChange={(v) => patch({ foreground: v })} />
              <ColourField label="Background" value={style.background} disabled={style.transparentBackground} onChange={(v) => patch({ background: v })} />
              <Check label="Transparent background" checked={style.transparentBackground} onChange={(v) => patch({ transparentBackground: v })} />
            </div>
            <div class="row">
              <Select
                label="Gradient"
                width={160}
                value={style.gradient?.type ?? 'none'}
                onChange={(v) => patch({ gradient: v === 'none' ? null : { type: v as 'linear' | 'radial', color: style.gradient?.color ?? '#2563eb', rotation: style.gradient?.rotation ?? 45 } })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'linear', label: 'Linear' },
                  { value: 'radial', label: 'Radial' },
                ]}
              />
              {style.gradient && (
                <>
                  <ColourField label="Gradient to" value={style.gradient.color} onChange={(v) => patch({ gradient: { ...style.gradient!, color: v } })} />
                  {style.gradient.type === 'linear' && (
                    <Slider
                      caption={`Angle: ${style.gradient.rotation}°`}
                      width={180}
                      min={0}
                      max={360}
                      step={15}
                      value={style.gradient.rotation}
                      onChange={(v) => patch({ gradient: { ...style.gradient!, rotation: v } })}
                    />
                  )}
                </>
              )}
            </div>
            <div class="row">
              <Check switchStyle label="Different colour for the corners" checked={style.eyeColor != null} onChange={(on) => patch({ eyeColor: on ? style.foreground : null })} />
              {style.eyeColor != null && <ColourField label="Corner colour" value={style.eyeColor} onChange={(v) => patch({ eyeColor: v })} />}
            </div>
          </Section>

          <Section title="Shapes">
            <ToggleGroup label="Pattern" value={style.moduleShape} options={[...MODULES]} onChange={(v) => patch({ moduleShape: v })} />
            <ToggleGroup label="Corner frame" value={style.eyeFrameShape} options={[...CORNERS]} onChange={(v) => patch({ eyeFrameShape: v })} />
            <ToggleGroup label="Corner centre" value={style.eyeBallShape} options={[...CORNERS]} onChange={(v) => patch({ eyeBallShape: v })} />
          </Section>

          <Section title="Size and error correction">
            {hasLogo && (
              <div class="row">
                <Slider caption={`Logo size: ${style.logoSizePercent}% of the code`} min={10} max={30} value={style.logoSizePercent} onChange={(v) => patch({ logoSizePercent: v })} />
                <Check label="Clear space around the logo" checked={style.logoBacking} onChange={(v) => patch({ logoBacking: v })} />
              </div>
            )}
            <div class="row">
              <Select
                label="Error correction"
                width={260}
                value={hasLogo ? 'H' : style.errorCorrection}
                disabled={hasLogo}
                onChange={(v) => patch({ errorCorrection: v as QrStyle['errorCorrection'] })}
                helper={hasLogo ? 'With a logo the code always uses High, so it still scans with its centre covered.' : 'Higher survives damage better but makes a denser code.'}
                options={[
                  { value: 'L', label: 'Low (7%)' },
                  { value: 'M', label: 'Medium (15%)' },
                  { value: 'Q', label: 'Quartile (25%)' },
                  { value: 'H', label: 'High (30%)' },
                ]}
              />
              <Slider caption={`Margin: ${style.margin} modules ${style.margin < 2 ? '(may be hard to scan)' : ''}`} min={0} max={10} value={style.margin} onChange={(v) => patch({ margin: v })} />
            </div>
          </Section>
        </>
      )}
    </>
  );
}
