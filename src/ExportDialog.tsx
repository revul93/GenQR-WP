import { useEffect, useState } from 'preact/hooks';
import { download, exportQr, printQr, type ExportFormat, type SvgAtSize } from './engine/export';
import { Alert, Button, Dialog, Field, Select } from './ui';

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
  const [format, setFormat] = useState<ExportFormat>('png');
  const spec = FORMATS.find((f) => f.value === format)!;
  const [size, setSize] = useState<number>(spec.size);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  useEffect(() => setSize(FORMATS.find((f) => f.value === format)!.size), [format]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      download(await exportQr(format, svgAt, size, background), `${filename}.${format}`);
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
