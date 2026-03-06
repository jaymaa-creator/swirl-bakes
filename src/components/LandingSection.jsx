import Card from "./ui/Card";
import CinnamonLoader from "./ui/CinnamonLoader";
import Pill from "./ui/Pill";

export default function LandingSection({
  brand,
  bakeWindows,
  handleOpenPreorder,
  isOpeningModal,
  openingTriggerId,
}) {
  const photoPlaceholders = [
    {
      src: "/cinnamon-rolls.webp",
      alt: "Saturday batch tray",
    },
    {
      src: "/cinnamon-rolls.webp",
      alt: "Bakery packaging",
    },
    {
      src: "/cinnamon-rolls.webp",
      alt: "Cinnamon swirl close-up",
    },
  ];

  const primaryTriggerId = "landing-primary";
  const isPrimaryLoading = isOpeningModal && openingTriggerId === primaryTriggerId;

  return (
    <section
      className="mx-auto max-w-6xl px-4 pt-14 pb-14 sm:pt-20 sm:pb-20"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(196,122,58,0.08), transparent 60%)",
      }}
    >
      <div className="mb-8 flex justify-center">
        <img
          src="/logo.png"
          alt="Swirl Girl Bakes main logo"
          className="h-40 w-40 object-contain"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="flex flex-wrap gap-2">
            <Pill>Saturday batch baking</Pill>
            <Pill>Pre-order window each week</Pill>
            <Pill>GrabExpress / Lalamove delivery</Pill>
          </div>
          <h1 className="mt-5 text-3xl sm:text-5xl font-bold tracking-[-0.01em]">
            {brand.tagline}
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-inkMuted">
            Soft, gooey bakes made in one Saturday batch each week. No on-demand production.
            Reserve early, then we wake, bake and dispatch.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => handleOpenPreorder(undefined, primaryTriggerId)}
              disabled={isPrimaryLoading}
              className="relative inline-flex justify-center rounded-button bg-brandBrown px-5 py-3.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float disabled:translate-y-0 disabled:shadow-soft"
            >
              <span className={isPrimaryLoading ? "opacity-0" : "opacity-100"}>{brand.primaryCTA}</span>
              {isPrimaryLoading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <CinnamonLoader size={18} className="text-white" />
                </span>
              ) : null}
            </button>
            <a
              href="#menu"
              className="inline-flex justify-center rounded-button border border-line bg-surface px-5 py-3.5 text-sm font-medium text-brandBrown shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-brandCinnamon hover:bg-cream"
            >
              {brand.secondaryCTA}
            </a>
          </div>
          <div className="mt-6 text-xs text-inkMuted">
            Pre-order window closes when Saturday slots are full.
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="rounded-card border border-line bg-surface p-2 shadow-card">
            <img
              src="/cinnamon-rolls.webp"
              alt="Fresh artisan bake"
              className="aspect-[4/3] w-full rounded-button object-cover"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {photoPlaceholders.map((photo) => (
          <div key={photo.alt} className="rounded-card border border-line bg-surface p-2 shadow-soft">
            <img
              src={photo.src}
              alt={photo.alt}
              className="aspect-[4/3] w-full rounded-button object-cover"
            />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Card>
          <div className="p-5 sm:p-6">
            <div className="text-sm font-semibold">Upcoming Saturday batches</div>
            <div className="mt-3 grid gap-3">
              {bakeWindows.map((w) => {
                const triggerId = `landing-batch-${w.value}`;
                const isLoading = isOpeningModal && openingTriggerId === triggerId;
                const isDisabled = isLoading || !w.isOpen;

                return (
                  <div
                    key={w.value}
                    className={`flex items-center justify-between rounded-2xl border border-line bg-cream px-4 py-3 ${
                      w.isOpen ? "" : "opacity-60"
                    }`}
                  >
                    <div className="text-sm text-ink">
                      {w.label}
                      {!w.isOpen ? " (Closed)" : ""}
                    </div>
                    <button
                      onClick={() => handleOpenPreorder(w.value, triggerId)}
                      disabled={isDisabled}
                      className="relative rounded-button border border-line bg-surface px-3 py-2.5 text-xs font-medium text-brandBrown shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-brandCinnamon hover:bg-cream disabled:translate-y-0 disabled:shadow-soft"
                    >
                      <span className={isLoading ? "opacity-0" : "opacity-100"}>
                        {w.isOpen ? "Reserve for Saturday" : "Closed"}
                      </span>
                      {isLoading ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <CinnamonLoader size={18} className="text-brandBrown" />
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-inkMuted">
              We confirm delivery or collection timing after your batch slot is reserved.
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
