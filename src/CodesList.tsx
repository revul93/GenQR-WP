import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ClientConfig, PublicLink } from './config';
import { renderSvg } from './engine/render';
import { DownloadSplit, ExportDialog } from './ExportDialog';
import { Alert, Button, CopyButton, Field, Icon } from './ui';
import { linkDesign } from './design';
import { useLogo } from './useQr';

/** Public list of every active QR code: title, short link, destination, clicks. */
export function CodesList({ config, onOpen }: { config: ClientConfig; onOpen(code: string): void }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PublicLink[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search as you type, debounced.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setItems([]);
    setPage(1);
  }, [query]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set('search', query);
    fetch(`${config.api}links?${params}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'Could not load the QR codes.');
        if (!current) return;
        setItems((list) => (page === 1 ? body.items : [...list, ...body.items]));
        setPages(body.pages || 1);
        setTotal(body.total || 0);
      })
      .catch((e) => current && setError((e as Error).message))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [query, page, config.api]);

  return (
    <div class="stack">
      <div class="row space-between">
        <h2 class="h5">All QR codes</h2>
        <div class="search">
          <Field label="Search">
            {(id) => <input id={id} type="text" placeholder="Title, link or website" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />}
          </Field>
        </div>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && items.length === 0 && (
        <div class="paper section empty">
          <p>{query ? `No QR codes match "${query}".` : 'No QR codes yet.'}</p>
        </div>
      )}
      {items.length > 0 && (
        <p class="caption">
          {total} QR code{total === 1 ? '' : 's'}
          {query ? ` matching "${query}"` : ''}
        </p>
      )}
      <div class="cards">
        {items.map((item) => (
          <CodeCard key={item.code} item={item} config={config} onOpen={() => onOpen(item.code)} />
        ))}
      </div>
      {loading && <p class="caption center">Loading…</p>}
      {!loading && page < pages && (
        <div class="row center">
          <Button variant="outlined" onClick={() => setPage((p) => p + 1)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}

function CodeCard({ item, config, onOpen }: { item: PublicLink; config: ClientConfig; onOpen(): void }) {
  // Thumbnails and downloads use the design the code was made with (or the site default for older codes).
  const [dialog, setDialog] = useState(false);
  const design = useMemo(() => linkDesign(item, config), [item, config]);
  const logo = useLogo(config.logos, design.logoId);
  const svgAt = useMemo(() => (sizePx: number) => renderSvg({ data: item.shortUrl, style: design.style, logoDataUri: logo, sizePx }), [item.shortUrl, design, logo]);
  const src = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgAt(160)), [svgAt]);
  const filename = (item.title || `qr-${item.code}`).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || `qr-${item.code}`;
  const background = design.style.transparentBackground ? '#ffffff' : design.style.background;
  const created = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
  return (
    <article class="paper card">
      <button type="button" class="thumb" onClick={onOpen} title="Open in the designer" aria-label={`Open ${item.title || item.code} in the designer`}>
        <img src={src} alt="" loading="lazy" />
      </button>
      <div class="card-body">
        <h3 class="card-title" title={item.title}>
          {item.title || <span class="muted-text">Untitled</span>}
        </h3>
        <div class="row nowrap center-items">
          <Icon name="link" class="muted small" />
          <a class="mono grow ellipsis" href={item.shortUrl} target="_blank" rel="noopener">
            {item.shortUrl.replace(/^https?:\/\//, '')}
          </a>
          <CopyButton text={item.shortUrl} />
        </div>
        <p class="caption ellipsis" title={item.destination}>
          Opens{' '}
          <a href={item.destination} target="_blank" rel="noopener noreferrer">
            {item.destination}
          </a>
        </p>
        <p class="caption">
          {item.clicks ?? 0} scan{item.clicks === 1 ? '' : 's'}
          {created && ` · created ${created}`}
        </p>
        <div class="card-actions">
          <DownloadSplit svgAt={svgAt} background={background} filename={filename} onMore={() => setDialog(true)} />
        </div>
        <ExportDialog open={dialog} onClose={() => setDialog(false)} svgAt={svgAt} background={background} filename={filename} />
      </div>
    </article>
  );
}
