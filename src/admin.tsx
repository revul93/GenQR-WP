import { render } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { readConfig, type ClientConfig, type PublicLink } from './config';
import { linkDesign } from './design';
import { ExportDialog, PrintDialog } from './ExportDialog';
import { CSS } from './styles';
import { Button, Icon, Select } from './ui';
import { useLogo, useQr } from './useQr';

/** QR preview, downloads and print on the wp-admin "Edit link" screen, in the code's own design. */
function Preview({ config, shortUrl, code, link }: { config: ClientConfig; shortUrl: string; code: string; link: PublicLink | null }) {
  // The design the code was made with (or the site default for older codes).
  const design = link ? linkDesign(link, config) : { style: config.style, logoId: config.defaultLogo };
  const [logoId, setLogoId] = useState(design.logoId);
  const [dialog, setDialog] = useState<'export' | 'print' | null>(null);
  const logo = useLogo(config.logos, logoId);
  const { svg, svgAt, scan } = useQr(shortUrl, design.style, logo);
  const src = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), [svg]);
  return (
    <div class="stack">
      <div class="preview">
        <img src={src} alt="QR code preview" />
      </div>
      <div class={`scan ${scan}`}>
        {scan === 'ok' && (
          <>
            <Icon name="check" /> Scan check passed
          </>
        )}
        {scan === 'fail' && (
          <>
            <Icon name="warning" /> May not scan reliably
          </>
        )}
      </div>
      {config.logos.length > 0 && (
        <Select label="Logo" value={logoId} onChange={setLogoId} options={[{ value: 0, label: 'No logo' }, ...config.logos.map((l) => ({ value: l.id, label: l.name || `Logo ${l.id}` }))]} />
      )}
      <div class="row nowrap">
        <Button variant="outlined" icon="download" full onClick={() => setDialog('export')}>
          Download
        </Button>
        <Button variant="outlined" icon="print" full onClick={() => setDialog('print')}>
          Print
        </Button>
      </div>
      <ExportDialog open={dialog === 'export'} onClose={() => setDialog(null)} svgAt={svgAt} background={design.style.transparentBackground ? '#ffffff' : design.style.background} filename={`qr-${code}`} />
      <PrintDialog open={dialog === 'print'} onClose={() => setDialog(null)} svgAt={svgAt} defaultCaption={shortUrl} />
    </div>
  );
}

const el = document.getElementById('genqr-admin-preview');
if (el?.dataset.shortUrl) {
  const config = readConfig(el);
  const root = el.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS + ':host{font-size:14px}';
  const host = document.createElement('div');
  root.append(style, host);
  let link: PublicLink | null = null;
  try {
    link = JSON.parse(el.dataset.link || 'null');
  } catch {
    // no stored design: use the site default
  }
  render(<Preview config={config} shortUrl={el.dataset.shortUrl} code={el.dataset.title ?? 'link'} link={link} />, host);
}
