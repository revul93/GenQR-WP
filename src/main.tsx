import { render } from 'preact';
import { readConfig } from './config';
import { Generator } from './Generator';
import { CSS } from './styles';

/** Mounts the generator into every [genqr] placeholder on the page. */
function mount(el: HTMLElement) {
  if (el.shadowRoot) return;
  const config = readConfig(el);
  el.replaceChildren();
  const root = el.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const host = document.createElement('div');
  root.append(style, host);
  render(<Generator config={config} />, host);
}

const start = () => document.querySelectorAll<HTMLElement>('.genqr-root').forEach(mount);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
