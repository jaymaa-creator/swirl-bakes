import { useMemo, useState } from "react";
import { ALLERGEN_NAMES } from "../config/products";

export default function MenuSection({
  menu,
  quantityOptions,
  form,
  setForm,
  menuStatus,
  allergenDisclaimer,
  onSelectItem,
  onRetry,
  batchLabel,
  isNextWeek,
  showFollowingBatch,
  followingBatchLabel,
  onShowFollowingBatch,
}) {
  const [activeFilter, setActiveFilter] = useState("All");
  const filters = useMemo(() => ["All", ...new Set(menu.map((item) => item.category))], [menu]);
  const visibleItems = useMemo(
    () => (activeFilter === "All" ? menu : menu.filter((item) => item.category === activeFilter)),
    [activeFilter, menu]
  );
  const weeklySpecials = useMemo(
    () => menu.filter((item) => item.special === true && item.available !== false),
    [menu]
  );

  if (menuStatus !== "ready") {
    const isLoading = menuStatus === "loading";

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
            <h2 className="mt-2 text-3xl text-ink sm:text-4xl">
              {isNextWeek ? "Available next bake" : "Available this week"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-inkMuted sm:text-[1rem]">
              Choose your bakes, then reserve the next available batch.
            </p>
          </div>
          <div className="mt-8 rounded-3xl border border-line bg-surface px-5 py-7 text-sm text-inkMuted shadow-[0_8px_24px_rgba(90,56,37,0.08)]">
            {isLoading ? (
              "Loading this week's menu..."
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>We could not load the live menu.</span>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-full border border-brandBrown px-4 py-2 text-xs font-semibold text-brandBrown transition-colors hover:bg-brandBrown hover:text-white"
                >
                  Retry menu
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

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
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.2em] text-inkMuted">Menu</div>
          <h2 className="mt-2 text-3xl text-ink sm:text-4xl">
            {isNextWeek ? "Available next bake" : "Available this week"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-inkMuted sm:text-[1rem]">
            Choose your bakes, then reserve the {batchLabel || "next Saturday"} batch.
          </p>
        </div>

        {weeklySpecials.length > 0 ? (
          <section
            className="mt-7 overflow-hidden rounded-3xl border border-[#E7C5A3] bg-[linear-gradient(120deg,#FFF7E9_0%,#F9E1BD_52%,#F4C98C_100%)] shadow-[0_14px_32px_rgba(126,75,30,0.14)]"
            aria-label="Weekly specials"
          >
            <div className="flex items-center gap-2 border-b border-[#D9A36D]/45 bg-white/35 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-brandBrown">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brandBrown text-sm text-white">*</span>
              Weekly special
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              {weeklySpecials.map((item) => (
                <article key={item.id} className="flex gap-4 rounded-2xl bg-white/75 p-3 shadow-[0_6px_16px_rgba(90,56,37,0.1)]">
                  {item.image ? (
                    <img src={item.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" decoding="async" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg text-ink">{item.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-inkMuted">{item.note}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">S${item.priceSgd} {item.unitLabel || "each"}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            items: { ...current.items, [item.id]: Math.max(1, Number(current.items[item.id] || 0)) },
                          }));
                          onSelectItem?.();
                        }}
                        className="rounded-full bg-brandBrown px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-px"
                      >
                        Reserve
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
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

        {showFollowingBatch ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#D8D7D4] bg-[#F0EFED] px-5 py-4 text-sm text-[#5F5E5A]">
            <span>This week is sold out. Pre-order for {followingBatchLabel} instead.</span>
            <button
              type="button"
              onClick={onShowFollowingBatch}
              className="rounded-full bg-brandBrown px-4 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-px"
            >
              View next week
            </button>
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {visibleItems.map((m) => {
            const quantityChoices = m.quantityOptions || quantityOptions;
            const isAvailable = m.available !== false;

            return (
              <div
                key={m.id}
                className={`overflow-hidden rounded-3xl border bg-surface shadow-[0_8px_24px_rgba(90,56,37,0.08)] ${
                  isAvailable ? "border-line" : "border-[#E7C5A3] bg-[#FFF9F2]"
                }`}
              >
                {m.image ? (
                  <div className="relative">
                    <img
                      src={m.image}
                      alt={m.imageAlt}
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {!isAvailable ? (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-[#5A3825]/[0.12] backdrop-blur-[4px]" />
                        <div className="pointer-events-none absolute right-3 top-3 w-1/4 min-w-20 max-w-32">
                          <img
                            src="/sold-out-sticker.png"
                            alt="Swirl Girl says sold out this week"
                            className="w-full rounded-full border-4 border-[#FFF7EB] shadow-[0_8px_20px_rgba(66,35,18,0.24)]"
                          />
                          <div className="relative -mt-2 ml-[-22%] rounded-2xl border border-[#E7C5A3] bg-[#FFF1DF] px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-brandBrown shadow-[0_3px_8px_rgba(90,56,37,0.12)] sm:text-xs">
                            <span className="absolute -top-1 right-[22%] h-2.5 w-2.5 rotate-45 border-l border-t border-[#E7C5A3] bg-[#FFF1DF]" />
                            <span className="relative">Sold out this week</span>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#F8E5CE,transparent_42%),linear-gradient(135deg,#EAD9C9,#F9F3EC)] px-6 text-center">
                    <div>
                      <img src="/logo.webp" alt="" className="mx-auto h-16 w-16 rounded-full object-cover" />
                      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brandBrown">Photo coming soon</div>
                    </div>
                  </div>
                )}
                <div className="px-5 py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-inkMuted">{m.category}</div>
                      <div className="mt-2 text-2xl text-ink">{m.name}</div>
                    </div>
                    {isAvailable && (m.special || m.badge) ? (
                      <span className="rounded-full bg-[#F7EBDD] px-3 py-1 text-xs font-semibold text-brandBrown">
                        {m.special ? "Weekly special" : m.badge}
                      </span>
                    ) : null}
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
                          onClick={() => {
                            const nextQuantity = Number(form.items[m.id] || 0) === qty ? 0 : qty;
                            setForm((f) => ({
                              ...f,
                              items: {
                                ...f.items,
                                [m.id]: nextQuantity,
                              },
                            }));
                            if (nextQuantity > 0) onSelectItem?.();
                          }}
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
          <p className="mt-6 max-w-4xl text-xs leading-6 text-inkMuted">
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
