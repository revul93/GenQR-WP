import { useState } from 'preact/hooks';
import { download, exportQr, FORMATS, printQr, type ExportFormat, type SvgAtSize } from './engine/export';

interface Props {
  svgAt: SvgAtSize;
  background: string;
  filename: string;
  caption: string;
}

const DEFAULT_SIZE = { px: 1024, cm: 5 };

/** Format + size picker with Download and Print buttons. */
export function Downloads({ svgAt, background, filename, caption }: Props) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const unit = FORMATS.find((f) => f.id === format)!.unit;
  const [sizes, setSizes] = useState(DEFAULT_SIZE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const size = sizes[unit];
  const limits = unit === 'px' ? { min: 128, max: 4096, step: 64 } : { min: 1, max: 30, step: 0.5 };

  async function save() {
    setBusy(true);
    setError('');
    try {
      const value = Math.min(limits.max, Math.max(limits.min, size || limits.min));
      download(await exportQr(format, svgAt, value, background), `${filename}.${format}`);
    } catch (e) {
      setError((e as Error).message || 'The download failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="downloads">
      <div class="row">
        <label>
          Format
          <select value={format} onChange={(e) => setFormat((e.target as HTMLSelectElement).value as ExportFormat)}>
            {FORMATS.map((f) => (
              <option value={f.id} key={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {unit === 'px' ? 'Size (pixels)' : 'Printed size (cm)'}
          <input
            type="number"
            min={limits.min}
            max={limits.max}
            step={limits.step}
            value={size}
            onInput={(e) => setSizes({ ...sizes, [unit]: Number((e.target as HTMLInputElement).value) })}
          />
        </label>
      </div>
      <div class="row">
        <button type="button" class="primary" onClick={save} disabled={busy}>
          {busy ? 'Preparing…' : 'Download'}
        </button>
        <button type="button" onClick={() => printQr(svgAt(512), sizes.cm, caption)}>
          Print ({sizes.cm} cm)
        </button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}
