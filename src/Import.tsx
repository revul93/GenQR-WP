import { useMemo, useState } from 'preact/hooks';
import { BulkExportDialog } from './BulkExport';
import { api, type ClientConfig, type Link } from './config';
import { validLogo } from './design';
import { DesignPanel } from './DesignPanel';
import { download } from './engine/export';
import type { QrStyle } from './engine/style';
import { MAX_ROWS, readFile, TEMPLATE_CSV, toImportRows, type ImportRow } from './importFile';
import { Alert, Button, Icon, Section } from './ui';
import { useLogo, useQr } from './useQr';

const BATCH = 50;

type Result = { ok: true; link: Link } | { ok: false; error: string };

/** Import QR codes from a CSV or Excel file: check, choose a design, create, export. */
export function Import({ config }: { config: ClientConfig }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [style, setStyle] = useState<QrStyle>(config.style);
  const [logoId, setLogoId] = useState(validLogo(config, config.defaultLogo));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Map<number, Result> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<Link[] | null>(null);

  const valid = useMemo(() => (rows ?? []).filter((r) => !r.error), [rows]);
  const sample = config.shortBase + (valid[0]?.code || 'xxxxxxx');
  const logo = useLogo(config.logos, logoId);
  const { svg } = useQr(sample, style, logo);
  const created = useMemo(() => [...(results?.values() ?? [])].flatMap((r) => (r.ok ? [r.link] : [])), [results]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    setResults(null);
    setRows(null);
    setFileName(file.name);
    try {
      const parsed = toImportRows(await readFile(file));
      if (!parsed.length) throw new Error('The file has no rows. Use the template: one row per QR code with the link in the first column.');
      setRows(parsed);
    } catch (e) {
      setReadError((e as Error).message || 'Could not read the file.');
    }
  }

  async function run() {
    if (!valid.length) return;
    setRunError(null);
    const out = new Map<number, Result>();
    setProgress({ done: 0, total: valid.length });
    try {
      for (let i = 0; i < valid.length; i += BATCH) {
        const batch = valid.slice(i, i + BATCH);
        const r = await api<{ results: Result[] }>(config, 'links/import', {
          rows: batch.map(({ url, title, code }) => ({ url, title, code })),
          style,
          logoId,
        });
        r.results.forEach((res, j) => out.set(batch[j]!.line, res));
        setResults(new Map(out));
        setProgress({ done: Math.min(i + BATCH, valid.length), total: valid.length });
      }
    } catch (e) {
      setRunError(`${(e as Error).message} Rows not yet imported are marked below; import the file again to retry them.`);
    } finally {
      setProgress(null);
      setResults(new Map(out));
    }
  }

  const done = !!results && !progress;
  const failed = results ? [...results.values()].filter((r) => !r.ok).length : 0;

  return (
    <div class="genqr">
      <Section title="1. Choose a file">
        <p class="body2">
          One row per QR code: the <strong>link</strong> (required), a <strong>title</strong> and the <strong>short link text</strong> after <span class="mono">/{config.shortBase.split('/').filter(Boolean).pop()}/</span> (both optional; empty gives a random code). Excel files (.xlsx) and CSV are accepted, up to {MAX_ROWS} rows.
        </p>
        <div class="row">
          <label class="btn contained file-btn">
            <Icon name="upload" />
            Choose file…
            <input type="file" accept=".csv,.txt,.xlsx" onChange={(e) => onFile((e.target as HTMLInputElement).files?.[0])} />
          </label>
          <Button variant="outlined" icon="doc" onClick={() => download(new Blob([TEMPLATE_CSV], { type: 'text/csv' }), 'qr-import-template.csv')}>
            Download template
          </Button>
          {fileName && <span class="caption">{fileName}</span>}
        </div>
        {readError && <Alert severity="error">{readError}</Alert>}
      </Section>

      {rows && (
        <Section title={`2. Check the rows (${valid.length} of ${rows.length} ready)`}>
          {rows.length - valid.length > 0 && <Alert severity="warning">{rows.length - valid.length} rows have problems and will be skipped. Fix them in the file and choose it again, or import the rest now.</Alert>}
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Title</th>
                  <th>Link</th>
                  <th>Short link</th>
                  <th>{results ? 'Result' : 'Check'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const res = results?.get(r.line);
                  return (
                    <tr key={r.line} class={r.error || (res && !res.ok) ? 'bad' : res?.ok ? 'good' : ''}>
                      <td>{r.line}</td>
                      <td>{r.title || <span class="muted-text">—</span>}</td>
                      <td class="break">{r.url}</td>
                      <td class="mono">{res?.ok ? res.link.code : r.code || <span class="muted-text">random</span>}</td>
                      <td>
                        {r.error ? (
                          r.error
                        ) : res ? (
                          res.ok ? (
                            <a href={`${config.editUrl}${res.link.id}`} target="_blank" rel="noopener">
                              Created
                            </a>
                          ) : (
                            res.error
                          )
                        ) : (
                          'Ready'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {rows && valid.length > 0 && !done && (
        <div class="layout">
          <div class="stack">
            <h3 class="subtitle">3. Choose the design for all imported codes</h3>
            <DesignPanel config={config} style={style} setStyle={(u) => setStyle(u)} logoId={logoId} setLogoId={setLogoId} />
          </div>
          <aside class="side">
            <div class="paper section stack">
              <div class="preview">
                <img src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)} alt="Design preview" />
              </div>
              <p class="caption center">Preview with the first row's short link.</p>
              {runError && <Alert severity="error">{runError}</Alert>}
              <Button variant="contained" size="large" icon="upload" full onClick={run} disabled={!!progress}>
                {progress ? `Importing ${progress.done} of ${progress.total}…` : `Import ${valid.length} QR code${valid.length === 1 ? '' : 's'}`}
              </Button>
              {progress && (
                <div class="progress">
                  <span style={{ width: `${(100 * progress.done) / progress.total}%` }} />
                </div>
              )}
              <p class="caption">Each code can still be edited afterwards, one by one.</p>
            </div>
          </aside>
        </div>
      )}

      {done && (
        <Section title="Done">
          <Alert severity={failed ? 'warning' : 'success'}>
            Created {created.length} QR code{created.length === 1 ? '' : 's'}
            {failed ? `; ${failed} could not be created (see the Result column).` : '.'}
          </Alert>
          {runError && <Alert severity="error">{runError}</Alert>}
          <div class="row">
            <Button variant="contained" icon="download" onClick={() => setExporting(created)} disabled={!created.length}>
              Export these QR codes
            </Button>
            <Button variant="outlined" icon="list" onClick={() => location.assign(config.listUrl)}>
              Go to all QR codes
            </Button>
            <Button
              onClick={() => {
                setRows(null);
                setResults(null);
                setFileName('');
              }}
            >
              Import another file
            </Button>
          </div>
        </Section>
      )}

      <BulkExportDialog config={config} links={exporting} onClose={() => setExporting(null)} />
    </div>
  );
}
