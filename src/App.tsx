import { useEffect, useState } from 'preact/hooks';
import { CodesList } from './CodesList';
import type { ClientConfig } from './config';
import { Generator } from './Generator';
import { Icon } from './ui';

/**
 * Two views on one page, kept in the address so they can be bookmarked and the Back
 * button works: the designer (optionally opened on an existing code) and the list.
 */
type Route = { view: 'create'; code: string | null } | { view: 'codes' };

function readRoute(): Route {
  const q = new URLSearchParams(location.search);
  return q.get('view') === 'codes' ? { view: 'codes' } : { view: 'create', code: q.get('code') };
}

function href(route: Route): string {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  url.searchParams.delete('code');
  if (route.view === 'codes') url.searchParams.set('view', 'codes');
  else if (route.code) url.searchParams.set('code', route.code);
  return url.pathname + url.search;
}

export function App({ config }: { config: ClientConfig }) {
  const [route, setRoute] = useState<Route>(readRoute);
  const [key, setKey] = useState(0); // remounts the designer for "new QR code"

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const go = (next: Route) => {
    history.pushState(null, '', href(next));
    setRoute(next);
    setKey((k) => k + 1);
    if (config.appMode) scrollTo({ top: 0 });
  };
  const nav = (next: Route) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" work
    e.preventDefault();
    go(next);
  };

  const showList = config.publicList && route.view === 'codes';
  const links = config.publicList && (
    <nav class="nav" aria-label="QR codes">
      <a href={href({ view: 'create', code: null })} class={!showList ? 'active' : ''} aria-current={!showList ? 'page' : undefined} onClick={nav({ view: 'create', code: null })}>
        <Icon name="add" /> Create QR code
      </a>
      <a href={href({ view: 'codes' })} class={showList ? 'active' : ''} aria-current={showList ? 'page' : undefined} onClick={nav({ view: 'codes' })}>
        <Icon name="list" /> All QR codes
      </a>
    </nav>
  );

  return (
    <div class={config.appMode ? 'app' : 'embedded'}>
      {config.appMode ? (
        <header class="appbar">
          <div class="toolbar">
            <a class="brand" href={href({ view: 'create', code: null })} onClick={nav({ view: 'create', code: null })}>
              <Icon name="qr" /> {config.brand}
            </a>
            {links}
          </div>
        </header>
      ) : (
        links && <div class="tabs">{links}</div>
      )}
      <div class="container">
        {showList ? (
          <CodesList config={config} onOpen={(code) => go({ view: 'create', code })} />
        ) : (
          <Generator key={key} config={config} openCode={route.view === 'create' ? route.code : null} onNew={() => go({ view: 'create', code: null })} />
        )}
      </div>
    </div>
  );
}
