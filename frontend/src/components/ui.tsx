import { AlertCircle, Loader2, X } from "lucide-react";
import {
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  CATEGORY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../lib/format";
import type { Category, DatasetInfo, IncidentStatus, Origin } from "../lib/types";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const inputClass =
  "h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10";

export const selectClass =
  "h-9 w-full appearance-none rounded-md border border-line bg-white px-3 pr-8 text-[13px] text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[12px]" : "h-9 px-4 text-[13px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-dark",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-canvas",
        variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        size === "sm" ? "h-8 px-3 text-[12px]" : "h-9 px-4 text-[13px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-dark",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-canvas",
        variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge className={STATUS_BADGE_CLASSES[status]}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return <Badge className={CATEGORY_BADGE_CLASSES[category]}>{category}</Badge>;
}

export function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <Badge
      className={
        origin === "demo"
          ? "border-[#D0D5DD] bg-[#F9FAFB] text-[#475467]"
          : "border-[#B2DDFF] bg-[#EFF8FF] text-[#175CD3]"
      }
    >
      {origin === "demo" ? "Demo" : "Live"}
    </Badge>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[23px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  meta,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cx("rounded-card border border-line bg-surface px-4 py-4 shadow-card", className)}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />}
        {label}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-8 tracking-[-0.03em] text-ink tabular-nums">
        {value}
      </div>
      {meta && <div className="mt-1 text-[12px] leading-4 text-muted">{meta}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-[#FAFBFC] text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
      )}
    >
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-md text-[12px] leading-5 text-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = "Could not load this section",
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="rounded-card border border-[#FECDCA] bg-[#FFFCFC] px-5 py-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B42318]" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-medium text-ink">{title}</p>
          <p className="mt-1 text-[12px] leading-5 text-muted">{message}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("h-4 w-4 animate-spin text-muted", className)} aria-hidden="true" />;
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cx("animate-pulse rounded bg-[#EDEFF2]", className)} style={style} />;
}

export function ChartSkeleton() {
  return (
    <div className="flex h-full w-full items-end gap-2 pb-6">
      {[38, 62, 46, 78, 55, 70, 42, 66, 52, 74, 48, 60].map((height, index) => (
        <Skeleton key={index} className="flex-1" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-muted">
        Page {page} of {pages} · {total.toLocaleString("en-IN")} records
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink/30 animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-md rounded-card border border-line bg-white shadow-panel animate-fade-in"
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-[15px] font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-[12px] leading-5 text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded p-1 text-muted hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function DemoNotice({
  dataset,
}: {
  dataset: Pick<DatasetInfo, "demo" | "live" | "total">;
}) {
  if (!dataset.demo) return null;
  return (
    <div className="mb-5 flex flex-col gap-2 rounded-card border border-[#D1E0FF] bg-[#F5F8FF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <p className="text-[12px] leading-5 text-[#344054]">
          <span className="font-medium text-ink">Demonstration data is included.</span>{" "}
          {dataset.demo.toLocaleString("en-IN")} of {dataset.total.toLocaleString("en-IN")} records
          are synthetic samples for academic evaluation. Live records are labelled by source.
        </p>
      </div>
      <Link
        to="/data-sources"
        className="shrink-0 text-[12px] font-medium text-accent hover:text-accent-dark"
      >
        Review data sources →
      </Link>
    </div>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-line bg-white p-0.5"
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cx(
            "rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
            value === option.value
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4">
      <div>
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
