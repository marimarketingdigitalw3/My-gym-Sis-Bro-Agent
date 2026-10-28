// Sistema de diseño: componentes accesibles y reutilizables. Los colores vienen del tema activo.
import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";

export { clsx as cx };

// ---------- Botones ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "inverse" | "inverse-outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-strong text-on-primary hover:opacity-90 shadow-sm",
  secondary: "bg-surface-2 text-text hover:bg-border/60",
  outline: "border border-border bg-surface text-text hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  // Para usar sobre fondos con degradado (tarjetas destacadas).
  inverse: "bg-white text-neutral-900 hover:bg-white/90 shadow-sm",
  "inverse-outline": "border border-white/50 text-white hover:bg-white/10",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, block, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant], SIZES[size], block && "w-full", className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-surface-2 disabled:opacity-40", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- Tarjetas ----------
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-card border border-border/60 bg-surface p-5 shadow-card sm:p-6", className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="card-icon mt-0.5 text-primary-strong">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------- Formularios ----------
export function Field({ label, hint, error, children, htmlFor, optional }: {
  label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(opcional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-text placeholder:text-muted/70 transition focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest }, ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx(inputBase, "h-11", invalid && "border-danger", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...rest }, ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={clsx(inputBase, "h-11 pr-8", invalid && "border-danger", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputBase, "min-h-[88px] py-2.5", className)} {...rest} />;
});

/** Botón seleccionable (opción única o múltiple). */
export function Chip({ selected, onClick, children, className, disabled }: {
  selected: boolean; onClick: () => void; children: ReactNode; className?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-40",
        selected ? "border-primary-strong bg-primary-strong text-on-primary shadow-sm" : "border-border/70 bg-surface text-text shadow-sm hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Tarjeta de opción grande para cuestionarios. */
export function OptionCard({ selected, onClick, title, description, icon }: {
  selected: boolean; onClick: () => void; title: ReactNode; description?: ReactNode; icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "flex w-full items-start gap-3 rounded-3xl border p-4 text-left shadow-sm transition",
        selected ? "border-primary-strong bg-surface ring-2 ring-primary-strong/40" : "border-border/70 bg-surface hover:bg-surface-2",
      )}
    >
      {icon && <span className="mt-0.5 text-primary-strong">{icon}</span>}
      <span>
        <span className="block font-semibold">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
    </button>
  );
}

export function Toggle({ checked, onChange, label, description, id }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={inputId} className="cursor-pointer">
        <span className="block font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </label>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-primary-strong" : "bg-border")}
      >
        <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-all", checked ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

// ---------- Indicadores ----------
export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "primary" | "success" | "warning" | "danger"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    primary: "bg-primary/15 text-primary-strong",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, max = 100, label, className }: { value: number; max?: number; label?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={clsx("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full bg-primary-strong transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, children, label, color = "var(--primary-strong)", track = "var(--surface-2)" }: {
  value: number; size?: number; stroke?: number; children?: ReactNode; label?: string; color?: string; track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct)} %`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`rgb(${track})`} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`rgb(${color})`} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary-strong">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm">
      <p className="font-semibold text-danger">Algo salió mal</p>
      <p className="mt-1 text-text">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger"; title?: ReactNode; children: ReactNode }) {
  const tones = {
    info: "border-primary/30 bg-primary/10",
    warning: "border-warning/30 bg-warning/10",
    danger: "border-danger/40 bg-danger/10",
  };
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={clsx("rounded-2xl border p-3.5 text-sm", tones[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-text/90">{children}</div>
    </div>
  );
}

// ---------- Modal (elemento <dialog> nativo: foco y Escape accesibles) ----------
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
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
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/50"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
            <IconButton label="Cerrar" onClick={onClose}><X className="h-5 w-5" /></IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-full border border-border/60 bg-surface/80 p-1 shadow-sm">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx(
            "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
            value === it.value ? "bg-primary-strong text-on-primary shadow-sm" : "text-muted hover:text-text",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display-hero text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-surface-2 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Confirmación dentro de la página (en lugar de window.confirm, que algunos navegadores y visores bloquean).
 * Uso: const [ask, dialog] = useConfirm(); if (!(await ask("¿Borrar?"))) return; … y renderizar {dialog}.
 */
export function useConfirm(): [(message: string, confirmLabel?: string) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<{ message: string; label: string; resolve: (ok: boolean) => void } | null>(null);
  const ask = useCallback((message: string, confirmLabel = "Confirmar") =>
    new Promise<boolean>((resolve) => setState({ message, label: confirmLabel, resolve })), []);
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  const dialog = (
    <Modal open={!!state} onClose={() => close(false)} title="Confirmar"
      footer={<><Button variant="ghost" onClick={() => close(false)}>Cancelar</Button><Button variant="danger" onClick={() => close(true)}>{state?.label}</Button></>}>
      <p className="text-sm">{state?.message}</p>
    </Modal>
  );
  return [ask, dialog];
}
