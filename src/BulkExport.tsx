import { useEffect, useState } from 'preact/hooks';
import { api, fileName, type ClientConfig, type Link } from './config';
import { linkDesign } from './design';
import { pdfSheet, zipCodes, type BulkItem } from './engine/bulk';
import { download, type ExportFormat } from './engine/export';
import { urlToDataUri } from './engine/raster';
import { renderSvg } from './engine/render';
import { Alert, Button, Check, Dialog, Select, ToggleGroup } from './ui';

const FORMATS = [
  { value: 'png', label: 'PNG images', unit: 'px', sizes: [512, 1024, 2048], size: 1024 },
  { value: 'svg', label: 'SVG vector files (for designers and print shops)', unit: 'px', sizes: [1024], size: 1024 },
  { value: 'jpg', label: 'JPG images', unit: 'px', sizes: [512, 1024, 2048], size: 1024 },
  { value: 'pdf', label: 'PDF files (one per code)', unit: 'cm', sizes: [2, 3, 5, 8, 10], size: 5 },
] as const;

/** Builds exportable items, each in its own stored design (logos loaded once). */
async function toItems(config: ClientConfig, links: Link[]): Promise<BulkItem[]> {
  const logos = new Map<number, string | null>();
  const logoFor = async (id: number) => {
    if (!id) return null;
    if (!logos.has(id)) {
      const logo = config.logos.find((l) => l.id === id);
      logos.set(id, logo ? await urlToDataUri(logo.url).catch(() => null) : null);
    }
    return logos.get(id)!;
  };
  const items: BulkItem[] = [];
  for (const link of links) {
    const { style, logoId } = linkDesign(link, config);
    const logoDataUri = await logoFor(logoId);
    items.push({
      svgAt: (sizePx) => renderSvg({ data: link.shortUrl, style, logoDataUri, sizePx }),
      background: style.transparentBackground ? '#ffffff' : style.background,
      title: link.title,
      shortUrl: link.shortUrl,
      destination: link.destination,
      name: fileName(link.title, link.code),
    });
  }
  return items;
}

/** Fetches links by id, or all of them, from the REST API (paged). */
export async function loadLinks(config: ClientConfig, ids: number[] | 'all'): Promise<Link[]> {
  const out: Link[] = [];
  const query = ids === 'all' ? '' : `&ids=${ids.join(',')}`;
  for (let page = 1; ; page++) {
    const r = await api<{ items: Link[]; pages: number }>(config, `links?page=${page}${query}`);
    out.push(...r.items);
    if (page >= r.pages) return out;
  }
}

interface Props {
  config: ClientConfig;
  links: Link[] | null;
  onClose(): void;
}

