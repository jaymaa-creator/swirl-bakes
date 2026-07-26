export default function WhatsAppHandoffNotice({ whatsappLink, onDismiss }) {
  if (!whatsappLink) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] px-4 sm:bottom-6" role="status">
      <div className="mx-auto max-w-xl rounded-card border border-brandCinnamon/35 bg-surface p-4 shadow-[0_18px_48px_rgba(43,33,27,0.24)] sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DCF8C6] text-lg font-bold text-[#1B5E20]"
            aria-hidden="true"
          >
            W
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-ink">Your WhatsApp order is ready</div>
            <p className="mt-1 text-sm leading-6 text-inkMuted">
              WhatsApp should have opened in a new tab. Review the prefilled message and tap Send to submit your reservation.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-2 py-1 text-sm text-inkMuted hover:bg-cream"
            aria-label="Dismiss WhatsApp confirmation"
          >
            Close
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 pl-[52px]">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-button bg-[#1B5E20] px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:-translate-y-px"
          >
            Open WhatsApp again
          </a>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex rounded-button border border-line bg-surface px-4 py-2.5 text-sm font-medium text-inkMuted hover:bg-cream"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
