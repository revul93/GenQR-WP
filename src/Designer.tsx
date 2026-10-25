import { useEffect, useMemo, useState } from 'preact/hooks';
import { api, fileName, type ClientConfig, type Link } from './config';
import { cleanCode, linkDesign, validLogo } from './design';
import { DesignPanel } from './DesignPanel';
import { colourWarnings, type QrStyle } from './engine/style';
import { ExportDialog, PrintDialog, QuickDownload } from './ExportDialog';
import { Alert, Button, Check, CopyButton, Field, Icon, Section } from './ui';
import { useLogo, useQr } from './useQr';

/**
 * Add / Edit QR code in wp-admin. Settings cards on the left, a sticky preview with the
 * actions on the right (the GenQR designer layout).
 */

interface Form {
  title: string;
  url: string;
  code: string;
  active: boolean;
  style: QrStyle;
  logoId: number;
}

type CodeState = { status: 'idle' | 'checking' } | { status: 'ok'; shortUrl: string } | { status: 'error'; message: string };

export function Designer({ config, link: initial }: { config: ClientConfig; link: Link | null }) {
  const start = (l: Link | null): Form => {
    const d = l ? linkDesign(l, config) : { style: config.style, logoId: validLogo(config, config.defaultLogo) };
    return { title: l?.title ?? '', url: l?.destination ?? '', code: l?.code ?? '', active: l?.active ?? true, style: d.style, logoId: d.logoId };
  };
  const [link, setLink] = useState<Link | null>(initial);
  const [form, setForm] = useState<Form>(() => start(initial));
  const [saved, setSaved] = useState<Form | null>(() => (initial ? start(initial) : null));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => (new URLSearchParams(location.search).get('created') ? 'QR code created. Download or print it below.' : null));
  const [busy, setBusy] = useState(false);
  const [codeState, setCodeState] = useState<CodeState>({ status: 'idle' });
  const [dialog, setDialog] = useState<'export' | 'print' | null>(null);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const code = cleanCode(form.code);
  const codeChanged = !!link && code !== '' && code !== link.code;

  // Check custom short link text while typing (debounced).
  useEffect(() => {
    if (!code || (link && code === link.code)) {
      setCodeState({ status: 'idle' });
      return;
    }
    setCodeState({ status: 'checking' });
    let current = true;
    const t = setTimeout(() => {
      api<{ ok: boolean; message?: string; shortUrl?: string }>(config, `code-check?code=${encodeURIComponent(code)}&id=${link?.id ?? 0}`)
        .then((r) => current && setCodeState(r.ok ? { status: 'ok', shortUrl: r.shortUrl! } : { status: 'error', message: r.message! }))
        .catch(() => current && setCodeState({ status: 'idle' }));
    }, 400);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [code, link?.id]);

  const dirty = useMemo(() => !saved || JSON.stringify({ ...saved, code: cleanCode(saved.code) }) !== JSON.stringify({ ...form, code }), [saved, form, code]);
  const previewUrl = config.shortBase + (code || link?.code || 'xxxxxxx');
  const logo = useLogo(config.logos, form.logoId);
  const { svg, svgAt, scan } = useQr(previewUrl, form.style, logo);
  const svgSrc = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), [svg]);
  const warnings = colourWarnings(form.style);
  const ready = !!link && !dirty; // downloads match what is saved
  const background = form.style.transparentBackground ? '#ffffff' : form.style.background;
  const filename = fileName(form.title, code || link?.code || 'qr-code');

  async function save(e?: Event) {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.url.trim()) {
      setError('Enter the web address the QR code should open.');
      return;
    }
    if (codeState.status === 'error') {
      setError(codeState.message);
      return;
    }
    setBusy(true);
    try {
      const body = { url: form.url.trim(), title: form.title.trim(), code, style: form.style, logoId: form.logoId };
      if (!link) {
        const created = await api<Link>(config, 'links', body);
        location.assign(`${config.editUrl}${created.id}&created=1`); // the edit screen also shows scans and history
        return;
      }
      const updated = await api<Link>(config, `links/${link.id}`, { ...body, code: code || link.code, active: form.active });
      setLink(updated);
      const next = start(updated);
      setForm(next);
      setSaved(next);
      setNotice('Changes saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="genqr">
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div class="layout">
        <form class="stack" onSubmit={save} noValidate>
          <Section title="Content">
            <Field label="Title" helper="Shown in the QR codes list; used for file names and the printed caption.">
              {(id) => <input id={id} type="text" value={form.title} maxLength={120} placeholder="e.g. Product brochure — Expo 2026" onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />}
            </Field>
            <Field label="Link (URL)" helper="Where the QR code goes. You can change it any time; printed codes follow the change.">
              {(id) => (
                <input
                  id={id}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  required
                  maxLength={2000}
                  placeholder="https://www.example.com/page"
                  value={form.url}
                  onInput={(e) => set({ url: (e.target as HTMLInputElement).value })}
                />
              )}
            </Field>
            <Field
              label="Short link text"
              error={codeState.status === 'error'}
              helper={
                codeState.status === 'error'
                  ? codeState.message
                  : codeChanged
                    ? `Changing it breaks QR codes already printed with ${link!.shortUrl}.`
                    : codeState.status === 'ok'
                      ? `Available: ${codeState.shortUrl}`
                      : codeState.status === 'checking'
                        ? 'Checking…'
                        : link
                          ? 'This is what printed QR codes contain.'
                          : 'Optional. Letters, numbers, dashes or underscores. Leave empty for a random code like k7m2xq9.'
              }
            >
              {(id) => (
                <div class="adorned">
                  <span class="adornment">
                    <bdi dir="ltr">{config.shortBase.replace(/^https?:\/\//, '')}</bdi>
                  </span>
                  <input id={id} type="text" value={form.code} maxLength={32} placeholder="expo-2026" spellcheck={false} autoComplete="off" onInput={(e) => set({ code: (e.target as HTMLInputElement).value })} />
                </div>
              )}
            </Field>
            {link && <Check switchStyle label={form.active ? 'On: scanning opens the link' : 'Off: scanning shows "link not available"'} checked={form.active} onChange={(v) => set({ active: v })} />}
          </Section>

          <DesignPanel config={config} style={form.style} setStyle={(u) => setForm((f) => ({ ...f, style: u(f.style) }))} logoId={form.logoId} setLogoId={(id) => set({ logoId: id })} />
        </form>

        <aside class="side">
          <div class="paper section stack">
            <div class={form.style.transparentBackground ? 'preview checker' : 'preview'}>
              <img src={svgSrc} alt="QR code preview" />
            </div>
            <div class={`scan ${scan}`} aria-live="polite">
              {scan === 'checking' && <span class="caption">Checking…</span>}
              {scan === 'ok' && (
                <>
                  <Icon name="check" /> Scan check passed
                </>
              )}
              {scan === 'fail' && (
                <>
                  <Icon name="warning" /> Scan check failed — this design may not scan reliably
                </>
              )}
            </div>
            {link && (
              <div class="outlined-box">
                <div class="row nowrap center-items">
                  <Icon name="link" class="muted" />
                  <span class="mono grow">{link.shortUrl}</span>
                  <CopyButton text={link.shortUrl} />
                  <a class="icon-button" href={link.shortUrl} target="_blank" rel="noopener" title="Open" aria-label="Open">
                    <Icon name="open" />
                  </a>
                </div>
                <div class="row nowrap center-items top-gap">
                  <span class={link.active ? 'chip success' : 'chip'}>{link.active ? 'On' : 'Off'}</span>
                  <span class="caption grow ellipsis" title={link.destination}>
                    Opens {link.destination}
                  </span>
                </div>
              </div>
            )}
            {warnings.map((w) => (
              <Alert key={w} severity="warning">
                {w}
              </Alert>
            ))}
            <Button variant="contained" size="large" icon={link ? 'save' : 'qr'} full onClick={() => save()} disabled={busy || (!!link && !dirty)}>
              {busy ? 'Saving…' : !link ? 'Create QR code' : dirty ? 'Save changes' : 'Saved'}
            </Button>
            <div class="row nowrap">
              <Button variant="outlined" icon="download" full disabled={!ready} title={ready ? 'Choose format and size' : link ? 'Save your changes first' : 'Create the QR code first'} onClick={() => setDialog('export')}>
                Download…
              </Button>
              <QuickDownload svgAt={svgAt} background={background} filename={filename} disabled={!ready} title={ready ? undefined : link ? 'Save your changes first' : 'Create the QR code first'} />
            </div>
            <Button variant="outlined" icon="print" full disabled={!ready} title={ready ? '' : link ? 'Save your changes first' : 'Create the QR code first'} onClick={() => setDialog('print')}>
              Print
            </Button>
            <p class="caption">Always test-scan a printed sample with a phone before mass printing.</p>
          </div>
        </aside>
      </div>

      <ExportDialog open={dialog === 'export'} onClose={() => setDialog(null)} svgAt={svgAt} background={background} filename={filename} />
      <PrintDialog open={dialog === 'print'} onClose={() => setDialog(null)} svgAt={svgAt} defaultCaption={form.title.trim()} />
    </div>
  );
}