/** "Export QR codes": a ZIP of image files, or a printable A4 sheet. */
export function BulkExportDialog({ config, links, onClose }: Props) {
  const [kind, setKind] = useState<'zip' | 'sheet'>('zip');
  const [format, setFormatState] = useState<ExportFormat>('png');
  const spec = FORMATS.find((f) => f.value === format)!;
  const [size, setSize] = useState<number>(spec.size);
  const [columns, setColumns] = useState(4);
  const [showTitle, setShowTitle] = useState(true);
  const [showLink, setShowLink] = useState(true);
  const [cutGuides, setCutGuides] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = !!links;
  const count = links?.length ?? 0;

  useEffect(() => {
    if (open) {
      setError(null);
      setProgress(null);
    }
  }, [open]);

  const setFormat = (f: ExportFormat) => {
    setFormatState(f);
    setSize(FORMATS.find((x) => x.value === f)!.size);
  };

  async function run() {
    if (!links?.length) return;
    setError(null);
    setProgress({ done: 0, total: links.length });
    try {
      const items = await toItems(config, links);
      const onProgress = (done: number, total: number) => setProgress({ done, total });
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'zip') {
        download(await zipCodes(items, format, size, onProgress), `qr-codes-${stamp}.zip`);
      } else {
        download(await pdfSheet(items, { columns, showTitle, showLink, cutGuides }, onProgress), `qr-codes-${stamp}.pdf`);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message || 'The export failed.');
    } finally {
      setProgress(null);
    }
  }

  const busy = !!progress;
  return (
    <Dialog
      open={open}
      title={`Export ${count} QR code${count === 1 ? '' : 's'}`}
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" icon="download" onClick={run} disabled={busy || !count}>
            {busy ? `Preparing ${progress!.done} of ${progress!.total}…` : 'Export'}
          </Button>
        </>
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      <ToggleGroup
        value={kind}
        onChange={(v) => setKind(v)}
        options={[
          { value: 'zip', label: 'ZIP of files' },
          { value: 'sheet', label: 'Printable sheet' },
        ]}
      />
      {kind === 'zip' ? (
        <>
          <Select label="Format" value={format} onChange={(v) => setFormat(v as ExportFormat)} options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
          {spec.sizes.length > 1 && (
            <Select
              label={spec.unit === 'cm' ? 'Printed size' : 'Image size'}
              value={size}
              onChange={setSize}
              options={spec.sizes.map((s) => ({ value: s, label: spec.unit === 'cm' ? `${s} × ${s} cm` : `${s} × ${s} px` }))}
            />
          )}
          <p class="caption">One file per QR code, named by its title (or short link), plus index.csv listing every file with its short link and destination.</p>
        </>
      ) : (
        <>
          <Select
            label="Codes per row (A4)"
            value={columns}
            onChange={setColumns}
            options={[2, 3, 4, 5].map((c) => ({ value: c, label: `${c} per row — about ${Math.round((186 - (c - 1) * 6) / c / 10)} cm wide` }))}
          />
          <Check label="Title under each code" checked={showTitle} onChange={setShowTitle} />
          <Check label="Short link under each code" checked={showLink} onChange={setShowLink} />
          <Check label="Dashed cut lines" checked={cutGuides} onChange={setCutGuides} />
          <p class="caption">Print at 100% / "actual size" so the codes keep their size.</p>
        </>
      )}
      {busy && (
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress!.total} aria-valuenow={progress!.done}>
          <span style={{ width: `${(100 * progress!.done) / Math.max(1, progress!.total)}%` }} />
        </div>
      )}
    </Dialog>
  );
}

/**
 * On the QR codes list: "Export all QR codes" and the "Export QR codes" bulk action
 * (both handled here, in the browser) open the export dialog.
 */
export function ListExport({ config }: { config: ClientConfig }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = async (ids: number[] | 'all') => {
      setError(null);
      setLoading(true);
      try {
        const loaded = await loadLinks(config, ids);
        if (!loaded.length) throw new Error('There are no QR codes to export yet.');
        setLinks(loaded);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    const all = document.getElementById('genqr-export-all');
    const onAll = () => start('all');
    all?.addEventListener('click', onAll);

    const form = document.getElementById('genqr-list-form') as HTMLFormElement | null;
    const onSubmit = (e: SubmitEvent) => {
      const submitter = e.submitter as HTMLInputElement | null;
      const select = form!.querySelector<HTMLSelectElement>(submitter?.id === 'doaction2' ? 'select[name="action2"]' : 'select[name="action"]');
      if (select?.value !== 'export_qr') return;
      e.preventDefault();
      const ids = [...form!.querySelectorAll<HTMLInputElement>('input[name="ids[]"]:checked')].map((c) => Number(c.value));
      if (!ids.length) {
        setError('Tick the QR codes to export first, or use "Export all QR codes".');
        return;
      }
      start(ids);
    };
    form?.addEventListener('submit', onSubmit);
    return () => {
      all?.removeEventListener('click', onAll);
      form?.removeEventListener('submit', onSubmit);
    };
  }, []);

  return (
    <>
      {loading && <p class="caption">Loading QR codes…</p>}
      {error && (
        <Alert severity="warning" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <BulkExportDialog config={config} links={links} onClose={() => setLinks(null)} />
    </>
  );
}
