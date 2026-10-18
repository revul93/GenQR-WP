import { render } from 'preact';
import { useState } from 'preact/hooks';
import { readConfig, type ClientConfig } from './config';
import { Downloads } from './Downloads';
import { useLogo, useQr } from './useQr';

/** QR preview and downloads on the wp-admin "Edit link" screen, in the site's default design. */
function Preview({ config, shortUrl, code }: { config: ClientConfig; shortUrl: string; code: string }) {
  const [logoId, setLogoId] = useState(config.defaultLogo);
  const logo = useLogo(config.logos, logoId);
  const { svg, svgAt, scan } = useQr(shortUrl, config.style, logo);
  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%' }} />
      <p style={{ margin: '6px 0', color: scan === 'fail' ? '#b54708' : '#50575e' }}>
        {scan === 'ok' ? '✓ Scans correctly' : scan === 'fail' ? '⚠ May be hard to scan' : 'Checking…'}
      </p>
      {config.logos.length > 0 && (
        <p>
          <select value={logoId} onChange={(e) => setLogoId(Number((e.target as HTMLSelectElement).value))}>
            <option value={0}>No logo</option>
            {config.logos.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name || `Logo ${l.id}`}
              </option>
            ))}
          </select>
        </p>
      )}
      <Downloads svgAt={svgAt} background={config.style.background} filename={`qr-${code}`} caption={shortUrl} />
    </div>
  );
}

const el = document.getElementById('genqr-admin-preview');
if (el?.dataset.shortUrl) {
  render(<Preview config={readConfig(el)} shortUrl={el.dataset.shortUrl} code={el.dataset.title ?? 'link'} />, el);
}
