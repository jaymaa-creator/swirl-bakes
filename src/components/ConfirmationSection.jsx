import Card from "./ui/Card";

export default function ConfirmationSection({ brand, isOrderStarted }) {
  return (
    <section id="confirmation" className="mx-auto max-w-6xl px-4 pb-18 pt-2 sm:pb-24">
      <Card>
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div data-reveal="left">
            <div className="text-xs uppercase tracking-[0.22em] text-inkMuted">Confirmation</div>
            <h2 className="mt-3 text-3xl text-ink sm:text-4xl">
              {isOrderStarted ? "WhatsApp opened. Here’s what happens next." : "Ordering flow, without guesswork."}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-inkMuted sm:text-[1rem]">
              {isOrderStarted
                ? "Send the prefilled WhatsApp message to lock your request in. Swirl Girl Bakes then confirms availability, total cost, and your collection or courier timing before anything is baked."
                : "Once you tap through to WhatsApp, your order message is prefilled so there’s less back-and-forth. You’ll get confirmation, payment details, and handoff timing before bake day."}
            </p>
            <div className="mt-6 inline-flex rounded-full border border-brandCinnamon/35 bg-[#F7EBDD] px-4 py-2 text-sm font-medium text-brandBrown">
              Weekly cut-off: {brand.orderCutoffLabel}
            </div>
          </div>

          <div className="grid gap-4" data-reveal="right">
            <div className="rounded-card border border-line bg-cream p-5">
              <div className="text-sm font-semibold text-ink">1. Send the WhatsApp order</div>
              <p className="mt-2 text-sm leading-6 text-inkMuted">
                Review the message, add any notes, and send it through directly to {brand.name}.
              </p>
            </div>
            <div className="rounded-card border border-line bg-cream p-5">
              <div className="text-sm font-semibold text-ink">2. Receive confirmation and payment details</div>
              <p className="mt-2 text-sm leading-6 text-inkMuted">
                Availability, PayNow instructions, and delivery or collection timing are confirmed before the bake begins.
              </p>
            </div>
            <div className="rounded-card border border-line bg-cream p-5">
              <div className="text-sm font-semibold text-ink">3. Pick up or dispatch on Saturday</div>
              <p className="mt-2 text-sm leading-6 text-inkMuted">
                Collection details are shared after confirmation. Courier orders go out fresh through GrabExpress or Lalamove, paid by the customer.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
