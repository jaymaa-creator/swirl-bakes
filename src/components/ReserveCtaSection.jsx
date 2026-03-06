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
        <div className="p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="text-sm font-semibold">Ready to reserve this week’s batch?</div>
            <div className="mt-2 text-inkMuted">Use the form to send your Saturday reservation on WhatsApp.</div>
          </div>
          <button
            onClick={() => handleOpenPreorder(undefined, triggerId)}
            disabled={isLoading}
            className="relative inline-flex justify-center rounded-button bg-brandBrown px-5 py-3.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float disabled:translate-y-0 disabled:shadow-soft"
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
