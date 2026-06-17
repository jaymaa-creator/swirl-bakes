import { ALLERGEN_NAMES } from "../config/products";

export default function MenuSection({ menu, quantityOptions, form, setForm, allergenDisclaimer }) {
  return (
    <section
      id="menu"
      className="mx-auto max-w-6xl rounded-[28px] bg-[#F3ECE4] px-4 py-12 sm:py-16"
      style={{
        background:
          "radial-gradient(circle at 85% 15%, rgba(196,122,58,0.08), transparent 58%)",
      }}
    >
      <div className="max-w-3xl">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Available This Week</h2>
        <div className="mt-8 space-y-5">
          {menu.map((m) => (
            <div
              key={m.id}
              className="rounded-3xl border border-line bg-surface px-5 py-6 shadow-[0_8px_24px_rgba(90,56,37,0.08)]"
            >
              <div className="text-xl font-bold tracking-tight text-ink">{m.name}</div>
              <p className="mt-2 text-sm leading-relaxed text-inkMuted">{m.note}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {quantityOptions.map((qty) => {
                  const isSelected = Number(form.items[m.id] || 0) === qty;
                  return (
                    <button
                      key={`${m.id}-${qty}`}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          items: {
                            ...f.items,
                            [m.id]: Number(f.items[m.id] || 0) === qty ? 0 : qty,
                          },
                        }))
                      }
                      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                        isSelected
                          ? "border-brandBrown bg-brandBrown text-white"
                          : "border-[#DCCEBF] bg-transparent text-inkMuted hover:border-brandCinnamon"
                      }`}
                      aria-pressed={isSelected}
                    >
                      {qty}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 text-xs text-inkMuted">{m.allergens}</div>
            </div>
          ))}
        </div>
        {allergenDisclaimer ? (
          <p className="mt-6 text-xs text-inkMuted">
            Baked in a home kitchen. Allergens present in the kitchen may include:{" "}
            {ALLERGEN_NAMES.map((name, i) => (
              <span key={name}>
                <strong className="font-semibold text-ink">{name}</strong>
                {i < ALLERGEN_NAMES.length - 1 ? ", " : ". "}
              </span>
            ))}
            We cannot guarantee any item is free from cross-contamination. Please let us know of any allergies in your order notes.
          </p>
        ) : null}
      </div>
    </section>
  );
}
