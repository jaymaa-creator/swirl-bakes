export default function FaqSection({ faq }) {
  return (
    <section className="mx-auto max-w-6xl px-4">
      <details className="group rounded-[24px] border border-line bg-[#F5EFE8] shadow-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-xl font-semibold text-ink marker:content-none sm:px-7">
          <span>FAQ</span><span className="text-2xl font-normal text-brandBrown transition-transform group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="grid gap-3 border-t border-line px-5 py-5 lg:grid-cols-2 sm:px-7">
          {faq.map((f) => <div key={f.q} className="rounded-2xl bg-surface p-5"><div className="text-sm font-semibold">{f.q}</div><div className="mt-2 text-sm leading-relaxed text-inkMuted">{f.a}</div></div>)}
        </div>
      </details>
    </section>
  );
}
