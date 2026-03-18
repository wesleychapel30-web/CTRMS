import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ToastMessage, type ToastRecord, type ToastVariant } from "../components/ToastMessage";

type ToastInput = {
  title?: string;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (variant: ToastVariant, input: ToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const EXIT_DELAY_MS = 180;
const DEFAULT_DURATION_MS = 3400;

const defaultTitles: Record<ToastVariant, string> = {
  success: "Success",
  error: "Action failed",
  warning: "Check this",
  info: "Update",
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = (id: string) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, EXIT_DELAY_MS);
  };

  const showToast = (variant: ToastVariant, input: ToastInput) => {
    const toast: ToastRecord = {
      id: crypto.randomUUID(),
      title: input.title || defaultTitles[variant],
      message: input.message,
      variant,
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
    };
    setToasts((current) => [...current, toast].slice(-4));
  };

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, title) => showToast("success", { message, title }),
      error: (message, title) => showToast("error", { message, title }),
      warning: (message, title) => showToast("warning", { message, title }),
      info: (message, title) => showToast("info", { message, title }),
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[95] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-3 sm:right-6">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
