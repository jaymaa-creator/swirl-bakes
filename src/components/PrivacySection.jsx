import Card from "./ui/Card";

export default function PrivacySection({ brand }) {
  return (
    <section id="privacy" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <Card>
        <div className="p-6 sm:p-8" data-reveal="up">
          <div className="text-xs uppercase tracking-[0.22em] text-inkMuted">Privacy</div>
          <h2 className="mt-3 text-3xl text-ink sm:text-4xl">How we use order details.</h2>
          <div className="mt-5 grid gap-5 text-sm leading-7 text-inkMuted sm:grid-cols-2">
            <div>
              <div className="font-semibold text-ink">What we collect</div>
              <p className="mt-2">
                We collect your name, WhatsApp number, email, order details, and collection or delivery information to manage your reservation.
              </p>
            </div>
            <div>
              <div className="font-semibold text-ink">How we use it</div>
              <p className="mt-2">
                Your details are used only to confirm, prepare, and fulfil your order, including arranging a courier where requested. We do not sell personal data.
              </p>
            </div>
            <div>
              <div className="font-semibold text-ink">Where it goes</div>
              <p className="mt-2">
                Order requests are handled through Cloudflare and Google Sheets, with WhatsApp used for confirmation. Delivery details are shared only with the selected courier when needed.
              </p>
            </div>
            <div>
              <div className="font-semibold text-ink">Keeping it safe</div>
              <p className="mt-2">
                We keep order records only as long as needed for fulfilment, customer support, and legal or accounting requirements. Do not include card details, NRIC details, or unnecessary sensitive information in your notes.
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs leading-6 text-inkMuted">
            For questions about your order data, contact {brand.name} via{" "}
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
      </Card>
    </section>
  );
}
