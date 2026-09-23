import Card from "./ui/Card";

function StepIcon({ kind }) {
  if (kind === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    );
  }

  if (kind === "payment") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6.5 15h4.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3.5 8.5 12 4l8.5 4.5-8.5 4.5z" />
      <path d="M3.5 8.5V17L12 21l8.5-4V8.5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export default function ProcessSection({ brand, brandColors }) {
  const deliveryMinimum = `S$${brand.deliveryMinimumSgd}`;
  const deliveryFee = `S$${brand.deliveryFeeSgd}`;

  return (
    <section
      id="how"
      className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20"
      style={{
        background:
          "linear-gradient(to bottom, #F7F3EE 0%, #FBF8F4 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute left-4 top-8 h-40 w-[min(520px,85%)] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 22% 35%, rgba(196,122,58,0.1), rgba(196,122,58,0.03) 45%, transparent 72%)",
        }}
        aria-hidden="true"
      />
      <div
        className="relative mb-4 h-1 w-12 rounded-full"
        style={{ backgroundColor: brandColors.brown }}
        aria-hidden="true"
      />
      <div className="relative max-w-3xl" data-reveal="left">
        <div className="text-xs tracking-[0.2em] uppercase text-inkMuted">Process</div>
        <h2 className="mt-2 text-3xl text-ink sm:text-4xl">How Saturday batches work</h2>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "1",
            icon: "calendar",
            title: "Choose your bakes",
            body: "Pick from the current menu.",
          },
          {
            step: "2",
            icon: "payment",
            title: "Review and reserve",
            body: "Check your order details, then reserve via WhatsApp. PayNow details follow confirmation.",
          },
          {
            step: "3",
            icon: "delivery",
            title: "Collect or deliver",
            body: `Pickup is in Joo Chiat. Delivery is available from ${deliveryMinimum} with a flat ${deliveryFee} fee.`,
          },
        ].map((s) => (
          <div
            key={s.step}
            className={`rounded-3xl border bg-surface shadow-card ${
              s.step === "2"
                ? "border-brandCinnamon/35 bg-[rgba(196,122,58,0.06)]"
                : "border-line/70"
            }`}
            data-reveal="up"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div
                  className="relative h-12 w-12 rounded-full flex items-center justify-center text-base font-extrabold text-white shadow-md ring-1 ring-[#8B5938]/40"
                  style={{ backgroundColor: brandColors.brown }}
                >
                  <span
                    className="pointer-events-none absolute inset-[3px] rounded-full border border-white/20"
                    aria-hidden="true"
                  />
                  <span className="relative">{s.step}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center text-xs" style={{ color: brandColors.brown }}>
                    <StepIcon kind={s.icon} />
                  </span>
                  <div className="text-base font-bold tracking-tight text-ink">{s.title}</div>
                </div>
              </div>
              <div className="mt-5 max-w-[260px] text-[0.9rem] text-inkMuted leading-7">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-line/70 bg-surface p-5 shadow-card" data-reveal="up">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div>
            <div className="text-sm font-semibold text-ink">Delivery and pickup</div>
            <div className="mt-2 text-sm leading-6 text-inkMuted">
              Delivery is available from {deliveryMinimum} with a flat {deliveryFee} fee. Pickup details are confirmed after your order is accepted.
            </div>
          </div>
          <div className="hidden h-10 w-px bg-line/80 lg:block" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-ink">Good to know</div>
            <div className="mt-2 text-sm leading-6 text-inkMuted">
              Pre-orders close at {brand.orderCutoffLabel}.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
