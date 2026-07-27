import Card from "./ui/Card";

export default function ConfirmationSection({ brand, isOrderStarted }) {
  return (
    <section id="confirmation" className="mx-auto max-w-6xl px-4 pb-18 pt-2 sm:pb-24">
      <Card>
        <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-reveal="left">
            <div className="text-xs uppercase tracking-[0.22em] text-inkMuted">How to order</div>
            <h2 className="mt-3 text-3xl text-ink sm:text-4xl">
              {isOrderStarted ? "Send your WhatsApp order." : "Order by WhatsApp."}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-inkMuted sm:text-[1rem]">
              Choose your bakes, send the prefilled message, then wait for confirmation and PayNow details.
            </p>
            <div className="mt-6 inline-flex rounded-full border border-brandCinnamon/35 bg-[#F7EBDD] px-4 py-2 text-sm font-medium text-brandBrown">
              Order by {brand.orderCutoffLabel}
            </div>
          </div>

          <div className="rounded-card border border-line bg-cream p-5" data-reveal="right">
            <ol className="space-y-3 text-sm leading-6 text-inkMuted">
              <li><strong className="font-semibold text-ink">1.</strong> Pick your items.</li>
              <li><strong className="font-semibold text-ink">2.</strong> Send the WhatsApp message.</li>
              <li><strong className="font-semibold text-ink">3.</strong> Collect or arrange delivery on Saturday.</li>
            </ol>
          </div>
        </div>
      </Card>
    </section>
  );
}
