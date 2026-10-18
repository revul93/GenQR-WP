import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ClientConfig, PublicLink } from './config';
import { colourWarnings, type QrStyle } from './engine/style';
import { ExportDialog, PrintDialog, QuickDownload } from './ExportDialog';
import { applyPreset, matchesPreset, swatch } from './presets';
import { Alert, Button, Check, ColourField, CopyButton, Field, Icon, Section, Select, Slider, ToggleGroup } from './ui';
import { useLogo, useQr } from './useQr';

/**
 * The public generator. Laid out like the GenQR designer: settings cards on the left,
 * a sticky preview with the actions on the right.
 */

type Link = PublicLink;

/** Same address twice in one visit reuses the link instead of creating another. */
const created = new Map<string, Link>();

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

export function Generator({ config, openCode, onNew }: { config: ClientConfig; openCode: string | null; onNew(): void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [link, setLink] = useState<Link | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [style, setStyleState] = useState<QrStyle>(config.style);
  const [logoId, setLogoId] = useState(config.logos.some((l) => l.id === config.defaultLogo) ? config.defaultLogo : 0);
  const [dialog, setDialog] = useState<'export' | 'print' | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);

  const setStyle = (patch: Partial<QrStyle>) => setStyleState((s) => ({ ...s, ...patch }));

  // Opened from "All QR codes": load that link, ready to download or print.
  useEffect(() => {
    if (!openCode) return;
    let current = true;
    fetch(`${config.api}links/${encodeURIComponent(openCode)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'Could not load this QR code.');
        if (!current) return;
        const l = body as Link;
        created.set(l.destination, l);
        setUrl(l.destination);
        setTitle(l.title || '');
        setLink(l);
      })
      .catch((e) => current && setNotice((e as Error).message));
    return () => {
      current = false;
    };
  }, [openCode, config.api]);

  // Until the link exists, preview a placeholder of the same length: the code looks the same.
  const placeholder = `${config.shortBase}xxxxxxx`;
  const logo = useLogo(config.logos, logoId);
  const { svg, svgAt, scan } = useQr(link?.shortUrl ?? placeholder, style, logo);
  const svgSrc = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), [svg]);
  const warnings = colourWarnings(style);
  const hasLogo = logoId !== 0;
  const current = !!link && created.get(url.trim()) === link;

  async function create(e?: Event) {
    e?.preventDefault();
    const value = url.trim();
    if (!value) return;
    setUrlError(null);
    setNotice(null);
    const cached = created.get(value);
    if (cached) {
      setLink(cached);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(config.api + 'links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ url: value, title: title.trim(), website: honeypot.current?.value ?? '' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body.message || 'Something went wrong. Please try again.';
        if (res.status === 400) setUrlError(message);
        else setNotice(message);
        return;
      }
      created.set(value, body as Link);
      setLink(body as Link);
    } catch {
      setNotice('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const filename = (title.trim() || `qr-${link?.code ?? 'code'}`).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'qr-code';

  return (
    <div class="genqr">
      {config.title && <h2 class="h5">{openCode && link ? link.title || 'QR code' : config.title}</h2>}
      {notice && (
        <Alert severity="error" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div class="layout">
        <div class="stack">
          <Section title="Content">
            <form class="stack" onSubmit={create} noValidate>
              <Field
                label="Title (optional)"
                helper={config.publicList ? 'Shown on the "All QR codes" page, and used for the file name and the printed caption.' : 'Used for the file name and the printed caption.'}
              >
                {(id) => <input id={id} type="text" value={title} maxLength={120} disabled={current} placeholder="e.g. Product brochure — Expo 2026" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />}
              </Field>
              <Field
                label="Link (URL)"
                error={!!urlError}
                helper={
                  urlError ??
                  (config.domains.length
                    ? `The QR code points to a short link, so the site administrator can change its destination later without reprinting. Allowed websites: ${config.domains.join(', ')}.`
                    : 'QR codes cannot be created yet: no websites have been approved.')
                }
              >
                {(id) => (
                  <input
                    id={id}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    required
                    maxLength={2000}
                    placeholder={`https://${/^[\d.]+$/.test(config.domains[0] ?? '') ? '' : 'www.'}${config.domains[0] ?? 'example.com'}/page`}
                    value={url}
                    onInput={(e) => {
                      setUrl((e.target as HTMLInputElement).value);
                      setUrlError(null);
                    }}
                  />
                )}
              </Field>
              {/* Honeypot: hidden from people, filled in by some bots. */}
              <input ref={honeypot} class="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            </form>
          </Section>

          {config.presets.length > 0 && (
            <Section title="Presets">
              <div class="preset-grid" role="radiogroup" aria-label="Presets">
                {config.presets.map((p) => {
                  const on = matchesPreset(style, p);
                  return (
                    <button key={p.name} type="button" role="radio" aria-checked={on} class={on ? 'preset selected' : 'preset'} onClick={() => setStyleState((st) => applyPreset(st, p))}>
                      <span class="swatch big" style={{ background: swatch(p) }} />
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          <button type="button" class="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>
            <Icon name={advanced ? 'less' : 'more'} />
            Advanced{advanced ? '' : ': colours, shapes and logo'}
          </button>

          {advanced && (
            <>

          <Section title="Colours">
            <div class="row">
              <ColourField label="Code colour" value={style.foreground} onChange={(v) => setStyle({ foreground: v })} />
              <ColourField label="Background" value={style.background} disabled={style.transparentBackground} onChange={(v) => setStyle({ background: v })} />
              <Check label="Transparent background" checked={style.transparentBackground} onChange={(v) => setStyle({ transparentBackground: v })} />
            </div>
            <div class="row">
              <Select
                label="Gradient"
                width={160}
                value={style.gradient?.type ?? 'none'}
                onChange={(v) =>
                  setStyle({ gradient: v === 'none' ? null : { type: v as 'linear' | 'radial', color: style.gradient?.color ?? '#0b5394', rotation: style.gradient?.rotation ?? 45 } })
                }
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'linear', label: 'Linear' },
                  { value: 'radial', label: 'Radial' },
                ]}
              />
              {style.gradient && (
                <>
                  <ColourField label="Gradient to" value={style.gradient.color} onChange={(v) => setStyle({ gradient: { ...style.gradient!, color: v } })} />
                  {style.gradient.type === 'linear' && (
                    <Slider
                      caption={`Angle: ${style.gradient.rotation}°`}
                      width={180}
                      min={0}
                      max={360}
                      step={15}
                      value={style.gradient.rotation}
                      onChange={(v) => setStyle({ gradient: { ...style.gradient!, rotation: v } })}
                    />
                  )}
                </>
              )}
            </div>
            <div class="row">
              <Check switchStyle label="Different colour for the corners" checked={style.eyeColor != null} onChange={(on) => setStyle({ eyeColor: on ? style.foreground : null })} />
              {style.eyeColor != null && <ColourField label="Corner colour" value={style.eyeColor} onChange={(v) => setStyle({ eyeColor: v })} />}
            </div>
          </Section>

          <Section title="Shapes">
            <ToggleGroup label="Pattern" value={style.moduleShape} options={[...MODULES]} onChange={(v) => setStyle({ moduleShape: v })} />
            <ToggleGroup label="Corner frame" value={style.eyeFrameShape} options={[...CORNERS]} onChange={(v) => setStyle({ eyeFrameShape: v })} />
            <ToggleGroup label="Corner centre" value={style.eyeBallShape} options={[...CORNERS]} onChange={(v) => setStyle({ eyeBallShape: v })} />
          </Section>

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
              {hasLogo && (
                <>
                  <div class="row">
                    <Slider caption={`Logo size: ${style.logoSizePercent}% of the code`} min={10} max={30} value={style.logoSizePercent} onChange={(v) => setStyle({ logoSizePercent: v })} />
                    <Check label="Clear space around the logo" checked={style.logoBacking} onChange={(v) => setStyle({ logoBacking: v })} />
                  </div>
                  <p class="caption">With a logo the code automatically uses the highest error correction (H), so it still scans with its centre covered.</p>
                </>
              )}
            </Section>
          )}
            </>
          )}
        </div>

        <aside class="side">
          <div class="paper section stack">
            <div class={style.transparentBackground ? 'preview checker' : 'preview'}>
              <img src={svgSrc} alt="QR code preview" />
            </div>
            {!link && <p class="caption center">Preview. Create the QR code to get its link.</p>}
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
                  <span class="chip success">Active</span>
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
            <Button variant="contained" size="large" icon="qr" full onClick={() => create()} disabled={busy || current || !url.trim()}>
              {busy ? 'Creating…' : current ? 'QR code created' : 'Create QR code'}
            </Button>
            <div class="row nowrap">
              <Button variant="outlined" icon="download" full disabled={!current} title={current ? 'Choose format and size' : 'Create the QR code first'} onClick={() => setDialog('export')}>
                Download…
              </Button>
              <QuickDownload svgAt={svgAt} background={style.transparentBackground ? '#ffffff' : style.background} filename={filename} disabled={!current} title={current ? undefined : 'Create the QR code first'} />
            </div>
            <Button variant="outlined" icon="print" full disabled={!current} title={current ? '' : 'Create the QR code first'} onClick={() => setDialog('print')}>
              Print
            </Button>
            {link && (
              <Button size="small" icon="add" onClick={onNew}>
                Make another QR code
              </Button>
            )}
            <p class="caption">Always test-scan a printed sample with a phone before mass printing.</p>
          </div>
        </aside>
      </div>

      <ExportDialog
        open={dialog === 'export'}
        onClose={() => setDialog(null)}
        svgAt={svgAt}
        background={style.transparentBackground ? '#ffffff' : style.background}
        filename={filename}
      />
      <PrintDialog open={dialog === 'print'} onClose={() => setDialog(null)} svgAt={svgAt} defaultCaption={title.trim()} />
    </div>
  );
}
