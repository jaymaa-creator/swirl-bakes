import Card from "./ui/Card";

export default function FaqSection({ faq }) {
  return (
    <section
      className="mx-auto max-w-6xl rounded-[28px] bg-[#F5EFE8] px-4 py-12 sm:py-16"
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(196,122,58,0.06), transparent 58%)",
      }}
    >
      <div className="max-w-3xl">
        <div className="text-xs tracking-[0.2em] uppercase text-inkMuted">FAQ</div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-ink">Quick answers</h2>
        <p className="mt-3 text-inkMuted leading-relaxed">Keep it short. People skim.</p>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {faq.map((f) => (
          <Card key={f.q}>
            <div className="p-5">
              <div className="text-sm font-semibold">{f.q}</div>
              <div className="mt-2 text-sm text-inkMuted leading-relaxed">{f.a}</div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
