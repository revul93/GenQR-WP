import { render } from 'preact';
import { ListExport } from './BulkExport';
import { readConfig, type Link } from './config';
import { Designer } from './Designer';
import { Import } from './Import';
import { CSS } from './styles';
import { drawThumbnails } from './thumbnails';

/**
 * wp-admin app. Each GenQR admin screen has a <div class="genqr-app" data-view="…">;
 * the view renders in a Shadow DOM so wp-admin's styles don't change it.
 */
function mount(el: HTMLElement) {
  if (el.shadowRoot) return;
  const config = readConfig(el);
  let link: Link | null = null;
  try {
    link = JSON.parse(el.dataset.link || 'null');
  } catch {
    // add screen: no link yet
  }
  el.replaceChildren();
  const root = el.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS + ADMIN_CSS;
  const host = document.createElement('div');
  root.append(style, host);
  const view = el.dataset.view;
  if (view === 'export') drawThumbnails(config); // the list page: QR code column
  render(view === 'import' ? <Import config={config} /> : view === 'export' ? <ListExport config={config} /> : <Designer config={config} link={link} />, host);
}

// Sizes for wp-admin (13px base) and the admin bar/menu.
const ADMIN_CSS = ':host{font-size:14px;margin-top:12px}.side{top:48px}.genqr{max-width:1280px;margin:0}';

document.querySelectorAll<HTMLElement>('.genqr-app').forEach(mount);
