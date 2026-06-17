export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 cursor-pointer bg-brandBrown/35" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl max-h-[85dvh] sm:max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_20px_40px_rgba(90,56,37,0.14)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface p-3 sm:p-4">
          <div className="text-base sm:text-lg font-semibold text-ink">{title}</div>
          <button
            onClick={onClose}
            className="touch-manipulation rounded-xl border border-line px-3 py-1.5 text-sm text-inkMuted hover:bg-[#F1E8DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="Close preorder modal"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 p-3 sm:p-4 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
