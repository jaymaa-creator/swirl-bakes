import { useMemo, useState } from "react";
import { ALLERGEN_NAMES } from "../config/products";

export default function MenuSection({ menu, quantityOptions, form, setForm, allergenDisclaimer }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const filters = useMemo(() => ["All", ...new Set(menu.map((item) => item.category))], [menu]);
  const visibleItems = useMemo(
    () => (activeFilter === "All" ? menu : menu.filter((item) => item.category === activeFilter)),
    [activeFilter, menu]
  );

  return (
    <section
      id="menu"
      className="mx-auto max-w-6xl rounded-[28px] bg-[#F3ECE4] px-4 py-12 sm:py-16"
      style={{
        background:
          "radial-gradient(circle at 85% 15%, rgba(196,122,58,0.08), transparent 58%)",
      }}
    >
      <div className="max-w-5xl">
        <div className="max-w-3xl" data-reveal="left">
          <div className="text-xs uppercase tracking-[0.2em] text-inkMuted">Menu</div>
          <h2 className="mt-2 text-3xl text-ink sm:text-4xl">Available this week</h2>
          <p className="mt-3 text-sm leading-7 text-inkMuted sm:text-[1rem]">
            Choose your bakes, then reserve through WhatsApp.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2" data-reveal="up">
          {filters.map((filter) => {
            const isActive = filter === activeFilter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-brandBrown bg-brandBrown text-white"
                    : "border-line bg-surface text-inkMuted hover:border-brandCinnamon hover:text-ink"
                }`}
                aria-pressed={isActive}
              >
                {filter}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {visibleItems.map((m) => {
            const quantityChoices = m.quantityOptions || quantityOptions;
            const isAvailable = m.available !== false;

            return (
              <div
                key={m.id}
                className={`overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_8px_24px_rgba(90,56,37,0.08)] ${
                  isAvailable ? "" : "opacity-75"
                }`}
                data-reveal="up"
              >
                <img
                  src={m.image}
                  alt={m.imageAlt}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="px-5 py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-inkMuted">{m.category}</div>
                      <div className="mt-2 text-2xl text-ink">{m.name}</div>
                    </div>
                    <span className="rounded-full bg-[#F7EBDD] px-3 py-1 text-xs font-semibold text-brandBrown">
                      {isAvailable ? m.badge : "Sold out this week"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-inkMuted">{m.note}</p>
                  {m.ingredients ? (
                    <div className="mt-4 rounded-card bg-cream px-3 py-3 text-xs leading-5 text-inkMuted">
                      <span className="font-semibold text-ink">Ingredients: </span>
                      {m.ingredients.join(", ")}
                    </div>
                  ) : null}
                  <div className="mt-4 text-sm font-semibold text-ink">S${m.priceSgd} {m.unitLabel || "each"}</div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {quantityChoices.map((qty) => {
                      const isSelected = Number(form.items[m.id] || 0) === qty;
                      return (
                        <button
                          key={`${m.id}-${qty}`}
                          type="button"
                          disabled={!isAvailable}
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
                              : "border-[#DCCEBF] bg-transparent text-inkMuted hover:border-brandCinnamon disabled:cursor-not-allowed disabled:opacity-45"
                          }`}
                          aria-pressed={isSelected}
                        >
                          {qty} {qty === 1 ? m.quantityLabel || "item" : m.quantityLabelPlural || "items"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-xs text-inkMuted">{m.allergens}</div>
                </div>
              </div>
            );
          })}
        </div>
        {allergenDisclaimer ? (
          <p className="mt-6 max-w-4xl text-xs leading-6 text-inkMuted" data-reveal="up">
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
