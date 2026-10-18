import type { QrStyle } from './engine/style';
import type { Logo } from './config';

interface Props {
  style: QrStyle;
  onStyle: (s: QrStyle) => void;
  logos: Logo[];
  logo: number;
  onLogo: (id: number) => void;
}

const MODULES = [
  ['square', 'Square'],
  ['rounded', 'Rounded'],
  ['dots', 'Dots'],
] as const;
const CORNERS = [
  ['square', 'Square'],
  ['rounded', 'Rounded'],
  ['circle', 'Circle'],
] as const;

/** Colours, shapes and logo. */
export function Design({ style, onStyle, logos, logo, onLogo }: Props) {
  const set = <K extends keyof QrStyle>(key: K, value: QrStyle[K]) => onStyle({ ...style, [key]: value });
  const val = (e: Event) => (e.target as HTMLInputElement).value;

  return (
    <div class="design">
      <div class="row">
        <label>
          Code colour
          <input type="color" value={style.foreground} onInput={(e) => set('foreground', val(e))} />
        </label>
        <label>
          Background
          <input type="color" value={style.background} disabled={style.transparentBackground} onInput={(e) => set('background', val(e))} />
        </label>
        <label class="check">
          <input type="checkbox" checked={style.transparentBackground} onChange={(e) => set('transparentBackground', (e.target as HTMLInputElement).checked)} />
          Transparent
        </label>
      </div>
      <div class="row">
        <label>
          Pattern
          <select value={style.moduleShape} onChange={(e) => set('moduleShape', val(e) as QrStyle['moduleShape'])}>
            {MODULES.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Corner frame
          <select value={style.eyeFrameShape} onChange={(e) => set('eyeFrameShape', val(e) as QrStyle['eyeFrameShape'])}>
            {CORNERS.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Corner centre
          <select value={style.eyeBallShape} onChange={(e) => set('eyeBallShape', val(e) as QrStyle['eyeBallShape'])}>
            {CORNERS.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      {logos.length > 0 && (
        <fieldset class="logos">
          <legend>Logo</legend>
          <button type="button" class={logo === 0 ? 'logo selected' : 'logo'} aria-pressed={logo === 0} onClick={() => onLogo(0)}>
            None
          </button>
          {logos.map((l) => (
            <button
              type="button"
              key={l.id}
              class={logo === l.id ? 'logo selected' : 'logo'}
              aria-pressed={logo === l.id}
              title={l.name}
              onClick={() => onLogo(l.id)}
            >
              <img src={l.url} alt={l.name} />
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
