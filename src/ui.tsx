import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Small look-alikes of the Material UI pieces the GenQR designer uses (Paper, outlined
 * TextField, ToggleButtonGroup, Dialog, Alert, icons), so the generator matches it without
 * shipping MUI and React. The CSS is in styles.ts.
 */

// Material icon paths (Apache-2.0, google/material-design-icons).
const ICONS = {
  download: 'M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z',
  print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3m-3 11H8v-5h8zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m-1-9H6v4h12z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1M8 13h8v-2H8zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5',
  check: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z',
  warning: 'M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 15h-2v-2h2zm0-4h-2V7h2z',
  block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2M4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12m8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z',
  open: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z',
  qr: 'M15 21h-2v-2h2zm-2-7h-2v5h2zm8-2h-2v4h2zm-2-2h-2v2h2zM7 12H5v2h2zm-2-2H3v2h2zm7-5h2V3h-2zm-7.5-.5v3h3v-3zM9 9H3V3h6zm-4.5 7.5v3h3v-3zM9 21H3v-6h6zm7.5-16.5v3h3v-3zM21 9h-6V3h6zm-2 10v-3h-4v2h2v3h4v-2zm-2-7h-4v2h4zm-4-2H7v2h2v2h2v-2h2zm1-1V7h-2V5h-2v4zM6.75 5.25h-1.5v1.5h1.5zm0 12h-1.5v1.5h1.5zm12-12h-1.5v1.5h1.5z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  more: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  less: 'm12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  tune: 'M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  list: 'M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, class: cls = '' }: { name: IconName; class?: string }) {
  return (
    <svg class={`icon ${cls}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="paper section">
      <h3 class="subtitle">{title}</h3>
      <div class="stack">{children}</div>
    </section>
  );
}

let uid = 0;
const useId = (prefix: string) => useRef(`${prefix}-${++uid}`).current;

/** Outlined text field with the label on the border, like MUI's. */
export function Field({
  label,
  helper,
  error,
  width,
  children,
}: {
  label: string;
  helper?: ComponentChildren;
  error?: boolean;
  width?: number;
  children: (id: string) => ComponentChildren;
}) {
  const id = useId('f');
  return (
    <div class={`field${error ? ' has-error' : ''}`} style={width ? { width: `${width}px` } : undefined}>
      <label for={id}>{label}</label>
      {children(id)}
      {helper && <p class="helper">{helper}</p>}
    </div>
  );
}

export function ColourField({ label, value, onChange, disabled }: { label: string; value: string; onChange(v: string): void; disabled?: boolean }) {
  return (
    <Field label={label} width={140}>
      {(id) => <input id={id} type="color" class="colour" value={value} disabled={disabled} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />}
    </Field>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  width,
  helper,
}: {
  label: string;
  value: T;
  options: { value: NoInfer<T>; label: string }[];
  onChange(v: NoInfer<T>): void;
  disabled?: boolean;
  width?: number;
  helper?: string;
}) {
  return (
    <Field label={label} width={width} helper={helper}>
      {(id) => (
        <select
          id={id}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => {
            const raw = (e.target as HTMLSelectElement).value;
            onChange((typeof value === 'number' ? Number(raw) : raw) as T);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function ToggleGroup<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  return (
    <div class="toggle-wrap">
      {label && <span class="caption-label">{label}</span>}
      <div class="toggle-group" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" class={o.value === value ? 'toggle selected' : 'toggle'} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Check({ label, checked, onChange, switchStyle }: { label: string; checked: boolean; onChange(v: boolean): void; switchStyle?: boolean }) {
  return (
    <label class={switchStyle ? 'check switch' : 'check'}>
      <input type="checkbox" role={switchStyle ? 'switch' : undefined} checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Slider({ caption, value, min, max, step = 1, onChange, width = 220 }: { caption: string; value: number; min: number; max: number; step?: number; onChange(v: number): void; width?: number }) {
  return (
    <label class="slider" style={{ width: `${width}px` }}>
      <span class="caption">{caption}</span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} />
    </label>
  );
}

export function Alert({ severity, children, onClose }: { severity: 'success' | 'error' | 'warning' | 'info'; children: ComponentChildren; onClose?(): void }) {
  const icon: IconName = severity === 'success' ? 'check' : severity === 'warning' ? 'warning' : 'error';
  return (
    <div class={`alert ${severity}`} role={severity === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} />
      <div class="alert-body">{children}</div>
      {onClose && (
        <button type="button" class="icon-button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}

export function Button({
  variant = 'text',
  size,
  icon,
  full,
  disabled,
  onClick,
  type = 'button',
  title,
  children,
}: {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'large';
  icon?: IconName;
  full?: boolean;
  disabled?: boolean;
  onClick?(): void;
  type?: 'button' | 'submit';
  title?: string;
  children: ComponentChildren;
}) {
  return (
    <button type={type} class={`btn ${variant}${size ? ' ' + size : ''}${full ? ' full' : ''}`} disabled={disabled} onClick={onClick} title={title}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      class="icon-button"
      title={copied ? 'Copied' : 'Copy'}
      aria-label={copied ? 'Copied' : 'Copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked (e.g. not https): the link is selectable text anyway
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} />
    </button>
  );
}

/** Modal dialog on the native <dialog> element (focus trap and Esc come for free). */
export function Dialog({ open, title, onClose, actions, children }: { open: boolean; title: string; onClose(): void; actions: ComponentChildren; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      class="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      <h2 class="dialog-title">{title}</h2>
      <div class="dialog-content stack">{children}</div>
      <div class="dialog-actions">{actions}</div>
    </dialog>
  );
}
