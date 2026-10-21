import { useEffect } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";

export function BrandMark({
  size = 34,
  className = "",
  alt = "EcoLink",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}ecolink-logo.png`}
      alt={alt}
      draggable={false}
      className={`shrink-0 object-contain ${className}`}
      style={{ height: size, width: "auto" }}
    />
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[22px] font-bold tracking-tight sm:text-[24px]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
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
      className={`ui-primary inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  danger,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-transparent px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--surface)] active:scale-[0.99] disabled:opacity-50 ${
        danger
          ? "text-[var(--danger)] hover:bg-red-50"
          : "text-[var(--ink)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)] ${className}`}
    >
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
      <span className="flex items-baseline justify-between gap-2 text-xs font-semibold text-[var(--muted)]">
        <span>{label}</span>
        {hint ? (
          <span className="text-[10px] font-normal text-[var(--muted-2)]">
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
      className={`min-h-10 rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted-2)] sm:text-sm ${props.className ?? "w-full"}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted-2)] sm:text-sm ${props.className ?? ""}`}
    />
  );
}

export function SearchInput({
  value,
  onValueChange,
  placeholder,
  clearLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  clearLabel?: string;
}) {
  return (
    <div className="relative">
      <svg
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-2)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <TextInput
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className="w-full pl-9 pr-11"
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel ?? "clear"}
          onClick={() => onValueChange("")}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-base text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--muted-2)] ring-1 ring-[var(--line)]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 8.5 12 4l7 4.5v7L12 20l-7-4.5v-7Z" />
            <path d="M5 8.5 12 13l7-4.5M12 13v7" />
          </svg>
        </span>
        <p className="max-w-sm text-sm text-[var(--muted)]">{text}</p>
      </div>
    </div>
  );
}

export function Sheet({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const content = (
    <div className="backdrop-in fixed inset-0 z-40 flex items-end justify-center overscroll-contain bg-black/40 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        className={`sheet-in flex max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-1rem))] w-full flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_32px_80px_-24px_rgba(23,23,23,0.45)] ${
          wide
            ? "max-w-lg sm:max-w-3xl lg:max-w-5xl"
            : "max-w-lg sm:max-w-xl lg:max-w-2xl"
        }`}
      >
        <span
          aria-hidden
          className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full bg-[var(--line-strong)] sm:hidden"
        />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <h3 className="truncate text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
            aria-label="close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );

  return typeof document === "undefined"
    ? content
    : createPortal(content, document.body);
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
      className="shrink-0 overflow-hidden rounded-[10px] bg-[var(--surface)] ring-1 ring-[var(--line)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted-2)]">
          —
        </div>
      )}
    </div>
  );
}
