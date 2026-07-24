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
      className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pb-16 sm:pt-16"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(196,122,58,0.08), transparent 60%)",
      }}
    >
      <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card" data-reveal>
        <video
          ref={heroVideoRef}
          src="/hero-video-opt.webm"
          className="h-[540px] w-full object-cover sm:h-auto sm:aspect-[16/9]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-poster.jpg"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brandBrown/20 via-brandBrown/30 to-brandBrown/45" />
        <div className="absolute inset-0 flex items-end sm:items-center">
          <div className="flex w-full justify-center px-3 pb-3 sm:px-8 sm:pb-0 lg:px-10">
            <div className="w-full rounded-[24px] border border-white/24 bg-white/10 p-4 shadow-[0_16px_40px_rgba(43,33,27,0.2)] backdrop-blur-sm sm:max-w-3xl sm:rounded-[28px] sm:p-6 lg:p-8">
              <div className="mb-4 sm:mb-5">
                <img
                  src="/logo.webp"
                  alt="Swirl Girl Bakes main logo"
                  className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>Saturday batch baking</Pill>
                <Pill>Pre-order window each week</Pill>
                <Pill>GrabExpress / Lalamove delivery</Pill>
              </div>
              <h1 className="mt-4 max-w-3xl text-[2rem] leading-[0.96] text-white sm:mt-5 sm:text-5xl">
                {brand.tagline}
              </h1>
              <p className="mt-3 max-w-2xl text-[0.92rem] leading-relaxed text-white/95 sm:mt-4 sm:text-[1.12rem]">
                Soft, gooey bakes made in one Saturday batch each week.
                <br />
                Reserve early, then we wake, bake and dispatch.
              </p>
              <div className="sticker-perk mt-4 inline-flex items-center gap-3 rounded-2xl px-3 py-2 text-left shadow-[0_8px_24px_rgba(43,33,27,0.2)]">
                <span className="sticker-perk__mark inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <img
                    src="/logo.webp"
                    alt=""
                    className="h-full w-full object-cover"
                    aria-hidden="true"
                    decoding="async"
                  />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#38241A]">
                    A little extra for you
                  </span>
                  <span className="block text-sm font-semibold text-[#38241A]">
                    Free holographic sticker with every purchase
                  </span>
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-white/90 sm:text-sm">
                <span className="rounded-full bg-white/12 px-3 py-1.5">Pre-orders close {brand.orderCutoffLabel}</span>
                <span className="rounded-full bg-white/12 px-3 py-1.5">{brand.originLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-8" data-reveal="up">
        <Card>
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-inkMuted">Upcoming Batches</div>
                <div className="mt-1 text-2xl text-ink sm:text-3xl">Choose your next Saturday slot</div>
              </div>
              <div className="text-sm text-inkMuted">Small batch only. Reservations stay limited.</div>
            </div>
            <div className="mt-5 grid gap-3">
              {bakeWindows.map((w) => {
                const triggerId = `landing-batch-${w.value}`;
                const isLoading = isOpeningModal && openingTriggerId === triggerId;
                const isDisabled = isLoading || !w.isOpen;

                return (
                  <div
                    key={w.value}
                    className={`flex flex-col gap-3 rounded-2xl border border-line bg-cream px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                      w.isOpen ? "" : "opacity-60"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">{w.label}</div>
                      <div className="mt-1 text-xs text-inkMuted">
                        {w.isOpen ? "Reservations still open" : "Reservations closed"}
                      </div>
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
