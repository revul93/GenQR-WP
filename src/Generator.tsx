import { useRef, useState } from 'preact/hooks';
import type { ClientConfig } from './config';
import { Design } from './Design';
import { Downloads } from './Downloads';
import { useLogo, useQr } from './useQr';

interface Link {
  code: string;
  shortUrl: string;
  destination: string;
}

/** Same destination twice in one visit reuses the link instead of creating another. */
const created = new Map<string, Link>();

export function Generator({ config }: { config: ClientConfig }) {
  const [url, setUrl] = useState('');
  const [link, setLink] = useState<Link | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState(config.style);
  const [logoId, setLogoId] = useState(config.logos.some((l) => l.id === config.defaultLogo) ? config.defaultLogo : 0);
  const [copied, setCopied] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);

  const logo = useLogo(config.logos, logoId);
  const { svg, svgAt, scan } = useQr(link?.shortUrl ?? '', style, logo);

  async function create(e: Event) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    setError('');
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
        body: JSON.stringify({ url: value, website: honeypot.current?.value ?? '' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Something went wrong. Please try again.');
      created.set(value, body as Link);
      setLink(body as Link);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setLink(null);
    setUrl('');
    setError('');
    setCopied(false);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. not https): the link is selectable text anyway.
    }
  }

  return (
    <div class="genqr">
      {config.title && <h2 class="title">{config.title}</h2>}

      {!link && (
        <form class="create" onSubmit={create} noValidate>
          <label for="genqr-url">Web address</label>
          <div class="row nowrap">
            <input
              id="genqr-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={config.domains[0] ? `https://${config.domains[0]}/…` : 'https://…'}
              value={url}
              onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
              required
            />
            <button type="submit" class="primary" disabled={busy || !url.trim()}>
              {busy ? 'Creating…' : 'Create QR code'}
            </button>
          </div>
          {/* Honeypot: hidden from people, filled in by some bots. */}
          <input ref={honeypot} class="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {config.domains.length > 0 && <p class="hint">QR codes can be made for: {config.domains.join(', ')}</p>}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {link && (
        <div class="result">
          <div class="preview">
            <div class="qr" style={{ background: style.transparentBackground ? 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/16px 16px' : undefined }} dangerouslySetInnerHTML={{ __html: svg }} />
            <p class={`scan ${scan}`} aria-live="polite">
              {scan === 'checking' && 'Checking it scans…'}
              {scan === 'ok' && '✓ Scans correctly'}
              {scan === 'fail' && '⚠ May be hard to scan. Try more contrast between the colours or a different logo.'}
            </p>
          </div>
          <div class="panel">
            <p class="short">
              <span>Short link</span>
              <a href={link.shortUrl} target="_blank" rel="noopener">
                {link.shortUrl}
              </a>
              <button type="button" class="small" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </p>
            <p class="dest">Opens: {link.destination}</p>
            <Design style={style} onStyle={setStyle} logos={config.logos} logo={logoId} onLogo={setLogoId} />
            <Downloads svgAt={svgAt} background={style.transparentBackground ? '#ffffff' : style.background} filename={`qr-${link.code}`} caption={link.shortUrl} />
            <button type="button" class="link" onClick={reset}>
              Make another QR code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
