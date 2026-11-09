import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, Check, Copy, Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";

export type IconType = ComponentType<{ className?: string }>;

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "light"
  | "glass";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[#251f19] text-white hover:bg-[#3a3128] shadow-[0_6px_16px_rgba(37,31,25,0.18)] dark:bg-[#f5f2ec] dark:text-[#251f19] dark:hover:bg-white",
  accent:
    "bg-[#f48d16] text-white hover:bg-[#e07d0c] shadow-[0_6px_16px_rgba(244,141,22,0.28)]",
  secondary:
    "bg-[#eeede6] text-[#251f19] hover:bg-[#e3e1d7] dark:bg-[#2a251f] dark:text-[#f5f2ec] dark:hover:bg-[#352e27]",
  outline:
    "theme-surface border text-[var(--text-primary)] hover:border-[var(--border-strong)]",
  ghost:
    "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#eeede6] dark:hover:bg-[#2a251f]",
  danger: "bg-rose-700 text-white hover:bg-rose-800",
  success: "bg-emerald-700 text-white hover:bg-emerald-800",
  light: "bg-white text-[#251f19] hover:bg-white/90 shadow-[0_10px_24px_rgba(37,31,25,0.2)]",
  glass:
    "bg-white/15 text-white border border-white/30 backdrop-blur-md hover:bg-white/25",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-[11px] rounded-[8px] gap-1.5",
  md: "px-3.5 py-2 text-[12px] rounded-[10px] gap-1.5",
  lg: "px-5 py-3 text-[14px] rounded-[10px] gap-2",
  icon: "h-8 w-8 justify-center rounded-[9px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconType;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium tracking-normal transition-all duration-200 ease-smooth active:scale-[0.985] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("framer-spinner", size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
      ) : Icon ? (
        <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      ) : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card overflow-hidden p-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-[var(--border-soft)] bg-[var(--panel-soft)] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("dash-h3 text-[15px]", className)}>{children}</h2>;
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-[12px] leading-[1.6] text-[var(--text-secondary)]", className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function Panel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("card p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function PanelTitle({
  title,
  hint,
  icon: Icon,
  action,
}: {
  title: ReactNode;
  hint?: string;
  icon?: IconType;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {Icon ? <Icon className="mt-1 h-4 w-4 shrink-0 text-[#f48d16]" /> : null}
        <div>
          <h2 className="dash-h3">{title}</h2>
          {hint ? <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{hint}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "glass-panel mb-5 flex flex-wrap items-center gap-2 rounded-[16px] border p-3 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TILE_TONES = {
  orange: "bg-[#f48d16] text-white shadow-[0_6px_14px_rgba(244,141,22,0.28)]",
  dark: "bg-[#251f19] text-[#f48d16] shadow-[0_6px_14px_rgba(37,31,25,0.2)]",
  blue: "bg-[#0000ee] text-white shadow-[0_6px_14px_rgba(0,0,238,0.22)]",
  green: "bg-[#15803d] text-white shadow-[0_6px_14px_rgba(21,128,61,0.22)]",
  rose: "bg-rose-600 text-white shadow-[0_6px_14px_rgba(225,29,72,0.22)]",
} as const;

export function IconTile({
  icon: Icon,
  tone = "orange",
  size = "md",
}: {
  icon: IconType;
  tone?: keyof typeof TILE_TONES;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-10 w-10 rounded-[12px]",
        TILE_TONES[tone],
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}

/**
 * Shared dashboard page header: pill eyebrow, measured title, optional prose,
 * optional meta row (badges/pills) and a right-aligned action cluster.
 */
export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  icon?: IconType;
  title: ReactNode;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-[8px] bg-[#eeede6] px-2.5 py-1 text-[11px] font-medium text-[#251f19] dark:bg-[#2a251f] dark:text-[#f5f2ec]">
            {Icon ? <Icon className="h-3.5 w-3.5 text-[#f48d16]" /> : null}
            {eyebrow}
          </div>
        ) : null}
        <h1 className="dash-title text-balance">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge / status                                                             */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "success" | "danger" | "warning" | "accent" | "outline";
type Tone = "neutral" | "success" | "danger" | "warn" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "tone-neutral",
  success: "tone-success",
  danger: "tone-danger",
  warning: "tone-warn",
  accent: "tone-warn",
  outline: "bg-transparent text-[var(--text-secondary)] border border-[var(--border-soft)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "badge-pill inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Pill({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: IconType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "badge-pill inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium",
        `tone-${tone}`,
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, { tone: BadgeTone; label: string }> = {
  QUEUED: { tone: "outline", label: "Queued" },
  RUNNING: { tone: "warning", label: "Running" },
  SUCCEEDED: { tone: "success", label: "Succeeded" },
  FAILED: { tone: "danger", label: "Failed" },
  RETRYING: { tone: "warning", label: "Retrying" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
  PENDING: { tone: "warning", label: "Pending review" },
  APPROVED: { tone: "accent", label: "Approved" },
  REJECTED: { tone: "neutral", label: "Rejected" },
  APPLIED: { tone: "success", label: "Applied" },
  STALE: { tone: "warning", label: "Stale" },
  CONNECTED: { tone: "success", label: "Tracking" },
  PAUSED: { tone: "warning", label: "Paused" },
  DISCONNECTED: { tone: "neutral", label: "Disconnected" },
  CURRENT: { tone: "success", label: "Current" },
  NONE: { tone: "neutral", label: "No docs" },
  PENDING_REVIEW: { tone: "warning", label: "Review needed" },
  AUTOMATIC: { tone: "success", label: "Automatic" },
  REVIEW: { tone: "accent", label: "Review required" },
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  const entry = STATUS_TONES[value] ?? { tone: "neutral" as BadgeTone, label: value };
  const spinning = value === "RUNNING" || value === "RETRYING";
  return (
    <span
      className={cn(
        "badge-pill inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium capitalize",
        BADGE_TONES[entry.tone],
        className,
      )}
    >
      {spinning ? (
        <span className="framer-spinner h-2.5 w-2.5 rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {entry.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("dash-input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("dash-input", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("dash-input cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-[var(--text-primary)]">
        {children}
      </label>
      {hint ? <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{hint}</p> : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-[#f48d16]/40 bg-[#f48d16]" : "border-[var(--border-soft)] bg-[var(--surface-3)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--surface-3)]", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "framer-spinner inline-block h-4 w-4 rounded-full border-2 border-[#f48d16] border-t-transparent",
        className,
      )}
    />
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]", className)}>
      <div
        className="progress-fill h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function CoverageRing({ value, size = 112 }: { value: number | null; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value ?? 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f48d16"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] font-medium leading-none text-[var(--text-primary)]">
          {value == null ? "—" : `${value}%`}
        </span>
        <span className="mt-1 text-[10px] text-[var(--text-secondary)]">coverage</span>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  body,
  action,
}: {
  icon?: ReactNode | IconType;
  title: string;
  description?: string;
  body?: string;
  action?: ReactNode;
}) {
  const copy = description ?? body ?? "";
  // Lucide icons are forwardRef objects rather than plain functions, so detect
  // both and only treat "has props" objects as already-rendered elements.
  const isComponent =
    typeof icon === "function" ||
    (typeof icon === "object" &&
      icon !== null &&
      "$$typeof" in icon &&
      !("props" in icon));
  const iconNode = isComponent ? (
    <IconTile icon={icon as IconType} tone="dark" />
  ) : icon ? (
    <div className="text-[var(--text-secondary)]">{icon as ReactNode}</div>
  ) : null;

  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center sm:py-12">
      {iconNode}
      <h3 className="dash-h3 mt-4">{title}</h3>
      {copy ? (
        <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-[var(--text-secondary)]">{copy}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function InlineError({ message, requestId }: { message: string; requestId?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[12px] border border-rose-500/25 bg-rose-500/5 p-3 text-[12px] text-rose-700 dark:text-rose-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>{message}</p>
        {requestId ? <p className="mt-1 font-mono text-[10px] opacity-70">Request {requestId}</p> : null}
      </div>
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value);
      }}
    >
      <Copy className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog                                                                     */
/* -------------------------------------------------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  style,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea",
    );
    first?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="motion-dialog-backdrop absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="motion-dialog-panel glass-panel-strong relative z-10 w-full max-w-lg rounded-[20px] border p-6 shadow-[var(--shadow-float)]"
        style={style}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="dash-h3 text-[18px]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[12px] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-1 dash-scroll",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-all duration-200",
            active === tab.id
              ? "bg-[#251f19] text-white shadow-xs dark:bg-[#f5f2ec] dark:text-[#251f19]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px]",
                active === tab.id
                  ? "bg-white/20 text-white dark:bg-black/10 dark:text-[#251f19]"
                  : "bg-[var(--surface-3)] text-[var(--text-secondary)]",
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f48d16]" />
      <span>{children}</span>
    </li>
  );
}
