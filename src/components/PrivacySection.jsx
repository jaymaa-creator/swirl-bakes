export default function PrivacySection({ brand }) {
  return (
    <section id="privacy" className="mx-auto max-w-6xl px-4">
      <details className="group rounded-[24px] border border-line bg-surface shadow-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-xl font-semibold text-ink marker:content-none sm:px-7">
          <span>Privacy</span><span className="text-2xl font-normal text-brandBrown transition-transform group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="border-t border-line p-6 sm:p-8">
          <div className="mt-5 grid gap-5 text-sm leading-7 text-inkMuted sm:grid-cols-2">
            <div>
              <div className="font-semibold text-ink">What we keep</div>
              <p className="mt-2">
                Your name, WhatsApp number, order details, and collection or delivery information.
              </p>
            </div>
            <div>
              <div className="font-semibold text-ink">How we use it</div>
              <p className="mt-2">
                To confirm, prepare, and fulfil your order. We do not sell personal data.
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs leading-6 text-inkMuted">
            Orders are handled through Cloudflare, WhatsApp, and Google Sheets. Please do not include card details, NRIC details, or other sensitive information in your notes. For questions about your order data, contact {brand.name} via{" "}
            <a
              href={brand.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brandBrown underline decoration-brandCinnamon/50 underline-offset-4"
            >
              {brand.instagramHandle}
            </a>
            .
          </p>
        </div>
      </details>
    </section>
  );
}
