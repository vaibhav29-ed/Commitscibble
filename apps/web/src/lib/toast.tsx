import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "./cn";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (toast: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [leavingIds, setLeavingIds] = useState<Set<number>>(new Set());

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setLeavingIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setLeavingIds((current) => new Set(current).add(id));
      window.setTimeout(() => remove(id), 180);
    },
    [remove],
  );

  const push = useCallback(
    (toast: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Date.now() + Math.random();
      setItems((current) => [
        ...current.slice(-3),
        {
          id,
          variant: toast.variant ?? "info",
          title: toast.title,
          description: toast.description,
        },
      ]);
      window.setTimeout(() => dismiss(id), 7000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            data-leaving={leavingIds.has(item.id) ? "true" : undefined}
            className={cn(
              "motion-toast glass-panel-strong pointer-events-auto flex items-start gap-3 rounded-[14px] border p-3.5 shadow-[var(--shadow-float)]",
              item.variant === "error" && "border-rose-500/35",
              item.variant === "success" && "border-emerald-500/35",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]",
                item.variant === "success"
                  ? "tone-success"
                  : item.variant === "error"
                    ? "tone-danger"
                    : "tone-warn",
              )}
            >
              {item.variant === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : item.variant === "error" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[var(--text-primary)]">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
