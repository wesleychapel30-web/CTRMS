import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PromptAnchor = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

type PromptPosition = {
  top: number;
  left: number;
};

type ContextActionPromptProps = {
  open: boolean;
  anchor: PromptAnchor | null;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function getPromptPosition(anchor: PromptAnchor | null, width: number, height: number): PromptPosition {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const padding = 16;
  const gap = 12;

  if (!anchor) {
    return {
      top: Math.max((viewportHeight - height) / 2, padding),
      left: Math.max((viewportWidth - width) / 2, padding)
    };
  }

  const preferredLeft = Math.min(anchor.left, viewportWidth - width - padding);
  const alignedLeft = Math.max(padding, preferredLeft);
  const rightAlignedLeft = Math.max(padding, Math.min(anchor.right - width, viewportWidth - width - padding));
  const left = anchor.width > width * 0.8 ? alignedLeft : rightAlignedLeft;

  const spaceBelow = viewportHeight - anchor.bottom - padding;
  const spaceAbove = anchor.top - padding;
  let top = anchor.bottom + gap;

  if (spaceBelow < height + gap && spaceAbove > height + gap) {
    top = anchor.top - height - gap;
  }

  top = Math.min(Math.max(top, padding), viewportHeight - height - padding);

  return { top, left };
}

export function ContextActionPrompt({
  open,
  anchor,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isSubmitting = false,
  onCancel,
  onConfirm
}: ContextActionPromptProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PromptPosition>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      const width = rect?.width ?? 352;
      const height = rect?.height ?? 180;
      setPosition(getPromptPosition(anchor, width, height));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchor, title, message, isSubmitting]);

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close confirmation prompt"
        onClick={onCancel}
        className="fixed inset-0 z-50 bg-slate-950/14 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        className="context-prompt-enter surface-panel fixed z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--line)] bg-[color:var(--surface)]/96 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        <h4 className="headline-font text-base font-bold text-[var(--ink)]">{title}</h4>
        <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="secondary-button interactive-press rounded-sm px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="primary-button interactive-press rounded-sm px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {isSubmitting ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
