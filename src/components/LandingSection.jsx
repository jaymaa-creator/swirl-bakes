import { useEffect, useRef } from "react";
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
  const heroVideoRef = useRef(null);
  useEffect(() => {
    if (!heroVideoRef.current) return;
    heroVideoRef.current.playbackRate = 0.5;
  }, []);

  return (
    <section
      className="mx-auto max-w-6xl px-4 pt-14 pb-14 sm:pt-20 sm:pb-20"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(196,122,58,0.08), transparent 60%)",
      }}
    >
      <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <video
          ref={heroVideoRef}
          src="/whatsapp-video-2026-03-06-151744.webm"
          className="h-[520px] w-full object-cover sm:h-auto sm:aspect-[16/9]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brandBrown/20 via-brandBrown/30 to-brandBrown/45" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex w-full justify-center px-3 sm:px-8 lg:px-10">
            <div className="w-[78%] rounded-[24px] border border-white/24 bg-white/8 p-4 shadow-[0_16px_40px_rgba(43,33,27,0.2)] backdrop-blur-sm sm:w-full sm:max-w-3xl sm:rounded-[28px] sm:p-6 lg:p-8">
              <div className="mb-4 sm:mb-5">
                <img
                  src="/logo.png"
                  alt="Swirl Girl Bakes main logo"
                  className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                />
              </div>
              <div className="hidden flex-wrap gap-2 sm:flex">
                <Pill>Saturday batch baking</Pill>
                <Pill>Pre-order window each week</Pill>
                <Pill>GrabExpress / Lalamove delivery</Pill>
              </div>
              <h1 className="mt-2 max-w-3xl text-[1.05rem] font-bold leading-[1.08] tracking-[-0.01em] text-white sm:mt-5 sm:text-5xl">
                {brand.tagline}
              </h1>
              <p className="mt-2 max-w-2xl text-[0.82rem] leading-relaxed text-white/95 sm:mt-4 sm:text-[1.12rem]">
                Soft, gooey bakes made in one Saturday batch each week. No on-demand production.
                Reserve early, then we wake, bake and dispatch.
              </p>
            </div>
          </div>
        </div>
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
                      className="relative rounded-button border border-line bg-surface px-3 py-2.5 text-xs font-medium text-brandBrown shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-brandCinnamon hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:translate-y-0 disabled:shadow-soft"
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
