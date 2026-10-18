/**
 * Styles for the generator. It lives in a Shadow DOM, so the theme cannot break it and it
 * cannot leak into the theme. Set --genqr-accent on the page to change the button colour.
 */
export const CSS = `
:host{all:initial;display:block;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.5;color:#1f2933;--accent:var(--genqr-accent,#0b5394)}
*,*::before,*::after{box-sizing:border-box}
.genqr{max-width:960px;margin:0 auto;padding:8px 0}
.title{font-size:1.75rem;line-height:1.25;margin:0 0 16px;font-weight:700;color:inherit}
label{display:flex;flex-direction:column;gap:4px;font-size:.875rem;font-weight:600;color:#3e4c59}
label.check{flex-direction:row;align-items:center;gap:6px;align-self:flex-end;padding-bottom:8px}
input,select,button{font:inherit;color:inherit}
input[type=url],input[type=number],select{border:1px solid #cbd2d9;border-radius:8px;padding:10px 12px;background:#fff;min-height:44px;font-weight:400;font-size:1rem}
input[type=url]{flex:1;min-width:0}
input[type=number]{width:130px}
input[type=color]{width:56px;height:44px;border:1px solid #cbd2d9;border-radius:8px;padding:4px;background:#fff;cursor:pointer}
input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:2px}
button{border:1px solid #cbd2d9;background:#fff;border-radius:8px;padding:10px 16px;min-height:44px;cursor:pointer;font-weight:600}
button:hover{background:#f5f7fa}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
button.primary:hover{filter:brightness(1.1)}
button:disabled{opacity:.6;cursor:default}
button.small{min-height:32px;padding:4px 12px;font-size:.875rem}
button.link{border:0;background:none;color:var(--accent);padding:8px 0;text-decoration:underline}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px}
.row.nowrap{flex-wrap:nowrap}
.create{max-width:640px}
.create>label{margin-bottom:6px}
.hint{font-size:.875rem;color:#616e7c;margin:0}
.error{color:#b42318;background:#fef3f2;border:1px solid #fecdca;border-radius:8px;padding:8px 12px;margin:8px 0 0;font-size:.9375rem}
.hp{position:absolute;left:-10000px;width:1px;height:1px;opacity:0}
.result{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:32px;align-items:start}
.preview{position:sticky;top:16px}
.qr{border:1px solid #e4e7eb;border-radius:12px;padding:12px;background:#fff}
.qr svg{display:block;width:100%;height:auto}
.scan{font-size:.875rem;margin:8px 0 0}
.scan.ok{color:#027a48}.scan.fail{color:#b54708}.scan.checking{color:#616e7c}
.short{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 4px;font-weight:600}
.short span{width:100%;font-size:.875rem;color:#3e4c59}
.short a{color:var(--accent);word-break:break-all;font-size:1.125rem}
.dest{font-size:.875rem;color:#616e7c;word-break:break-all;margin:0 0 20px}
.design,.downloads{border-top:1px solid #e4e7eb;padding-top:16px;margin-bottom:8px}
fieldset.logos{border:0;padding:0;margin:0 0 12px;display:flex;flex-wrap:wrap;gap:8px}
fieldset.logos legend{font-size:.875rem;font-weight:600;color:#3e4c59;margin-bottom:4px;padding:0}
button.logo{width:72px;height:56px;padding:6px;display:grid;place-items:center;font-weight:400;font-size:.875rem}
button.logo img{max-width:100%;max-height:100%;object-fit:contain}
button.logo.selected{border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,#fff)}
@media (max-width:700px){
  .result{grid-template-columns:1fr;gap:16px}
  .preview{position:static;max-width:320px;margin:0 auto;width:100%}
  .row.nowrap{flex-wrap:wrap}
  .row.nowrap button{width:100%}
}
`;
