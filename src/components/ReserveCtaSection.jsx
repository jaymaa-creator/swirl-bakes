import Card from "./ui/Card";
import CinnamonLoader from "./ui/CinnamonLoader";

export default function ReserveCtaSection({
  brand,
  handleOpenPreorder,
  isOpeningModal,
  openingTriggerId,
}) {
  const triggerId = "reserve-cta";
  const isLoading = isOpeningModal && openingTriggerId === triggerId;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-4 pb-24 sm:pt-6">
      <Card>
        <div className="flex flex-col items-start justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-center" data-reveal>
          <div>
            <div className="text-sm font-semibold">Ready to reserve this week’s batch?</div>
            <div className="mt-2 text-inkMuted">
              Order by {brand.orderCutoffLabel}. We’ll confirm your slot before baking.
            </div>
          </div>
          <button
            onClick={() => handleOpenPreorder(undefined, triggerId)}
            disabled={isLoading}
            className="relative inline-flex justify-center rounded-button bg-brandBrown px-5 py-3.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:translate-y-0 disabled:shadow-soft"
            aria-label="Reserve this week's batch"
          >
            <span className={isLoading ? "opacity-0" : "opacity-100"}>{brand.primaryCTA}</span>
            {isLoading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <CinnamonLoader size={18} className="text-white" />
              </span>
            ) : null}
          </button>
        </div>
      </Card>
    </section>
  );
}
