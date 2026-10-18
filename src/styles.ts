/**
 * Styles for the generator, matched to the GenQR web app (Material UI default theme,
 * primary #0b5394, 8px corners). It lives in a Shadow DOM, so the theme cannot break it
 * and it cannot leak into the theme. Set --genqr-accent on the page to change the primary colour.
 */
export const CSS = `
:host{all:initial;display:block;--primary:var(--genqr-accent,#0b5394);--text:rgba(0,0,0,.87);--text2:rgba(0,0,0,.6);--disabled:rgba(0,0,0,.38);--divider:rgba(0,0,0,.12);--border:rgba(0,0,0,.23);
  --success:#2e7d32;--warning:#ed6c02;--error:#d32f2f;
  font-family:"Roboto","Helvetica","Arial",sans-serif;font-size:16px;line-height:1.5;letter-spacing:.00938em;color:var(--text);-webkit-font-smoothing:antialiased}
*,*::before,*::after{box-sizing:border-box}
.genqr{max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.h5{font-size:1.5rem;font-weight:400;line-height:1.334;letter-spacing:0;margin:0}
.stack{display:flex;flex-direction:column;gap:16px}
.row{display:flex;flex-wrap:wrap;gap:16px;align-items:center}
.row.nowrap{flex-wrap:nowrap;gap:8px}
.center-items{align-items:center}
.grow{flex-grow:1;min-width:0}
.top-gap{margin-top:8px}
.layout{display:grid;gap:16px;grid-template-columns:minmax(0,1fr) 380px;align-items:start}
.side{position:sticky;top:88px}
@media (max-width:899.95px){.layout{grid-template-columns:1fr}.side{position:static}}

/* Paper */
.paper{background:#fff;color:var(--text);border-radius:8px;box-shadow:0 2px 1px -1px rgba(0,0,0,.2),0 1px 1px 0 rgba(0,0,0,.14),0 1px 3px 0 rgba(0,0,0,.12)}
.section{padding:20px}
.subtitle{font-size:1rem;font-weight:600;line-height:1.75;letter-spacing:.00938em;margin:0 0 16px}
.caption{font-size:.75rem;line-height:1.66;letter-spacing:.03333em;color:var(--text2);margin:0}
.caption.center{text-align:center}
.caption-label{display:block;font-size:.875rem;line-height:1.43;letter-spacing:.01071em;color:var(--text2);margin-bottom:4px}
.muted{fill:var(--disabled)!important}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.875rem;word-break:break-all}
.ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Outlined text field */
.field{position:relative;display:flex;flex-direction:column;min-width:0}
.field>label{position:absolute;left:9px;top:-9px;padding:0 5px;background:#fff;font-size:.75rem;line-height:1.4375em;letter-spacing:.00938em;color:var(--text2);pointer-events:none;z-index:1;max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.field input[type=text],.field input[type=url],.field select{font:inherit;color:var(--text);width:100%;height:56px;padding:16.5px 14px;border:1px solid var(--border);border-radius:8px;background:#fff;outline:0;margin:0}
.field select{appearance:none;padding-right:32px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='rgba(0,0,0,0.54)' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 7px center;background-size:24px}
.field input:hover,.field select:hover{border-color:var(--text)}
.field input:focus,.field select:focus{border:2px solid var(--primary);padding:15.5px 13px}
.field select:focus{padding-right:31px}
.field:focus-within>label{color:var(--primary)}
.field input:disabled,.field select:disabled{color:var(--disabled);border-color:rgba(0,0,0,.26);cursor:default}
.field input::placeholder{color:rgba(0,0,0,.42);opacity:1}
.field .helper{font-size:.75rem;line-height:1.66;letter-spacing:.03333em;color:var(--text2);margin:3px 14px 0}
.field.has-error>label,.field.has-error .helper{color:var(--error)}
.field.has-error input{border-color:var(--error)}
.field input.colour{width:100%;height:56px;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer}
.field input.colour::-webkit-color-swatch-wrapper{padding:0}
.field input.colour::-webkit-color-swatch{border:0;border-radius:2px;height:30px}
.field input.colour::-moz-color-swatch{border:0;border-radius:2px;height:30px}
.field input.colour:disabled{opacity:.5;cursor:default}
.hp{position:absolute;left:-10000px;width:1px;height:1px;opacity:0}

/* Toggle buttons */
.toggle-group{display:inline-flex;border-radius:8px}
.toggle{font:inherit;font-size:.8125rem;font-weight:500;line-height:1.75;letter-spacing:.02857em;text-transform:uppercase;color:var(--text2);background:transparent;border:1px solid var(--divider);padding:7px 16px;margin-left:-1px;cursor:pointer;transition:background-color .15s}
.toggle:first-child{margin-left:0;border-radius:8px 0 0 8px}
.toggle:last-child{border-radius:0 8px 8px 0}
.toggle:hover{background:rgba(0,0,0,.04)}
.toggle.selected{color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,transparent)}
.toggle.selected:hover{background:color-mix(in srgb,var(--primary) 12%,transparent)}

/* Checkbox, switch, slider */
.check{display:inline-flex;align-items:center;gap:9px;cursor:pointer;font-size:1rem;margin-left:-2px}
.check input{width:18px;height:18px;margin:0;accent-color:var(--primary);cursor:pointer}
.check.switch input{appearance:none;width:34px;height:14px;border-radius:7px;background:rgba(0,0,0,.38);position:relative;margin:0 10px 0 4px;transition:background-color .15s}
.check.switch input::after{content:"";position:absolute;top:-3px;left:-3px;width:20px;height:20px;border-radius:50%;background:#fafafa;box-shadow:0 2px 1px -1px rgba(0,0,0,.2),0 1px 1px 0 rgba(0,0,0,.14),0 1px 3px 0 rgba(0,0,0,.12);transition:transform .15s,background-color .15s}
.check.switch input:checked{background:color-mix(in srgb,var(--primary) 50%,transparent)}
.check.switch input:checked::after{transform:translateX(20px);background:var(--primary)}
.slider{display:flex;flex-direction:column}
.slider input{width:100%;accent-color:var(--primary);margin:6px 0;cursor:pointer}

/* Buttons */
.btn{font:inherit;font-size:.875rem;font-weight:500;line-height:1.75;letter-spacing:.02857em;text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:64px;padding:6px 8px;border-radius:8px;border:0;background:transparent;color:var(--primary);cursor:pointer;transition:background-color .2s,box-shadow .2s;text-decoration:none}
.btn .icon{width:20px;height:20px;fill:currentColor;margin-left:-4px}
.btn:hover{background:color-mix(in srgb,var(--primary) 4%,transparent)}
.btn.contained{background:var(--primary);color:#fff;padding:6px 16px;box-shadow:0 3px 1px -2px rgba(0,0,0,.2),0 2px 2px 0 rgba(0,0,0,.14),0 1px 5px 0 rgba(0,0,0,.12)}
.btn.contained:hover{background:color-mix(in srgb,var(--primary) 82%,#000);box-shadow:0 2px 4px -1px rgba(0,0,0,.2),0 4px 5px 0 rgba(0,0,0,.14),0 1px 10px 0 rgba(0,0,0,.12)}
.btn.outlined{border:1px solid color-mix(in srgb,var(--primary) 50%,transparent);padding:5px 15px}
.btn.outlined:hover{border-color:var(--primary)}
.btn.large{font-size:.9375rem;padding:8px 22px}
.btn.small{font-size:.8125rem;padding:4px 5px}
.btn.full{width:100%;flex:1}
.btn:disabled{color:var(--disabled);cursor:default;box-shadow:none;background:transparent}
.btn.contained:disabled{background:rgba(0,0,0,.12)}
.btn.outlined:disabled{border-color:var(--divider)}
.btn:focus-visible,.toggle:focus-visible,.tile:focus-visible,.icon-button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.icon-button{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;border:0;background:transparent;cursor:pointer;color:rgba(0,0,0,.54);font-size:1.4rem;line-height:1;flex-shrink:0}
.icon-button:hover{background:rgba(0,0,0,.04)}
.icon-button .icon{width:20px;height:20px;fill:currentColor}
.icon{width:24px;height:24px;fill:currentColor;flex-shrink:0}

/* Logo tiles */
.tiles{gap:8px}
.tile{width:64px;height:64px;padding:8px;border-radius:8px;border:2px solid var(--divider);background:#fff;cursor:pointer;display:grid;place-items:center}
.tile.selected{border-color:var(--primary)}
.tile img{max-width:100%;max-height:100%;object-fit:contain}

/* Preview panel */
.preview{aspect-ratio:1;display:grid;place-items:center;border-radius:8px}
.preview.checker{background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0 0/20px 20px}
.preview img{width:100%;height:100%;display:block}
.scan{display:flex;align-items:center;gap:8px;font-size:.875rem;line-height:1.43;letter-spacing:.01071em;min-height:20px}
.scan .icon{width:20px;height:20px}
.scan.ok{color:var(--success)}
.scan.fail{color:var(--warning)}
.outlined-box{border:1px solid var(--divider);border-radius:8px;padding:12px}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:12px;font-size:.8125rem;background:rgba(0,0,0,.08);white-space:nowrap}
.chip.success{background:var(--success);color:#fff}

/* Alerts */
.alert{display:flex;gap:12px;align-items:flex-start;padding:6px 16px;border-radius:8px;font-size:.875rem;line-height:1.43;letter-spacing:.01071em}
.alert>.icon{width:22px;height:22px;margin-top:7px;opacity:.9}
.alert-body{padding:8px 0;flex-grow:1;min-width:0}
.alert.warning{background:#fff4e5;color:#663c00}.alert.warning>.icon{fill:var(--warning)}
.alert.error{background:#fdeded;color:#5f2120}.alert.error>.icon{fill:var(--error)}
.alert.success{background:#edf7ed;color:#1e4620}.alert.success>.icon{fill:var(--success)}
.alert .icon-button{margin:4px -8px 0 0;color:inherit}

/* App shell: top bar like the GenQR web app, or tabs when inside a theme page */
.app{min-height:100vh;background:#fafafa}
.appbar{position:sticky;top:0;z-index:10;background:var(--primary);color:#fff;box-shadow:0 2px 4px -1px rgba(0,0,0,.2),0 4px 5px 0 rgba(0,0,0,.14),0 1px 10px 0 rgba(0,0,0,.12)}
.toolbar{max-width:1200px;margin:0 auto;min-height:64px;padding:0 24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-size:1.25rem;font-weight:500;letter-spacing:.0075em}
.brand .icon{width:28px;height:28px}
.nav{display:flex;gap:4px;flex-wrap:wrap}
.nav a{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;text-decoration:none;font-size:.875rem;font-weight:500;letter-spacing:.02857em;text-transform:uppercase}
.nav a .icon{width:20px;height:20px}
.appbar .nav{margin-left:auto}
.appbar .nav a{color:rgba(255,255,255,.85)}
.appbar .nav a:hover{background:rgba(255,255,255,.12);color:#fff}
.appbar .nav a.active{background:rgba(255,255,255,.18);color:#fff}
.appbar a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.tabs{border-bottom:1px solid var(--divider);margin-bottom:16px}
.tabs .nav a{color:var(--text2);border-radius:0;border-bottom:2px solid transparent;padding:10px 16px}
.tabs .nav a.active{color:var(--primary);border-bottom-color:var(--primary)}
.app .container{max-width:1200px;margin:0 auto;padding:24px}
@media (max-width:599.95px){.toolbar{padding:8px 16px;gap:8px;min-height:56px}.app .container{padding:16px}.appbar .nav{margin-left:0}}

/* Presets */
.swatch{display:inline-block;width:16px;height:16px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);flex-shrink:0}
.swatch.big{width:40px;height:40px}
.preset-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(108px,1fr))}
.preset{font:inherit;font-size:.875rem;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px;border:2px solid var(--divider);border-radius:8px;background:#fff;cursor:pointer;transition:border-color .15s,background-color .15s}
.preset:hover{border-color:color-mix(in srgb,var(--primary) 40%,transparent)}
.preset.selected{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,#fff);font-weight:500}
.preset:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.advanced-toggle{font:inherit;font-size:.875rem;font-weight:500;letter-spacing:.02857em;text-transform:uppercase;color:var(--primary);background:transparent;border:1px dashed color-mix(in srgb,var(--primary) 50%,transparent);border-radius:8px;padding:10px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;width:100%}
.advanced-toggle:hover{background:color-mix(in srgb,var(--primary) 4%,transparent)}
.advanced-toggle[aria-expanded=true]{border-style:solid}
.advanced-toggle .icon{width:20px;height:20px}
.advanced-toggle:focus-visible{outline:2px solid var(--primary);outline-offset:2px}

/* All QR codes */
.space-between{justify-content:space-between}
.search{width:320px;max-width:100%}
.empty{text-align:center;color:var(--text2)}
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{display:flex;flex-direction:column;overflow:hidden}
.thumb{border:0;background:#fff;padding:16px 16px 0;cursor:pointer;display:block}
.thumb img{width:100%;max-width:180px;aspect-ratio:1;display:block;margin:0 auto}
.card-body{padding:12px 16px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}
.card-title{font-size:1rem;font-weight:600;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-body .mono{color:var(--primary);text-decoration:none;font-size:.8125rem}
.card-body .caption a{color:inherit}
.card-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px}
.card-actions .btn{flex:1}
.muted-text{color:var(--disabled);font-weight:400}
.icon.small{width:18px;height:18px}
.row.center{justify-content:center}

/* Dialog */
.dialog{border:0;padding:0;border-radius:8px;width:calc(100% - 64px);max-width:444px;max-height:calc(100% - 64px);color:var(--text);font:inherit;box-shadow:0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14),0 9px 46px 8px rgba(0,0,0,.12)}
.dialog::backdrop{background:rgba(0,0,0,.5)}
.dialog-title{font-size:1.25rem;font-weight:500;line-height:1.6;letter-spacing:.0075em;margin:0;padding:16px 24px}
.dialog-content{padding:8px 24px 20px}
.dialog-actions{display:flex;justify-content:flex-end;gap:8px;padding:8px}
`;
