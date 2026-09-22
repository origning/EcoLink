import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function PageTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="min-w-0 text-lg font-semibold sm:text-xl">{title}</h2>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  danger,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-full px-3 py-1.5 text-sm font-medium ${
        danger ? "text-[var(--danger)]" : "text-[var(--brand)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[var(--line)] ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[var(--muted)]">
        {label}
        {hint ? (
          <span className="ml-1 text-xs font-normal text-[var(--muted)] opacity-70">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base outline-none focus:border-[var(--brand)] ${props.className ?? "w-full"}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base outline-none focus:border-[var(--brand)] ${props.className ?? ""}`}
    />
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <p className="py-8 text-center text-sm text-[var(--muted)]">{text}</p>
    </Card>
  );
}

export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
      <div className="max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)-1rem))] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 text-xl leading-none text-[var(--muted)]"
            aria-label="close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Thumb({
  src,
  alt,
  size = 48,
}: {
  src?: string;
  alt: string;
  size?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl bg-[var(--brand-soft)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--brand)]">
          —
        </div>
      )}
    </div>
  );
}
