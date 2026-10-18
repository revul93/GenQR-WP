import { useEffect, useState } from 'preact/hooks';
import { download, exportQr, printQr, type ExportFormat, type SvgAtSize } from './engine/export';
import { loadPrefs, prefsLabel, savePrefs, useDownloadPrefs } from './downloadPrefs';
import { Alert, Button, Dialog, Field, Icon, Select } from './ui';

const FORMATS = [
  { value: 'png', label: 'PNG image', unit: 'px', sizes: [512, 1024, 2048, 4096], size: 1024 },
  { value: 'jpg', label: 'JPG image', unit: 'px', sizes: [512, 1024, 2048, 4096], size: 1024 },
  { value: 'svg', label: 'SVG vector (for designers and print shops)', unit: 'px', sizes: [512, 1024], size: 1024 },
  { value: 'pdf', label: 'PDF document', unit: 'cm', sizes: [2, 3, 5, 8, 10, 15, 20], size: 5 },
  { value: 'docx', label: 'Word document', unit: 'cm', sizes: [2, 3, 5, 8, 10, 15, 20], size: 5 },
] as const;

interface Props {
  open: boolean;
  onClose(): void;
  svgAt: SvgAtSize;
  background: string;
  filename: string;
}

/** Picks a format and size, then downloads the code (made in the browser). */
export function ExportDialog({ open, onClose, svgAt, background, filename }: Props) {
  const [format, setFormatState] = useState<ExportFormat>('png');
  const spec = FORMATS.find((f) => f.value === format)!;
  const [size, setSize] = useState<number>(spec.size);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opens on the last options used (PNG 1024 the first time).
  useEffect(() => {
    if (!open) return;
    setError(null);
    const p = loadPrefs();
    const f = FORMATS.find((x) => x.value === p.format)!;
    setFormatState(p.format);
    setSize((f.sizes as readonly number[]).includes(p.size) ? p.size : f.size);
  }, [open]);
  const setFormat = (f: ExportFormat) => {
    setFormatState(f);
    setSize(FORMATS.find((x) => x.value === f)!.size);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      download(await exportQr(format, svgAt, size, background), `${filename}.${format}`);
      savePrefs({ format, size });
      onClose();
    } catch (e) {
      setError((e as Error).message || 'The download failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Download"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            {busy ? 'Preparing…' : 'Download'}
          </Button>
        </>
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      <Select label="Format" value={format} onChange={(v) => setFormat(v as ExportFormat)} options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
      <Select
        label={spec.unit === 'cm' ? 'Printed size' : 'Image size'}
        value={size}
        onChange={setSize}
        options={spec.sizes.map((s) => ({ value: s, label: spec.unit === 'cm' ? `${s} × ${s} cm` : `${s} × ${s} px` }))}
      />
      <p class="caption">
        {spec.unit === 'cm'
          ? 'The page is exactly the size of the code, rendered at print resolution.'
          : 'For print, codes of at least 2 × 2 cm scan reliably; larger is better for distance scanning.'}
      </p>
    </Dialog>
  );
}

export function PrintDialog({ open, onClose, svgAt, defaultCaption }: { open: boolean; onClose(): void; svgAt: SvgAtSize; defaultCaption: string }) {
  const [cm, setCm] = useState(5);
  const [caption, setCaption] = useState(defaultCaption);
  useEffect(() => {
    if (open) setCaption(defaultCaption);
  }, [open, defaultCaption]);

  const print = () => {
    printQr(svgAt(1024), cm, caption.trim());
    onClose();
  };

  return (
    <Dialog
      open={open}
      title="Print"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={print}>
            Print
          </Button>
        </>
      }
    >
      <Select label="Printed size" value={cm} onChange={setCm} options={[2, 3, 4, 5, 8, 10, 15].map((s) => ({ value: s, label: `${s} × ${s} cm` }))} />
      <Field label="Caption under the code (optional)">
        {(id) => <input id={id} type="text" maxLength={120} value={caption} onInput={(e) => setCaption((e.target as HTMLInputElement).value)} />}
      </Field>
      <p class="caption">Set the printer to 100% / &quot;actual size&quot; so the code keeps its size.</p>
    </Dialog>
  );
}

/** One-click download with the last options used in the Download dialog (PNG 1024 px at first). */
export function QuickDownload({ svgAt, background, filename, disabled, title, size }: { svgAt: SvgAtSize; background: string; filename: string; disabled?: boolean; title?: string; size?: 'small' }) {
  const prefs = useDownloadPrefs();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      download(await exportQr(prefs.format, svgAt, prefs.size, background), `${filename}.${prefs.format}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outlined" size={size} icon="download" full={!size} disabled={disabled || busy} title={title || `Download as ${prefsLabel(prefs)}`} onClick={run}>
      {busy ? 'Preparing…' : prefsLabel(prefs)}
    </Button>
  );
}

/**
 * Compact split button for the "All QR codes" cards: one-click download with the remembered
 * options, plus a small button that opens the Download dialog.
 */
export function DownloadSplit({ svgAt, background, filename, onMore }: { svgAt: SvgAtSize; background: string; filename: string; onMore(): void }) {
  const prefs = useDownloadPrefs();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      download(await exportQr(prefs.format, svgAt, prefs.size, background), `${filename}.${prefs.format}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="split" role="group" aria-label="Download">
      <button type="button" class="split-main" onClick={run} disabled={busy} title={`Download as ${prefsLabel(prefs)}`}>
        <Icon name="download" />
        <span class="split-text">{busy ? 'Preparing…' : 'Download'}</span>
        {!busy && <span class="split-meta">{prefsLabel(prefs)}</span>}
      </button>
      <button type="button" class="split-more" onClick={onMore} title="Other formats and sizes" aria-label="Other formats and sizes">
        <Icon name="tune" />
      </button>
    </div>
  );
}
