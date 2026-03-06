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

export default function ProcessSection({ brandColors, deliveryOptions }) {
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
      <div className="relative max-w-3xl">
        <div className="text-xs tracking-[0.2em] uppercase text-inkMuted">Process</div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-ink">How Saturday batches work</h2>
        <p className="mt-3 text-inkMuted leading-relaxed">
          A small-batch flow designed for limited weekly production.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "1",
            icon: "calendar",
            title: "Reserve your slot",
            body: "Choose your items and select a Saturday batch date.",
          },
          {
            step: "2",
            icon: "payment",
            title: "Confirm and pay",
            body: "We confirm availability and total, then share payment details.",
          },
          {
            step: "3",
            icon: "delivery",
            title: "Bake then deliver",
            body: "We bake fresh on Saturday and dispatch via GrabExpress/Lalamove or arrange collection.",
          },
        ].map((s) => (
          <div
            key={s.step}
            className={`rounded-3xl border bg-surface shadow-card ${
              s.step === "2"
                ? "border-brandCinnamon/35 bg-[rgba(196,122,58,0.06)]"
                : "border-line/70"
            }`}
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

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-5">
            <div className="text-sm font-semibold">Delivery options</div>
            <ul className="mt-3 space-y-2 text-sm text-inkMuted">
              {deliveryOptions.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#C47A3A]" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-xs text-inkMuted">
              You can keep it manual: customer pays courier fee directly, or you quote it before dispatch.
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="text-sm font-semibold">Food safety and freshness</div>
            <div className="mt-3 text-sm text-inkMuted leading-relaxed">
              Rolls are packed after cooling to prevent condensation. Reheat instructions are included.
              You control bake windows to keep quality high.
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
