import { useEffect, useRef, useId } from "react";

export default function Modal({ open, onClose, title, children, footer, fullScreen = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => previousFocus?.focus?.();
  }, [open]);

  function handleKeyDown(event) {
    if (event.key === "Escape") onClose();
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
      event.preventDefault(); first.focus();
    }
  }
  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center ${fullScreen ? "p-0 sm:p-4" : "p-2 sm:p-4"}`}>
      <div className="absolute inset-0 cursor-pointer bg-brandBrown/35" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleKeyDown} className={`relative flex w-full max-w-2xl flex-col overflow-hidden border border-line bg-surface shadow-[0_20px_40px_rgba(90,56,37,0.14)] ${fullScreen ? "h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-2xl" : "max-h-[85dvh] sm:max-h-[90vh] rounded-2xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface p-3 sm:p-4">
          <div id={titleId} className="text-base sm:text-lg font-semibold text-ink">{title}</div>
          <button
            onClick={onClose}
            className="touch-manipulation rounded-xl border border-line px-3 py-1.5 text-sm text-inkMuted hover:bg-[#F1E8DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="Close preorder modal"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">{children}</div>
        {footer ? (
          <div className="shrink-0 z-10 border-t border-line bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
